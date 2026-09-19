from __future__ import annotations
import asyncio, subprocess, sys, os, re, secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional
from fastapi import (APIRouter, Depends, HTTPException, Query, Request, Response,
                     Header, WebSocket, WebSocketDisconnect)
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter

from app.config import settings, ensure_api_key
from app.database import get_db
from sqlalchemy.exc import IntegrityError
from app.models import Balance, Transaction, Order, Player, Friend, TransactionEvent
from app.schemas import (BulkIn, BulkResult, TransactionOut, StatsOut,
                         LinkStartIn, LinkStartOut, LinkClaimIn, FriendIn)
from app.services import auth as auth_service
from app.services import donutstats as donutstats_service
from app.services.orders import apply_order_lifecycle, link_delivery
from app.websocket import manager

# Reverse proxies allowed to set forwarding headers. TLS terminates at the
# local proxy which then connects from loopback, so only these peers can be
# trusted; anyone else sending X-Forwarded-For is a direct client and the
# header is ignored (otherwise a caller could forge it to dodge rate limits).
_TRUSTED_PROXIES = {"127.0.0.1", "::1", "localhost", "testclient"}


def client_ip(request: Request) -> str:
    """Rate-limit key: the real client IP, resolved safely.

    Behind a trusted proxy we take the right-most untrusted hop. Walking from
    the right means a client that prepends fake addresses to X-Forwarded-For
    cannot win: the forged values sit to the left of the address our proxy
    appended.
    """
    peer = (request.client.host if request.client else "") or "unknown"
    if peer not in _TRUSTED_PROXIES:
        return peer
    forwarded = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip") or ""
    for hop in reversed([part.strip() for part in forwarded.split(",") if part.strip()]):
        if hop not in _TRUSTED_PROXIES:
            return hop
    return peer


limiter = Limiter(key_func=client_ip)
router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api")  # auth-protected endpoints

_dashboard_proc: Optional[subprocess.Popen] = None

_INSERT = sqlite_insert if settings.database_url.startswith("sqlite") else pg_insert


def _is_loopback(request: Request) -> bool:
    if request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip"):
        return False
    host = (request.client.host if request.client else "") or ""
    return host in {"127.0.0.1", "::1", "localhost", "testclient"}


# Headers a browser attaches to fetch/XHR but a non-browser HTTP client (the
# mod's Java HttpClient) never sends. Rejecting these keeps the API key out of
# any browser, even one talking to the API through a local reverse proxy that
# forwards without X-Forwarded-For.
_BROWSER_HEADERS = ("origin", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest")


def _is_browser_request(request: Request) -> bool:
    return any(request.headers.get(h) for h in _BROWSER_HEADERS)


# ---------- §34 authentication ----------
async def require_api_key(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
):
    key = x_api_key
    if not key and authorization and authorization.lower().startswith("bearer "):
        key = authorization[7:].strip()
    if not settings.api_key or key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


async def require_client(
    request: Request,
    x_client_token: Optional[str] = Header(None, alias="X-Client-Token"),
):
    """Gate public read endpoints behind the anonymous browser handshake.

    Both the HttpOnly cookie and the signed token must be present and match, so
    a bare URL pasted into curl or a third-party app gets a 401.
    """
    client_id = request.cookies.get(settings.client_cookie_name)
    if not auth_service.verify_client_token(client_id, x_client_token):
        raise HTTPException(status_code=401, detail="Client handshake required")


# ---------- §27 REST ----------
@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/bootstrap")
async def bootstrap_api_key(request: Request):
    """Hand the generated API key to the local Minecraft mod / dashboard.

    Only the machine running the API can call this (loopback). Remote clients
    still set X-API-Key themselves. Browsers are refused even on loopback so the
    key is never exposed to client-side JavaScript.
    """
    if not _is_loopback(request) or _is_browser_request(request):
        raise HTTPException(status_code=403, detail="Bootstrap is only available to local clients")
    return {"api_key": ensure_api_key()}


@auth_router.post("/transactions/bulk", response_model=BulkResult)
async def create_transactions_bulk(
    payload: BulkIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_api_key),
):
    received = len(payload.transactions)
    inserted = 0
    balances_seen = 0

    for t in payload.transactions:
        values = t.model_dump(exclude={"id"})
        if not values.get("fingerprint"):
            continue
        values["normalized_message"] = values.get("normalized_message") or values["raw_message"]

        # Balances are state snapshots, not transactions: they are diverted to
        # their own table so they can never affect the money totals (§41).
        if values.get("transaction_type") == "BALANCE":
            if values.get("total_price") is not None:
                result = await db.execute(
                    _INSERT(Balance)
                    .values(
                        fingerprint=values["fingerprint"],
                        username=values["transaction_owner"],
                        amount=Decimal(values["total_price"]),
                        observed_by=values["observed_by"],
                        server=values.get("server") or "donutsmp",
                        raw_message=values["raw_message"],
                        minecraft_timestamp=values.get("minecraft_timestamp"),
                    )
                    .on_conflict_do_nothing(index_elements=["fingerprint"])
                    .returning(Balance.id)
                )
                if result.scalar_one_or_none() is not None:
                    balances_seen += 1
                    await manager.broadcast({
                        "event": "balance",
                        "data": {
                            "username": values["transaction_owner"],
                            "amount": str(values["total_price"]),
                        },
                    })
            continue

        stmt = (
            _INSERT(Transaction)
            .values(**values)
            .on_conflict_do_nothing(index_elements=["fingerprint"])   # §19
            .returning(Transaction.id)
        )
        result = await db.execute(stmt)
        new_id = result.scalar_one_or_none()

        if new_id is not None:
            inserted += 1
            row = (await db.execute(select(Transaction).where(Transaction.id == new_id))).scalar_one()
            await link_delivery(db, row)              # §17 (may set order_id + event)
            await apply_order_lifecycle(db, row)      # ORDER_CREATED / ORDER_COMPLETED
            await manager.broadcast({                 # §28 real-time push
                "event": "transaction",
                "data": TransactionOut.model_validate(row).model_dump(mode="json"),
            })

    # upsert player/server dimension rows (best-effort)
    for name in {t.transaction_owner for t in payload.transactions} | \
                {t.observed_by for t in payload.transactions}:
        await db.execute(_INSERT(Player).values(username=name)
                         .on_conflict_do_nothing(index_elements=["username"]))
    await db.commit()

    return BulkResult(received=received, inserted=inserted + balances_seen,
                      duplicates=received - inserted - balances_seen)


