from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator

TransactionType = Literal[
    "BUY", "SELL", "LIST", "ORDER_CREATED", "ORDER_FILLED", "ORDER_COMPLETED",
    "ORDER_DELIVERY", "ORDER_CANCELLED", "PAYMENT_SENT", "PAYMENT_RECEIVED", "UNKNOWN"]


class TransactionIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    server: str = "donutsmp"
    server_address: Optional[str] = None
    transaction_type: TransactionType
    source: Optional[str] = None
    status: Optional[str] = None
    transaction_owner: str
    observed_by: str
    buyer_username: Optional[str] = None
    seller_username: Optional[str] = None
    recipient_username: Optional[str] = None
    item_name: Optional[str] = None
    item_id: Optional[str] = None
    quantity: Optional[int] = None
    unit_price: Optional[str] = None      # "440000" string → Decimal, no float
    total_price: Optional[str] = None
    money_paid: Optional[str] = None
    money_received: Optional[str] = None
    net_amount: Optional[str] = None
    order_id: Optional[int] = None

    @field_validator('unit_price', 'total_price', 'money_paid', 'money_received', 'net_amount', mode='before')
    @classmethod
    def parse_money(cls, v: Any) -> Optional[Decimal]:
        if v is None:
            return None
        if isinstance(v, Decimal):
            return v
        if isinstance(v, str):
            try:
                return Decimal(v)
            except:
                return None
        return None
    raw_message: str
    normalized_message: Optional[str] = None
    parsed_successfully: bool = True
    minecraft_timestamp: Optional[str] = None
    fingerprint: Optional[str] = Field(None, max_length=64)


class BulkIn(BaseModel):
    transactions: list[TransactionIn]


class TransactionOut(BaseModel):
    id: int
    server: str
    server_address: Optional[str]
    transaction_type: TransactionType
    source: Optional[str]
    status: Optional[str]
    transaction_owner: str
    observed_by: str
    buyer_username: Optional[str]
    seller_username: Optional[str]
    recipient_username: Optional[str]
    item_name: Optional[str]
    item_id: Optional[str]
    quantity: Optional[int]
    unit_price: Optional[Decimal]
    total_price: Optional[Decimal]
    money_paid: Optional[Decimal]
    money_received: Optional[Decimal]
    net_amount: Optional[Decimal]
    order_id: Optional[int]
    raw_message: str
    normalized_message: Optional[str]
    parsed_successfully: bool
    minecraft_timestamp: Optional[str]
    fingerprint: Optional[str]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class BulkResult(BaseModel):
    received: int
    inserted: int
    duplicates: int


class StatsOut(BaseModel):
    total_transactions: int
    total_money_spent: Decimal
    total_money_received: Decimal
    net: Decimal
    orders: int
    players_observed: int
