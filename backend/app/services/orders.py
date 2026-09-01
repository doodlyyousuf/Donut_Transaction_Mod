from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Order, Transaction, TransactionEvent

MATCH_WINDOW = timedelta(hours=6)


async def link_delivery(db: AsyncSession, tx: Transaction) -> bool:
    """Match an ORDER_DELIVERY to a pending order for the recipient.

    Never merges on weak evidence: requires exact item match AND buyer match;
    quantity and seller act as tiebreakers. Returns True when linked."""
    if tx.transaction_type != "ORDER_DELIVERY" or not tx.item_name:
        return False

    stmt = (
        select(Order)
        .where(Order.item_name == tx.item_name)
        .where(Order.status.in_(("PENDING", "PARTIALLY_FILLED")))
        .where(Order.created_at >= datetime.utcnow() - MATCH_WINDOW)
        .order_by(Order.created_at.desc())
    )
    if tx.buyer_username:
        stmt = stmt.where(
            (Order.buyer_username == tx.buyer_username)
            | (Order.owner_username == tx.buyer_username))
    orders = (await db.execute(stmt)).scalars().all()
    if not orders:
        return False

    best = None
    for o in orders:
        if tx.seller_username and o.seller_username and tx.seller_username != o.seller_username:
            continue
        if o.quantity and tx.quantity and tx.quantity > (o.remaining_quantity or o.quantity):
            continue
        best = o
        break   # newest passing candidate

    if best is None:
        return False

    tx.order_id = best.id
    best.fulfilled_quantity = (best.fulfilled_quantity or 0) + (tx.quantity or 0)
    remaining = (best.quantity or 0) - best.fulfilled_quantity
    best.remaining_quantity = max(remaining, 0)
    best.status = "COMPLETED" if remaining <= 0 else "PARTIALLY_FILLED"
    if best.status == "COMPLETED":
        best.completed_at = datetime.utcnow()

    db.add(TransactionEvent(
        order_id=best.id, transaction_id=tx.id, event_type="ORDER_DELIVERY",
        quantity=tx.quantity, player=tx.seller_username, raw_message=tx.raw_message))
    return True