@router.get("/transactions", dependencies=[Depends(require_client)])
@limiter.limit("60/minute")
async def list_transactions(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    player: Optional[str] = None,
    item: Optional[str] = None,
    type: Optional[str] = None,
    owner: Optional[str] = None,
    from_: Optional[datetime] = Query(None, alias="from"),
    to: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Transaction).order_by(Transaction.created_at.desc())
    if player:
        q = q.where((Transaction.transaction_owner == player)
                    | (Transaction.buyer_username == player)
                    | (Transaction.seller_username == player)
                    | (Transaction.recipient_username == player))
    if owner:   q = q.where(Transaction.transaction_owner == owner)
    if item:    q = q.where(Transaction.item_name.ilike(f"%{item}%"))
    if type:    q = q.where(Transaction.transaction_type == type)
    if from_:   q = q.where(Transaction.created_at >= from_)
    if to:      q = q.where(Transaction.created_at <= to)

    total = (await db.execute(
        select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.limit(limit).offset((page - 1) * limit))).scalars().all()
    return {"total": total, "page": page, "limit": limit,
            "items": [TransactionOut.model_validate(r).model_dump(mode="json") for r in rows]}


@router.get("/transactions/{tx_id}", response_model=TransactionOut,
            dependencies=[Depends(require_client)])
async def get_transaction(tx_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(Transaction, tx_id)
    if row is None:
        raise HTTPException(404, "transaction not found")
    return row


@router.get("/orders", dependencies=[Depends(require_client)])
async def list_orders(
    page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None, player: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(Order).order_by(Order.created_at.desc())
    if status: q = q.where(Order.status == status)
    if player:
        q = q.where((Order.owner_username == player) | (Order.buyer_username == player)
                    | (Order.seller_username == player))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.limit(limit).offset((page - 1) * limit))).scalars().all()
    return {"total": total, "page": page, "limit": limit,
            "items": [{
                "id": o.id, "owner_username": o.owner_username,
                "seller_username": o.seller_username, "buyer_username": o.buyer_username,
                "item_name": o.item_name, "quantity": o.quantity,
                "fulfilled_quantity": o.fulfilled_quantity,
                "remaining_quantity": o.remaining_quantity,
                "status": o.status, "created_at": o.created_at,
            } for o in rows]}


