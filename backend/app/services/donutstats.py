from __future__ import annotations

import asyncio
import re
import time
from typing import Any, Optional

import httpx
from bs4 import BeautifulSoup

# Primary source: donutstats.co exposes a small JSON API used by its own pages.
# Secondary source: the donutstats.org player page is server-rendered HTML, so
# we fall back to reading it the way a browser would (the approach in the
# original sample script). Nothing is authenticated or bypassed.
_PRIMARY_URL = "https://donutstats.co/api.php"
_SECONDARY_URL = "https://donutstats.org/player.php"
_PRIMARY_SOURCE = "donutstats.co"
_SECONDARY_SOURCE = "donutstats.org"

_USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{1,16}$")

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html;q=0.9, */*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_CACHE_TTL_SECONDS = 300.0
_NEGATIVE_TTL_SECONDS = 60.0
# Leaderboards change slowly and are the costliest upstream call, so they get a
# longer TTL: repeated page views and crawlers are served from memory.
_LEADERBOARD_CACHE_TTL_SECONDS = 600.0
_REQUEST_TIMEOUT_SECONDS = 8.0
_PRIMARY_ATTEMPTS = 2
_MAX_CACHE_ENTRIES = 512

# Leaderboard categories exposed by donutstats.co. `kind` controls formatting.
LEADERBOARD_CATEGORIES: dict[str, dict[str, str]] = {
    "money": {"label": "Money", "kind": "money"},
    "shards": {"label": "Shards", "kind": "count"},
    "kills": {"label": "Kills", "kind": "count"},
    "deaths": {"label": "Deaths", "kind": "count"},
    "mobskilled": {"label": "Mobs killed", "kind": "count"},
    "placedblocks": {"label": "Blocks placed", "kind": "count"},
    "brokenblocks": {"label": "Blocks broken", "kind": "count"},
    "shop": {"label": "Spent /shop", "kind": "money"},
    "sell": {"label": "Earned /sell", "kind": "money"},
    "playtime": {"label": "Playtime", "kind": "playtime"},
}

# The upstream paginates with a one-row overlap: page 1 returns ranks 1-45,
# page 2 re-sends rank 45 then continues 46-89, and so on. We drop the repeated
# first row on later pages and number the rows ourselves.
_LEADERBOARD_RAW_SIZE = 45
_LEADERBOARD_STEP = 44
# Caps how deep a single category can be walked, so the API cannot be used as a
# bulk mirror of the upstream leaderboard.
LEADERBOARD_MAX_PAGE = 500


class DonutStatsError(Exception):
    """Both sources are unreachable or unreadable."""


class PlayerNotFound(DonutStatsError):
    """A source answered, but it has no profile for this username."""


_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_locks: dict[str, asyncio.Lock] = {}
_locks_guard = asyncio.Lock()


def valid_username(username: str) -> bool:
    return bool(_USERNAME_RE.match(username or ""))


def _lock_for(username: str) -> asyncio.Lock:
    lock = _locks.get(username)
    if lock is None:
        lock = asyncio.Lock()
        _locks[username] = lock
    return lock


# ---------- formatting ----------
def _num(value: Any) -> Optional[float]:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _compact(value: Optional[float]) -> str:
    if value is None:
        return "-"
    magnitude = abs(value)
    for unit, divisor in (
        ("T", 1_000_000_000_000.0),
        ("B", 1_000_000_000.0),
        ("M", 1_000_000.0),
        ("K", 1_000.0),
    ):
        if magnitude >= divisor:
            text = f"{value / divisor:.2f}".rstrip("0").rstrip(".")
            return f"{text}{unit}"
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _days(value: Optional[float]) -> str:
    if value is None:
        return "-"
    # The API reports playtime in milliseconds.
    return f"{value / 86_400_000:.2f}d"


def _missing(username: str, source: str) -> dict[str, Any]:
    return {
        "username": username,
        "display_name": username,
        "found": False,
        "source": source,
        "stats": [],
    }


# ---------- primary (donutstats.co JSON) ----------
def _map_primary(result: dict[str, Any], username: str) -> dict[str, Any]:
    stats = [
        {"label": "Money", "value": _compact(_num(result.get("money")))},
        {"label": "Shards", "value": _compact(_num(result.get("shards")))},
        {"label": "Playtime", "value": _days(_num(result.get("playtime")))},
        {"label": "Kills", "value": _compact(_num(result.get("kills")))},
        {"label": "Deaths", "value": _compact(_num(result.get("deaths")))},
        {"label": "Mobs killed", "value": _compact(_num(result.get("mobs_killed")))},
        {"label": "Blocks broken", "value": _compact(_num(result.get("broken_blocks")))},
        {"label": "Blocks placed", "value": _compact(_num(result.get("placed_blocks")))},
        {"label": "Earned /sell", "value": _compact(_num(result.get("money_made_from_sell")))},
        {"label": "Spent /shop", "value": _compact(_num(result.get("money_spent_on_shop")))},
    ]
    return {
        "username": username,
        "display_name": username,
        "found": True,
        "source": _PRIMARY_SOURCE,
        "stats": stats,
    }


async def _fetch_primary(username: str) -> dict[str, Any]:
    async with httpx.AsyncClient(
        headers=_HEADERS, timeout=_REQUEST_TIMEOUT_SECONDS, follow_redirects=True
    ) as client:
        response = await client.get(_PRIMARY_URL, params={"path": f"/stats/{username}"})

    if response.status_code != 200:
        body = response.text.lower()
        if "does not exist" in body or response.status_code == 404:
            raise PlayerNotFound(username)
        raise DonutStatsError(f"primary returned {response.status_code}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise DonutStatsError("primary returned invalid JSON") from exc

    result = payload.get("result")
    if payload.get("status") == 200 and isinstance(result, dict) and result:
        return _map_primary(result, username)

    message = str(payload.get("message", "")).lower()
    if "does not exist" in message or payload.get("status") == 500:
        raise PlayerNotFound(username)
    raise DonutStatsError("primary returned no result")


# ---------- secondary (donutstats.org HTML) ----------
def _parse_html(html: str, username: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")

    heading = soup.find("h1")
    display_name = heading.get_text(" ", strip=True) if heading else username

    stats: list[dict[str, str]] = []
    for card in soup.select("div.rounded-btn"):
        label = card.select_one("span.text-xs")
        value = card.select_one("span.font-mono")
        if label and value:
            stats.append({
                "label": label.get_text(strip=True),
                "value": value.get_text(strip=True),
            })

    # The page answers 200 even for unknown players, with a "Player not found"
    # notice and no stat cards.
    found = bool(stats)
    return {
        "username": username,
        "display_name": display_name if found else username,
        "found": found,
        "source": _SECONDARY_SOURCE,
        "stats": stats,
    }


async def _fetch_secondary(username: str) -> dict[str, Any]:
    async with httpx.AsyncClient(
        headers=_HEADERS, timeout=_REQUEST_TIMEOUT_SECONDS, follow_redirects=True
    ) as client:
        response = await client.get(_SECONDARY_URL, params={"user": username})
    if response.status_code != 200:
        raise DonutStatsError(f"secondary returned {response.status_code}")

    result = _parse_html(response.text, username)
    if not result["found"]:
        raise PlayerNotFound(username)
    return result


# ---------- orchestration ----------
async def _load(username: str) -> dict[str, Any]:
    """Try the primary twice, then fall back to the secondary once."""
    last_error: Optional[DonutStatsError] = None

    for _ in range(_PRIMARY_ATTEMPTS):
        try:
            return await _fetch_primary(username)
        except PlayerNotFound:
            break
        except DonutStatsError as exc:
            last_error = exc

    try:
        return await _fetch_secondary(username)
    except PlayerNotFound:
        return _missing(username, _SECONDARY_SOURCE)
    except DonutStatsError as exc:
        last_error = exc

    if last_error is not None:
        raise DonutStatsError(str(last_error))
    return _missing(username, _PRIMARY_SOURCE)


def _ttl(result: dict[str, Any]) -> float:
    return _CACHE_TTL_SECONDS if result.get("found") else _NEGATIVE_TTL_SECONDS


def _prune() -> None:
    if len(_cache) <= _MAX_CACHE_ENTRIES:
        return
    for key, _ in sorted(_cache.items(), key=lambda item: item[1][0])[
        : len(_cache) - _MAX_CACHE_ENTRIES
    ]:
        _cache.pop(key, None)


async def get_player_stats(username: str) -> dict[str, Any]:
    """Return cached public stats for a username.

    A short TTL keeps the tracker from hammering the upstream sites, and a
    per-username lock coalesces concurrent requests for the same player.
    """
    now = time.monotonic()
    cached = _cache.get(username)
    if cached and now - cached[0] < _ttl(cached[1]):
        return cached[1]

    async with _locks_guard:
        lock = _lock_for(username)

    async with lock:
        # Another request may have refreshed the cache while we waited.
        cached = _cache.get(username)
        now = time.monotonic()
        if cached and now - cached[0] < _ttl(cached[1]):
            return cached[1]

        result = await _load(username)
        _cache[username] = (time.monotonic(), result)
        _prune()
        return result


# ---------- leaderboards (donutstats.co JSON) ----------
def _format_leaderboard_value(kind: str, value: Any) -> str:
    number = _num(value)
    if kind == "playtime":
        return _days(number)
    return _compact(number)


async def _fetch_leaderboard(category: str, page: int) -> dict[str, Any]:
    async with httpx.AsyncClient(
        headers=_HEADERS, timeout=_REQUEST_TIMEOUT_SECONDS, follow_redirects=True
    ) as client:
        response = await client.get(
            _PRIMARY_URL, params={"path": f"/leaderboards/{category}/{page}"}
        )

    if response.status_code != 200:
        raise DonutStatsError(f"leaderboard returned {response.status_code}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise DonutStatsError("leaderboard returned invalid JSON") from exc

    raw = payload.get("result")
    if payload.get("status") != 200 or not isinstance(raw, list):
        raise DonutStatsError("leaderboard returned no result")

    return _map_leaderboard(category, page, raw)


def _map_leaderboard(category: str, page: int, raw: list[Any]) -> dict[str, Any]:
    kind = LEADERBOARD_CATEGORIES[category]["kind"]
    entries: list[dict[str, Any]] = []
    for index, item in enumerate(raw):
        if not isinstance(item, dict):
            continue
        # Later pages repeat the previous page's final row; skip the duplicate.
        if page > 1 and index == 0:
            continue
        entries.append(
            {
                "rank": (page - 1) * _LEADERBOARD_STEP + 1 + index,
                "username": str(item.get("username", "")),
                "uuid": str(item.get("uuid", "")),
                "value": str(item.get("value", "")),
                "display": _format_leaderboard_value(kind, item.get("value")),
            }
        )

    return {
        "category": category,
        "label": LEADERBOARD_CATEGORIES[category]["label"],
        "kind": kind,
        "page": page,
        "source": _PRIMARY_SOURCE,
        "found": True,
        "entries": entries,
        "has_prev": page > 1,
        "has_next": len(raw) >= _LEADERBOARD_RAW_SIZE,
    }


async def get_leaderboard(category: str, page: int) -> dict[str, Any]:
    """Return one page of a donutstats.co leaderboard, cached briefly."""
    if category not in LEADERBOARD_CATEGORIES:
        raise ValueError(f"unknown leaderboard category: {category}")
    page = max(1, min(page, LEADERBOARD_MAX_PAGE))
    cache_key = f"lb:{category}:{page}"

    now = time.monotonic()
    cached = _cache.get(cache_key)
    if cached and now - cached[0] < _LEADERBOARD_CACHE_TTL_SECONDS:
        return cached[1]

    async with _locks_guard:
        lock = _lock_for(cache_key)

    async with lock:
        cached = _cache.get(cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < _LEADERBOARD_CACHE_TTL_SECONDS:
            return cached[1]

        result = await _fetch_leaderboard(category, page)
        _cache[cache_key] = (time.monotonic(), result)
        _prune()
        return result
