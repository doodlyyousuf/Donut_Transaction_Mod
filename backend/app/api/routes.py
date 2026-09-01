from __future__ import annotations
import asyncio, subprocess, sys, os
from datetime import datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header, WebSocket, WebSocketDisconnect
from sqlalchemy import select, func, insert as sa_insert
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings
from app.database import get_db
from app.models import Transaction, Order, Player, TransactionEvent
from app.schemas import BulkIn, BulkResult, TransactionOut, StatsOut
from app.services.orders import link_delivery
from app.websocket import manager

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/api")  # auth-protected endpoints

_dashboard_proc: Optional[subprocess.Popen] = None


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


# ---------- §27 REST ----------
@router.get("/health")
async def health():
    return {"status": "ok"}


def _to_row(t) -> dict:
    d = t.model_dump(exclude={"id"})
    d["created_at"] = d.get("created_at") or datetime.utcnow()
    return d


@auth_router.post("/transactions/bulk", response_model=BulkResult)
async def create_transactions_bulk(
    payload: BulkIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_api_key),
):
    received = len(payload.transactions)
    inserted = 0

    for t in payload.transactions:
        values = t.model_dump(exclude={"id"})
        if not values.get("fingerprint"):
            continue
        stmt = (
            pg_insert(Transaction)
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
            await manager.broadcast({                 # §28 real-time push
                "event": "transaction",
                "data": TransactionOut.model_validate(row).model_dump(mode="json"),
            })

    # upsert player/server dimension rows (best-effort)
    for name in {t.transaction_owner for t in payload.transactions} | \
                {t.observed_by for t in payload.transactions}:
        await db.execute(pg_insert(Player).values(username=name)
                         .on_conflict_do_nothing(index_elements=["username"]))
    await db.commit()

    return BulkResult(received=received, inserted=inserted,
                      duplicates=received - inserted)


@auth_router.get("/transactions")
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
    _=Depends(require_api_key),
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


@router.get("/transactions/{tx_id}", response_model=TransactionOut)
async def get_transaction(tx_id: int, db: AsyncSession = Depends(get_db)):
    row = await db.get(Transaction, tx_id)
    if row is None:
        raise HTTPException(404, "transaction not found")
    return row


@router.get("/orders")
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


@router.get("/orders/{order_id}")
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    o = await db.get(Order, order_id)
    if o is None:
        raise HTTPException(404, "order not found")
    events = (await db.execute(select(TransactionEvent)
               .where(TransactionEvent.order_id == order_id))).scalars().all()
    return {"order": {c.name: getattr(o, c.name) for c in o.__table__.columns},
            "events": [{c.name: str(getattr(e, c.name)) for c in e.__table__.columns}
                       for e in events]}


@router.get("/players")
async def list_players(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Player.username, func.count(Transaction.id).label("tx_count"))
        .join(Transaction, Transaction.transaction_owner == Player.username)
        .group_by(Player.username)
        .order_by(func.count(Transaction.id).desc()))).all()
    return [{"username": r.username, "observed_transactions": r.tx_count} for r in rows]


@router.get("/players/{username}")
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


@router.get("/stats", response_model=StatsOut)
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


@router.get("/stats/player/{username}")
async def stats_player(username: str, db: AsyncSession = Depends(get_db)):
    q = select(func.count(Transaction.id)).where(Transaction.transaction_owner == username)
    return {"username": username,
            "transactions": (await db.execute(q)).scalar_one()}


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