@router.get("/orders/{order_id}", dependencies=[Depends(require_client)])
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    o = await db.get(Order, order_id)
    if o is None:
        raise HTTPException(404, "order not found")
    events = (await db.execute(select(TransactionEvent)
               .where(TransactionEvent.order_id == order_id))).scalars().all()
    return {"order": {c.name: getattr(o, c.name) for c in o.__table__.columns},
            "events": [{c.name: str(getattr(e, c.name)) for c in e.__table__.columns}
                       for e in events]}


@router.get("/players", dependencies=[Depends(require_client)])
async def list_players(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Player.username, func.count(Transaction.id).label("tx_count"))
        .join(Transaction, Transaction.transaction_owner == Player.username)
        .group_by(Player.username)
        .order_by(func.count(Transaction.id).desc()))).all()
    return [{"username": r.username, "observed_transactions": r.tx_count} for r in rows]


@router.get("/players/{username}", dependencies=[Depends(require_client)])
async def player_detail(username: str, db: AsyncSession = Depends(get_db)):
    base = select(Transaction).where(Transaction.transaction_owner == username)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    if total == 0:
        raise HTTPException(404, "no observed transactions for this player")
    rows = (await db.execute(base.order_by(Transaction.created_at.desc()).limit(50))).scalars().all()
    spent = (await db.execute(select(func.coalesce(func.sum(Transaction.money_paid), 0))
              .where(Transaction.transaction_owner == username))).scalar_one()
    received = (await db.execute(select(func.coalesce(func.sum(Transaction.money_received), 0))
                 .where(Transaction.transaction_owner == username))).scalar_one()
    top_items = (await db.execute(
        select(Transaction.item_name, func.count().label("n"))
        .where((Transaction.transaction_owner == username) & (Transaction.item_name.isnot(None)))
        .group_by(Transaction.item_name).order_by(func.count().desc()).limit(10))).all()
    return {
        "username": username,
        "observed_transactions": total,
        "total_volume": spent + received,
        "money_spent": spent, "money_received": received,
        "frequently_traded_items": [{"item": i, "count": n} for i, n in top_items],
        "recent": [TransactionOut.model_validate(r).model_dump(mode="json") for r in rows],
        "note": "Only transactions actually observed by connected trackers are shown.",
    }


# ---------- public donutstats profile enrichment ----------
@router.get("/players/{username}/donutstats", dependencies=[Depends(require_client)])
@limiter.limit("30/minute;300/hour")
async def player_donutstats(request: Request, response: Response, username: str):
    """Public profile data from donutstats.co (donutstats.org fallback).

    Kept separate from the observed-transaction endpoint so the player page
    still renders when the upstream site is slow or unreachable.
    """
    response.headers["Cache-Control"] = "public, max-age=300"
    if not donutstats_service.valid_username(username):
        raise HTTPException(status_code=400, detail="invalid username")
    try:
        return await donutstats_service.get_player_stats(username)
    except donutstats_service.DonutStatsError:
        return {
            "username": username,
            "display_name": username,
            "found": False,
            "unavailable": True,
            "source": "donutstats",
            "stats": [],
        }


# ---------- public donutstats.co leaderboards ----------
@router.get("/leaderboards", dependencies=[Depends(require_client)])
@limiter.limit("120/minute")
async def list_leaderboards(request: Request, response: Response):
    """The leaderboard categories that can be requested."""
    response.headers["Cache-Control"] = "public, max-age=600"
    return {
        "source": "donutstats.co",
        "categories": [
            {"id": key, "label": meta["label"]}
            for key, meta in donutstats_service.LEADERBOARD_CATEGORIES.items()
        ],
    }


@router.get("/leaderboards/{category}", dependencies=[Depends(require_client)])
@limiter.limit("60/minute;600/hour")
async def leaderboard(request: Request, response: Response, category: str,
                      page: int = Query(1, ge=1,
                                        le=donutstats_service.LEADERBOARD_MAX_PAGE)):
    """One page of a donutstats.co leaderboard, rendered on our own site."""
    response.headers["Cache-Control"] = "public, max-age=300"
    if category not in donutstats_service.LEADERBOARD_CATEGORIES:
        raise HTTPException(status_code=404, detail="unknown leaderboard category")
    try:
        return await donutstats_service.get_leaderboard(category, page)
    except donutstats_service.DonutStatsError:
        return {
            "category": category,
            "label": donutstats_service.LEADERBOARD_CATEGORIES[category]["label"],
            "page": page,
            "source": "donutstats.co",
            "found": False,
            "unavailable": True,
            "entries": [],
            "has_prev": page > 1,
            "has_next": False,
        }


