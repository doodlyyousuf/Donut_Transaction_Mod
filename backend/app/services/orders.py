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


def _normalize_item(name: str | None) -> str:
    """DonutSMP is inconsistent about plurals ("Emeralds" when ordering,
    "Emerald" when the order completes), so compare without the trailing s."""
    return (name or "").strip().rstrip("s").lower()


async def _open_order(db: AsyncSession, tx: Transaction, lenient: bool = False) -> Order | None:
    """Newest still-open order for this buyer, filtered by item when possible."""
    owner = tx.buyer_username or tx.transaction_owner
    stmt = (
        select(Order)
        .where(Order.owner_username == owner)
        .where(Order.status.in_(("PENDING", "PARTIALLY_FILLED")))
        .order_by(Order.created_at.desc())
    )
    if not lenient:
        stmt = stmt.where(Order.item_name == tx.item_name)
        return (await db.execute(stmt)).scalars().first()

    want = _normalize_item(tx.item_name)
    candidates = (await db.execute(stmt)).scalars().all()
    for order in candidates:
        if _normalize_item(order.item_name) == want:
            return order
    return None


async def apply_order_lifecycle(db: AsyncSession, tx: Transaction) -> bool:
    """Create an Order from an ORDER_CREATED event and close it on ORDER_COMPLETED.

    This is what makes the Orders view populate from chat alone; deliveries are
    already attached by link_delivery."""
    if not tx.item_name:
        return False

    if tx.transaction_type == "ORDER_CREATED":
        existing = await _open_order(db, tx)
        if existing is not None:
            # Same order re-announced: widen the target instead of duplicating.
            if tx.quantity:
                existing.quantity = max(existing.quantity or 0, tx.quantity)
                existing.remaining_quantity = max(
                    (existing.quantity or 0) - (existing.fulfilled_quantity or 0), 0)
            return False

        db.add(Order(
            owner_username=tx.buyer_username or tx.transaction_owner,
            buyer_username=tx.buyer_username or tx.transaction_owner,
            item_name=tx.item_name,
            quantity=tx.quantity,
            fulfilled_quantity=0,
            remaining_quantity=tx.quantity,
            unit_price=tx.unit_price,
            total_price=tx.total_price,
            status="PENDING",
        ))
        await db.flush()
        return True

    if tx.transaction_type == "ORDER_COMPLETED":
        order = await _open_order(db, tx, lenient=True)
        if order is None:
            return False
        order.fulfilled_quantity = order.quantity or order.fulfilled_quantity
        order.remaining_quantity = 0
        order.status = "COMPLETED"
        order.completed_at = datetime.utcnow()
        tx.order_id = order.id
        return True

    return False
