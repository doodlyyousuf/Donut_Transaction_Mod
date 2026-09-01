from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from sqlalchemy import (String, Integer, Boolean, Text, DateTime, Numeric,
                        ForeignKey, Index, func)
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Player(Base):
    __tablename__ = "players"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Server(Base):
    __tablename__ = "servers"
    id: Mapped[int] = mapped_column(primary_key=True)
    address: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(64), default="donutsmp")


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_username: Mapped[str] = mapped_column(String(32), index=True)
    seller_username: Mapped[str | None] = mapped_column(String(32), index=True)
    buyer_username: Mapped[str | None] = mapped_column(String(32), index=True)
    item_name: Mapped[str | None] = mapped_column(String(128), index=True)
    quantity: Mapped[int | None]
    fulfilled_quantity: Mapped[int] = mapped_column(Integer, default=0)
    remaining_quantity: Mapped[int | None]
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 2))
    total_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 2))
    status: Mapped[str] = mapped_column(String(16), default="PENDING", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # §19
    server: Mapped[str] = mapped_column(String(64), index=True)
    server_address: Mapped[str | None] = mapped_column(String(128))
    transaction_type: Mapped[str] = mapped_column(String(32), index=True)
    source: Mapped[str | None] = mapped_column(String(32))
    status: Mapped[str | None] = mapped_column(String(16))

    transaction_owner: Mapped[str] = mapped_column(String(32), index=True)
    observed_by: Mapped[str] = mapped_column(String(32), index=True)
    buyer_username: Mapped[str | None] = mapped_column(String(32), index=True)
    seller_username: Mapped[str | None] = mapped_column(String(32), index=True)
    recipient_username: Mapped[str | None] = mapped_column(String(32), index=True)

    item_name: Mapped[str | None] = mapped_column(String(128), index=True)
    item_id: Mapped[str | None] = mapped_column(String(128))
    quantity: Mapped[int | None]

    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 2))
    total_price: Mapped[Decimal | None] = mapped_column(Numeric(20, 2))
    money_paid: Mapped[Decimal | None] = mapped_column(Numeric(20, 2))
    money_received: Mapped[Decimal | None] = mapped_column(Numeric(20, 2))
    net_amount: Mapped[Decimal | None] = mapped_column(Numeric(20, 2))

    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), index=True)
    order = relationship("Order")

    raw_message: Mapped[str] = mapped_column(Text)
    normalized_message: Mapped[str] = mapped_column(Text)
    parsed_successfully: Mapped[bool] = mapped_column(Boolean, default=True)

    minecraft_timestamp: Mapped[str | None] = mapped_column(String(16))
    server_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_tx_owner_type_time", "transaction_owner", "transaction_type", "created_at"),
        Index("ix_tx_item_time", "item_name", "created_at"),
    )


class TransactionEvent(Base):
    __tablename__ = "transaction_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), index=True)
    transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(32))
    quantity: Mapped[int | None]
    price: Mapped[Decimal | None] = mapped_column(Numeric(20, 2))
    player: Mapped[str | None] = mapped_column(String(32))
    raw_message: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