# ---------- mod downloads ----------
_MOD_VERSION_RE = re.compile(
    r"^donutsmp-transaction-tracker-(\d+(?:\.\d+)*)\+mc([0-9][0-9A-Za-z._-]*)\.jar$"
)
_MOD_MC_RE = re.compile(r"^[0-9][0-9A-Za-z._-]{0,19}$")


def _mod_dir() -> Path:
    return Path(settings.mod_dist_dir).resolve()


def _mod_key(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split("."))


def _latest_mod_jar(mc: str) -> Optional[Path]:
    directory = _mod_dir()
    if not directory.is_dir() or not _MOD_MC_RE.match(mc):
        return None
    best: Optional[tuple[tuple[int, ...], Path]] = None
    for path in directory.glob(f"donutsmp-transaction-tracker-*+mc{mc}.jar"):
        match = _MOD_VERSION_RE.match(path.name)
        if not match or match.group(2) != mc:
            continue
        key = _mod_key(match.group(1))
        if best is None or key > best[0]:
            best = (key, path)
    return best[1] if best else None


@router.get("/mod/builds")
@limiter.limit("120/minute")
async def mod_builds(request: Request, response: Response):
    """Available mod jars, newest build per Minecraft version."""
    response.headers["Cache-Control"] = "public, max-age=300"
    directory = _mod_dir()
    latest: dict[str, dict[str, Any]] = {}
    if directory.is_dir():
        for path in directory.glob("donutsmp-transaction-tracker-*+mc*.jar"):
            match = _MOD_VERSION_RE.match(path.name)
            if not match:
                continue
            version, mc = match.group(1), match.group(2)
            if mc not in latest or _mod_key(version) > _mod_key(latest[mc]["version"]):
                latest[mc] = {
                    "minecraft": mc,
                    "version": version,
                    "filename": path.name,
                    "size": path.stat().st_size,
                    "url": f"/api/mod/download?mc={mc}&version={version}",
                }
    return {"builds": [latest[mc] for mc in sorted(latest)]}


@router.get("/mod/download")
@limiter.limit("60/minute")
async def mod_download(request: Request, mc: str = Query(...), version: Optional[str] = Query(None)):
    """Serve a built mod jar. Version defaults to the newest build for `mc`."""
    if not _MOD_MC_RE.match(mc):
        raise HTTPException(status_code=400, detail="invalid minecraft version")
    if version is None:
        path = _latest_mod_jar(mc)
    else:
        if not re.fullmatch(r"\d+(?:\.\d+)*", version):
            raise HTTPException(status_code=400, detail="invalid mod version")
        candidate = (_mod_dir() / f"donutsmp-transaction-tracker-{version}+mc{mc}.jar").resolve()
        path = candidate if candidate.is_file() and candidate.parent == _mod_dir() else None
    if path is None:
        raise HTTPException(status_code=404, detail="no build for that version")
    return FileResponse(path, media_type="application/java-archive", filename=path.name)


@router.get("/stats", response_model=StatsOut, dependencies=[Depends(require_client)])
async def stats(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(Transaction.id)))).scalar_one()
    spent = (await db.execute(select(func.coalesce(func.sum(Transaction.money_paid), 0)))).scalar_one()
    received = (await db.execute(select(func.coalesce(func.sum(Transaction.money_received), 0)))).scalar_one()
    orders = (await db.execute(select(func.count(Order.id)))).scalar_one()
    players = (await db.execute(select(func.count(func.distinct(Transaction.transaction_owner))))).scalar_one()
    return StatsOut(total_transactions=total,
                    total_money_spent=Decimal(spent),
                    total_money_received=Decimal(received),
                    net=Decimal(received) - Decimal(spent),
                    orders=orders, players_observed=players)


@router.get("/stats/player/{username}", dependencies=[Depends(require_client)])
async def stats_player(username: str, db: AsyncSession = Depends(get_db)):
    q = select(func.count(Transaction.id)).where(Transaction.transaction_owner == username)
    return {"username": username,
            "transactions": (await db.execute(q)).scalar_one()}


# ---------- observed balances ----------
@router.get("/balances", dependencies=[Depends(require_client)])
@limiter.limit("60/minute")
async def list_balances(request: Request, db: AsyncSession = Depends(get_db)):
    """Latest observed balance per player, highest first.

    Only players whose balance has actually been seen in chat appear here, so
    this is a leaderboard of *observed* balances, not a complete one."""
    newest = (
        select(
            Balance.username,
            func.max(Balance.observed_at).label("observed_at"),
        )
        .group_by(Balance.username)
        .subquery()
    )
    rows = (await db.execute(
        select(Balance)
        .join(newest, (Balance.username == newest.c.username)
              & (Balance.observed_at == newest.c.observed_at))
        .order_by(Balance.amount.desc())
        .limit(200)
    )).scalars().all()

    seen = (await db.execute(
        select(func.count(func.distinct(Balance.username)))
    )).scalar_one()

    return {
        "total": seen,
        "items": [
            {
                "username": b.username,
                "amount": str(b.amount),
                "observed_at": b.observed_at.isoformat() if b.observed_at else None,
                "observed_by": b.observed_by,
            }
            for b in rows
        ],
    }


