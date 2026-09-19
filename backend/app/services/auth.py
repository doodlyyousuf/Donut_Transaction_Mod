"""Per-player linking and dashboard sessions.

Trust model
-----------
A dashboard session binds a browser to one Minecraft username. The only way to
obtain one is to prove presence in-game:

1. The mod asks the API (authenticated with the server's API key) for a code.
2. The code is shown to the player in chat and expires after a few minutes.
3. The player types the code into the dashboard, which exchanges it for a
   session cookie scoped to that username.

No Minecraft credentials are involved at any point. The mod sends only the
username it already reports for every observed transaction, never access
tokens, session tokens, or launcher files.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import LinkCode, PlayerSession

_CODE_DIGITS = 6


def _now() -> datetime:
    return datetime.now(timezone.utc)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ---------- anonymous client handshake ----------
# A browser first calls the token endpoint, which sets an HttpOnly cookie and
# returns a signed, short-lived token bound to it. Reading the public JSON
# endpoints requires both, so pasting a URL into curl or another app fails.
# This is friction, not a wall: anyone can script the same handshake.

def _client_signature(client_id: str, expires_at: int) -> str:
    message = f"{client_id}.{expires_at}".encode("utf-8")
    return hmac.new(settings.api_key.encode("utf-8"), message, hashlib.sha256).hexdigest()


def issue_client_token(client_id: str) -> tuple[str, int]:
    expires_at = int(time.time()) + settings.client_token_ttl_seconds
    return f"{expires_at}.{_client_signature(client_id, expires_at)}", expires_at


def verify_client_token(client_id: str | None, token: str | None) -> bool:
    if not client_id or not token:
        return False
    expires_str, _, signature = token.partition(".")
    try:
        expires_at = int(expires_str)
    except ValueError:
        return False
    if expires_at < int(time.time()):
        return False
    expected = _client_signature(client_id, expires_at)
    return hmac.compare_digest(expected, signature)


def _normalize_code(code: str) -> str:
    return "".join(ch for ch in (code or "") if ch.isdigit())


async def create_link_code(
    db: AsyncSession,
    username: str,
    issued_to: str | None = None,
) -> tuple[str, datetime]:
    """Issue a fresh single-use code, revoking any still-active code for the player.

    Revoking instead of deleting keeps an audit trail and avoids destructive
    SQL; the previous code simply stops matching.
    """
    now = _now()
    await db.execute(
        update(LinkCode)
        .where(LinkCode.username == username, LinkCode.used_at.is_(None))
        .values(used_at=now)
    )

    expires_at = now + timedelta(seconds=settings.link_code_ttl_seconds)
    # Retry on the astronomically unlikely collision with another live code.
    for _ in range(20):
        code = f"{secrets.randbelow(10 ** _CODE_DIGITS):0{_CODE_DIGITS}d}"
        clash = (await db.execute(
            select(LinkCode.id).where(
                LinkCode.code == code,
                LinkCode.used_at.is_(None),
                LinkCode.expires_at > now,
            ).limit(1)
        )).first()
        if clash is not None:
            continue
        db.add(LinkCode(
            code=code,
            username=username,
            issued_to=issued_to,
            expires_at=expires_at,
        ))
        await db.commit()
        return code, expires_at

    raise RuntimeError("could not allocate a unique link code")


async def claim_link_code(db: AsyncSession, code: str) -> str | None:
    """Consume a code and return the username it belongs to, or None.

    The lookup is deliberately done in SQL so expiry is evaluated by the
    database clock and stays timezone-agnostic across SQLite and PostgreSQL.
    """
    normalized = _normalize_code(code)
    if len(normalized) != _CODE_DIGITS:
        return None

    now = _now()
    row = (await db.execute(
        select(LinkCode)
        .where(
            LinkCode.code == normalized,
            LinkCode.used_at.is_(None),
            LinkCode.expires_at > now,
        )
        .order_by(LinkCode.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()
    if row is None:
        return None

    # Single use: mark consumed before minting the session.
    result = await db.execute(
        update(LinkCode)
        .where(LinkCode.id == row.id, LinkCode.used_at.is_(None))
        .values(used_at=now)
    )
    if result.rowcount != 1:
        await db.rollback()
        return None
    await db.commit()
    return row.username


async def issue_session(db: AsyncSession, username: str) -> tuple[str, datetime]:
    """Return a raw session token and persist only its digest."""
    token = secrets.token_urlsafe(32)
    expires_at = _now() + timedelta(days=settings.session_ttl_days)
    db.add(PlayerSession(
        token_hash=hash_token(token),
        username=username,
        last_seen_at=_now(),
        expires_at=expires_at,
    ))
    await db.commit()
    return token, expires_at


async def resolve_session(db: AsyncSession, token: str | None) -> str | None:
    """Return the username for a live session token, refreshing last-seen."""
    if not token:
        return None
    now = _now()
    session = (await db.execute(
        select(PlayerSession).where(
            PlayerSession.token_hash == hash_token(token),
            PlayerSession.expires_at > now,
        )
    )).scalar_one_or_none()
    if session is None:
        return None
    session.last_seen_at = now
    await db.commit()
    return session.username


async def revoke_session(db: AsyncSession, token: str | None) -> None:
    """End a session by expiring it immediately."""
    if not token:
        return
    await db.execute(
        update(PlayerSession)
        .where(PlayerSession.token_hash == hash_token(token))
        .values(expires_at=_now())
    )
    await db.commit()
