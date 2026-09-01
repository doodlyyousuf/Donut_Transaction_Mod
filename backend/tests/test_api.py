import asyncio, os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["API_KEY"] = "test-key"
os.environ["AUTO_CREATE_TABLES"] = "1"

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.database import engine, Base
import app.models  # noqa

TX = {
    "server": "donutsmp", "server_address": "asia.donutsmp.net",
    "transaction_type": "LIST", "transaction_owner": "RealSwitchy",
    "observed_by": "Doodly_yousuf", "seller_username": "RealSwitchy",
    "item_name": "Dried Kelp Block", "quantity": 64,
    "total_price": "59000", "raw_message": "RealSwitchy listed 64 Dried Kelp Block for $ 59K",
    "normalized_message": "RealSwitchy listed 64 Dried Kelp Block for $ 59K",
    "fingerprint": "fp-" + "x" * 60,
}


@pytest.fixture(scope="module")
def anyio_backend(): return "asyncio"


@pytest.fixture(scope="module")
async def client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncClient(transport=ASGITransport(app=app),
                           base_url="http://test") as c:
        yield c


@pytest.mark.anyio
async def test_auth_required(client):
    r = await client.post("/api/transactions/bulk", json={"transactions": [TX]})
    assert r.status_code == 401
    r = await client.get("/api/transactions")
    assert r.status_code == 401


@pytest.mark.anyio
async def test_insert_then_duplicate_is_ignored(client):
    headers = {"X-API-Key": "test-key"}
    r = await client.post("/api/transactions/bulk", json={"transactions": [TX]}, headers=headers)
    assert r.status_code == 200 and r.json()["inserted"] == 1

    r2 = await client.post("/api/transactions/bulk", json={"transactions": [TX]}, headers=headers)
    assert r2.json()["inserted"] == 0 and r2.json()["duplicates"] == 1


@pytest.mark.anyio
async def test_filters_and_pagination(client):
    headers = {"X-API-Key": "test-key"}
    r = await client.get("/api/transactions", params={"player": "RealSwitchy", "type": "LIST"}, headers=headers)
    assert r.status_code == 200 and r.json()["total"] == 1

    r2 = await client.get("/api/transactions", params={"page": 1, "limit": 1}, headers=headers)
    assert len(r2.json()["items"]) == 1

    r3 = await client.get("/api/transactions", params={"item": "nope"}, headers=headers)
    assert r3.json()["total"] == 0


@pytest.mark.anyio
async def test_bootstrap_returns_generated_key(client):
    r = await client.get("/api/bootstrap")
    assert r.status_code == 200 and r.json()["api_key"] == "test-key"