@router.get("/balances/{username}", dependencies=[Depends(require_client)])
async def balance_history(
    username: str,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(Balance)
        .where(Balance.username == username)
        .order_by(Balance.observed_at.desc())
        .limit(limit)
    )).scalars().all()
    if not rows:
        raise HTTPException(404, "no observed balance for this player")

    latest = rows[0]
    return {
        "username": username,
        "latest": str(latest.amount),
        "observed_at": latest.observed_at.isoformat() if latest.observed_at else None,
        "history": [
            {
                "amount": str(b.amount),
                "observed_at": b.observed_at.isoformat() if b.observed_at else None,
            }
            for b in reversed(rows)
        ],
        "note": "Balances are only known at the moments they were seen in chat.",
    }


# ---------- per-player authentication ----------
def _cookie_secure(request: Request) -> bool:
    """Use Secure cookies whenever the request reached us over HTTPS."""
    if settings.cookie_secure:
        return True
    proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
    return request.url.scheme == "https" or proto == "https"


@router.get("/client-token")
async def client_token(request: Request, response: Response):
    """Anonymous handshake for the web app.

    Sets an HttpOnly cookie on first contact and returns a short-lived signed
    token bound to it. Both are required by the public read endpoints, so the
    app works while a raw URL pasted into another tool does not.
    """
    client_id = request.cookies.get(settings.client_cookie_name)
    if not client_id:
        client_id = secrets.token_urlsafe(24)
        response.set_cookie(
            key=settings.client_cookie_name,
            value=client_id,
            max_age=settings.client_token_ttl_seconds * 4,
            httponly=True,
            samesite="lax",
            secure=_cookie_secure(request),
            path="/api",
        )
    token, _expires_at = auth_service.issue_client_token(client_id)
    response.headers["Cache-Control"] = "no-store"
    return {"token": token, "expires_in": settings.client_token_ttl_seconds}


async def current_player(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> str:
    """Resolve the signed-in username from the session cookie, or 401."""
    token = request.cookies.get(settings.session_cookie_name)
    username = await auth_service.resolve_session(db, token)
    if not username:
        raise HTTPException(status_code=401, detail="Not signed in")
    return username


@auth_router.post("/auth/link/start", response_model=LinkStartOut)
async def link_start(
    payload: LinkStartIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_api_key),
):
    """Called by the mod after `/tracker link`; returns the code to show in chat.

    Requires the API key, which is only handed out over loopback, so a remote
    caller cannot mint codes for arbitrary players.
    """
    code, expires_at = await auth_service.create_link_code(
        db, payload.username, payload.issued_by)
    return LinkStartOut(
        username=payload.username,
        code=code,
        expires_in=settings.link_code_ttl_seconds,
        expires_at=expires_at,
    )


@router.post("/auth/link/claim")
@limiter.limit("10/minute")
async def link_claim(
    request: Request,
    payload: LinkClaimIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Exchange an in-game code for a session cookie scoped to that player."""
    username = await auth_service.claim_link_code(db, payload.code)
    if not username:
        raise HTTPException(status_code=400, detail="Invalid or expired link code")

    token, expires_at = await auth_service.issue_session(db, username)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_ttl_days * 86400,
        httponly=True,
        samesite="lax",
        secure=_cookie_secure(request),
        path="/",
    )
    return {"username": username, "expires_at": expires_at.isoformat()}


@router.get("/auth/me")
async def auth_me(me: str = Depends(current_player)):
    return {"username": me}


@router.post("/auth/logout")
async def auth_logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    await auth_service.revoke_session(
        db, request.cookies.get(settings.session_cookie_name))
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        httponly=True,
        samesite="lax",
        secure=_cookie_secure(request),
    )
    return {"status": "signed out"}


# ---------- §35 per-player private views ----------
@router.get("/me/summary")
async def me_summary(
    me: str = Depends(current_player),
    db: AsyncSession = Depends(get_db),
):
    """Private overview for the signed-in player only.

    Always scoped to the session username; no client-supplied identifier is
    accepted, so one player can never read another's private view.
    """
    spent = (await db.execute(select(func.coalesce(func.sum(Transaction.money_paid), 0))
              .where(Transaction.transaction_owner == me))).scalar_one()
    received = (await db.execute(select(func.coalesce(func.sum(Transaction.money_received), 0))
                 .where(Transaction.transaction_owner == me))).scalar_one()
    count = (await db.execute(select(func.count(Transaction.id))
             .where(Transaction.transaction_owner == me))).scalar_one()
    open_orders = (await db.execute(
        select(func.count(Order.id)).where(
            Order.owner_username == me,
            Order.status.in_(("PENDING", "PARTIALLY_FILLED")),
        ))).scalar_one()
    last_seen = (await db.execute(select(func.max(Transaction.created_at))
                 .where(Transaction.transaction_owner == me))).scalar_one()
    latest_balance = (await db.execute(
        select(Balance).where(Balance.username == me)
        .order_by(Balance.observed_at.desc()).limit(1))).scalars().first()

    return {
        "username": me,
        "observed_transactions": count,
        # Money is serialized as a string so no float rounding can creep in (§18).
        "money_spent": str(Decimal(spent)),
        "money_received": str(Decimal(received)),
        "net": str(Decimal(received) - Decimal(spent)),
        "open_orders": open_orders,
        "last_observed_at": last_seen.isoformat() if last_seen else None,
        "balance": str(latest_balance.amount) if latest_balance else None,
        "balance_observed_at": (latest_balance.observed_at.isoformat()
                                if latest_balance and latest_balance.observed_at else None),
    }


@router.get("/me/transactions")
async def me_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    type: Optional[str] = None,
    item: Optional[str] = None,
    me: str = Depends(current_player),
    db: AsyncSession = Depends(get_db),
):
    q = (select(Transaction)
         .where(Transaction.transaction_owner == me)
         .order_by(Transaction.created_at.desc()))
    if type:
        q = q.where(Transaction.transaction_type == type)
    if item:
        q = q.where(Transaction.item_name.ilike(f"%{item}%"))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.limit(limit).offset((page - 1) * limit))).scalars().all()
    return {"total": total, "page": page, "limit": limit,
            "items": [TransactionOut.model_validate(r).model_dump(mode="json") for r in rows]}


@router.get("/me/orders")
async def me_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    me: str = Depends(current_player),
    db: AsyncSession = Depends(get_db),
):
    q = (select(Order)
         .where((Order.owner_username == me) | (Order.seller_username == me)
                | (Order.buyer_username == me))
         .order_by(Order.created_at.desc()))
    if status:
        q = q.where(Order.status == status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.limit(limit).offset((page - 1) * limit))).scalars().all()
    return {"total": total, "page": page, "limit": limit,
            "items": [{
                "id": o.id, "owner_username": o.owner_username,
                "seller_username": o.seller_username, "buyer_username": o.buyer_username,
                "item_name": o.item_name, "quantity": o.quantity,
                "fulfilled_quantity": o.fulfilled_quantity,
                "remaining_quantity": o.remaining_quantity,
                "status": o.status, "created_at": o.created_at,
                "completed_at": o.completed_at,
            } for o in rows]}


@router.get("/me/balance")
async def me_balance(
    limit: int = Query(100, ge=1, le=500),
    me: str = Depends(current_player),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(Balance).where(Balance.username == me)
        .order_by(Balance.observed_at.desc()).limit(limit))).scalars().all()
    if not rows:
        return {"username": me, "latest": None, "observed_at": None, "history": []}
    return {
        "username": me,
        "latest": str(rows[0].amount),
        "observed_at": rows[0].observed_at.isoformat() if rows[0].observed_at else None,
        "history": [
            {"amount": str(b.amount),
             "observed_at": b.observed_at.isoformat() if b.observed_at else None}
            for b in reversed(rows)
        ],
    }


@router.get("/me/analytics")
async def me_analytics(
    days: int = Query(30, ge=1, le=365),
    me: str = Depends(current_player),
    db: AsyncSession = Depends(get_db),
):
    """Profit and loss breakdown for the signed-in player.

    Everything here is derived from the player's own transactions so the personal
    dashboard can be about spending, earning and net position only. Money is
    returned as strings to stay exact (§18).
    """
    mine = Transaction.transaction_owner == me
    paid = func.coalesce(func.sum(Transaction.money_paid), 0)
    got = func.coalesce(func.sum(Transaction.money_received), 0)

    total_spent = Decimal((await db.execute(select(paid).where(mine))).scalar_one())
    total_received = Decimal((await db.execute(select(got).where(mine))).scalar_one())

    # Daily series for the requested window, used for the profit/loss chart.
    since = datetime.now(timezone.utc) - timedelta(days=days)
    day = func.date(Transaction.created_at).label("day")
    daily_rows = (await db.execute(
        select(day, paid.label("spent"), got.label("received"))
        .where(mine, Transaction.created_at >= since)
        .group_by(day)
        .order_by(day)
    )).all()

    # Per-item profit and loss: what was paid out versus earned back.
    item_rows = (await db.execute(
        select(
            Transaction.item_name.label("item"),
            paid.label("spent"),
            got.label("received"),
            func.count(Transaction.id).label("count"),
        )
        .where(mine, Transaction.item_name.isnot(None))
        .group_by(Transaction.item_name)
        .order_by(func.count(Transaction.id).desc())
        .limit(50)
    )).all()

    type_rows = (await db.execute(
        select(
            Transaction.transaction_type.label("type"),
            func.count(Transaction.id).label("count"),
            paid.label("spent"),
            got.label("received"),
        )
        .where(mine)
        .group_by(Transaction.transaction_type)
        .order_by(func.count(Transaction.id).desc())
    )).all()

    buys = (await db.execute(
        select(func.count(Transaction.id))
        .where(mine, Transaction.transaction_type.in_(("BUY", "PAYMENT_SENT"))))).scalar_one()
    sells = (await db.execute(
        select(func.count(Transaction.id))
        .where(mine, Transaction.transaction_type.in_(
            ("SELL", "PAYMENT_RECEIVED", "ORDER_DELIVERY"))))).scalar_one()

    items = []
    for r in item_rows:
        s, g = Decimal(r.spent or 0), Decimal(r.received or 0)
        items.append({
            "item": r.item, "spent": str(s), "received": str(g),
            "net": str(g - s), "count": r.count,
        })
    items.sort(key=lambda x: Decimal(x["net"]), reverse=True)

    return {
        "username": me,
        "days": days,
        "totals": {
            "spent": str(total_spent),
            "received": str(total_received),
            "net": str(total_received - total_spent),
            "buys": buys,
            "sells": sells,
        },
        "daily": [
            {
                "date": str(r.day),
                "spent": str(Decimal(r.spent or 0)),
                "received": str(Decimal(r.received or 0)),
                "net": str(Decimal(r.received or 0) - Decimal(r.spent or 0)),
            }
            for r in daily_rows
        ],
        "items": items,
        "types": [
            {
                "type": r.type, "count": r.count,
                "spent": str(Decimal(r.spent or 0)),
                "received": str(Decimal(r.received or 0)),
            }
            for r in type_rows
        ],
    }


# ---------- §35 friends (a manual list, scoped to the signed-in player) ----------
MAX_FRIENDS = 100


async def _resolve_canonical_username(db: AsyncSession, username: str) -> str:
    """Prefer the exact casing a player was actually observed under.

    Usernames are matched case-insensitively on input so `sidewayzzzz` still
    finds `SideWayzzzz`, but the stored value is the observed casing when we
    know it, which is what the transaction and balance tables key on.
    """
    row = (await db.execute(
        select(Player.username).where(func.lower(Player.username) == username.lower())
    )).scalars().first()
    if row:
        return row
    row = (await db.execute(
        select(Balance.username).where(func.lower(Balance.username) == username.lower())
    )).scalars().first()
    return row or username


async def _friend_summaries(
    db: AsyncSession, usernames: list[str]
) -> dict[str, dict]:
    """Observed aggregates for the given players, keyed by username.

    A friend may not have been observed at all yet; those players simply get
    zeroed counters so the card can say "no activity seen".
    """
    summaries: dict[str, dict] = {
        u: {
            "username": u,
            "observed_transactions": 0,
            "money_spent": "0",
            "money_received": "0",
            "net": "0",
            "last_observed_at": None,
            "balance": None,
            "balance_observed_at": None,
            "saw_activity": False,
        }
        for u in usernames
    }
    if not usernames:
        return summaries

    aggregates = (await db.execute(
        select(
            Transaction.transaction_owner.label("username"),
            func.count(Transaction.id).label("count"),
            func.coalesce(func.sum(Transaction.money_paid), 0).label("spent"),
            func.coalesce(func.sum(Transaction.money_received), 0).label("received"),
            func.max(Transaction.created_at).label("last_seen"),
        )
        .where(Transaction.transaction_owner.in_(usernames))
        .group_by(Transaction.transaction_owner)
    )).all()
    for r in aggregates:
        spent, received = Decimal(r.spent or 0), Decimal(r.received or 0)
        summaries[r.username].update({
            "observed_transactions": r.count,
            "money_spent": str(spent),
            "money_received": str(received),
            "net": str(received - spent),
            "last_observed_at": r.last_seen.isoformat() if r.last_seen else None,
            "saw_activity": True,
        })

    newest = (
        select(Balance.username, func.max(Balance.observed_at).label("observed_at"))
        .where(Balance.username.in_(usernames))
        .group_by(Balance.username)
        .subquery()
    )
    balances = (await db.execute(
        select(Balance.username, Balance.amount, Balance.observed_at)
        .join(newest, (Balance.username == newest.c.username)
              & (Balance.observed_at == newest.c.observed_at))
    )).all()
    for b in balances:
        summaries[b.username]["balance"] = str(b.amount)
        summaries[b.username]["balance_observed_at"] = (
            b.observed_at.isoformat() if b.observed_at else None)

    return summaries


@router.get("/me/friends")
async def me_friends(
    me: str = Depends(current_player),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(Friend).where(Friend.owner_username == me)
        .order_by(Friend.friend_username))).scalars().all()
    summaries = await _friend_summaries(db, [r.friend_username for r in rows])
    return {
        "username": me,
        "total": len(rows),
        "items": [
            {**summaries[r.friend_username], "added_at": r.created_at.isoformat() if r.created_at else None}
            for r in rows
        ],
    }


@router.post("/me/friends", status_code=201)
async def add_friend(
    payload: FriendIn,
    me: str = Depends(current_player),
    db: AsyncSession = Depends(get_db),
):
    username = await _resolve_canonical_username(db, payload.username)
    if username.lower() == me.lower():
        raise HTTPException(400, "You cannot add yourself as a friend")

    count = (await db.execute(
        select(func.count(Friend.id)).where(Friend.owner_username == me))).scalar_one()
    if count >= MAX_FRIENDS:
        raise HTTPException(400, f"Friends list is full (max {MAX_FRIENDS})")

    db.add(Friend(owner_username=me, friend_username=username))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, f"{username} is already in your friends list")

    summary = (await _friend_summaries(db, [username]))[username]
    return {**summary, "added_at": None}


@router.delete("/me/friends/{username}")
async def remove_friend(
    username: str,
    me: str = Depends(current_player),
    db: AsyncSession = Depends(get_db),
):
    friend = (await db.execute(
        select(Friend).where(
            Friend.owner_username == me,
            func.lower(Friend.friend_username) == username.lower(),
        ))).scalars().first()
    if not friend:
        raise HTTPException(404, "Not in your friends list")
    await db.delete(friend)
    await db.commit()
    return {"status": "removed", "username": friend.friend_username}


# ---------- §29 dashboard lifecycle ----------
def _start_dashboard_process() -> Optional[subprocess.Popen]:
    global _dashboard_proc
    if _dashboard_proc and _dashboard_proc.poll() is None:
        return _dashboard_proc
    _dashboard_proc = subprocess.Popen([
        sys.executable, "-m", "uvicorn", "app.dashboard:app",
        "--host", "127.0.0.1", "--port", str(settings.dashboard_port),
    ], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return _dashboard_proc


def _stop_dashboard_process():
    global _dashboard_proc
    if _dashboard_proc and _dashboard_proc.poll() is None:
        _dashboard_proc.terminate()
        try:
            _dashboard_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _dashboard_proc.kill()
    _dashboard_proc = None


@auth_router.post("/dashboard/start")
async def dashboard_start(_=Depends(require_api_key)):
    _start_dashboard_process()
    return {"url": f"http://localhost:{settings.dashboard_port}", "status": "started"}


@auth_router.post("/dashboard/stop")
async def dashboard_stop(_=Depends(require_api_key)):
    _stop_dashboard_process()
    return {"status": "stopped"}


@auth_router.post("/dashboard/restart")
async def dashboard_restart(_=Depends(require_api_key)):
    _stop_dashboard_process()
    _start_dashboard_process()
    return {"url": f"http://localhost:{settings.dashboard_port}", "status": "restarted"}


# ---------- §28 WebSocket ----------
ws_router = APIRouter()

@ws_router.websocket("/ws/transactions")
async def ws_transactions(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()   # keepalive / client pings
    except WebSocketDisconnect:
        manager.disconnect(ws)
