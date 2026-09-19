import asyncio, os
from decimal import Decimal
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["API_KEY"] = "test-key"
os.environ["AUTO_CREATE_TABLES"] = "1"

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.database import engine, Base
import app.models as _models  # noqa: F401

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
        # Complete the anonymous handshake once and send its token on every
        # request, the way the web app does. Gate-specific tests use a bare
        # client that skips this.
        r = await c.get("/api/client-token")
        assert r.status_code == 200, r.text
        c.headers["X-Client-Token"] = r.json()["token"]
        yield c


def _bare_client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.anyio
async def test_auth_required(client):
    r = await client.post("/api/transactions/bulk", json={"transactions": [TX]})
    assert r.status_code == 401
    r = await client.post("/api/dashboard/start")
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


@pytest.mark.anyio
async def test_bootstrap_refuses_browser_requests(client):
    """The API key must never reach client-side JavaScript."""
    for headers in (
        {"Origin": "http://localhost:18701"},
        {"Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors"},
    ):
        r = await client.get("/api/bootstrap", headers=headers)
        assert r.status_code == 403, headers
        assert "api_key" not in r.json()


@pytest.mark.anyio
async def test_bootstrap_refuses_forwarded_requests(client):
    """A reverse proxy peer must not be able to relay the key."""
    r = await client.get("/api/bootstrap", headers={"X-Forwarded-For": "203.0.113.9"})
    assert r.status_code == 403


@pytest.mark.anyio
async def test_read_endpoints_require_handshake(client):
    """A bare URL with no handshake is refused, unlike the app's own requests."""
    async with _bare_client() as bare:
        for path in ("/api/transactions", "/api/leaderboards",
                     "/api/leaderboards/money", "/api/players/TestUser/donutstats"):
            r = await bare.get(path)
            assert r.status_code == 401, (path, r.status_code)


@pytest.mark.anyio
async def test_handshake_token_grants_read_access(client):
    r = await client.get("/api/transactions")
    assert r.status_code == 200 and "items" in r.json()


@pytest.mark.anyio
async def test_handshake_needs_both_cookie_and_token():
    async with _bare_client() as one, _bare_client() as two:
        good = await one.get("/api/client-token")
        assert good.status_code == 200
        token = good.json()["token"]

        # Cookie but no token header.
        r = await one.get("/api/leaderboards")
        assert r.status_code == 401

        # Token but no cookie.
        r = await two.get("/api/leaderboards", headers={"X-Client-Token": token})
        assert r.status_code == 401


@pytest.mark.anyio
async def test_handshake_rejects_forged_tokens():
    from app.services import auth

    async with _bare_client() as bare:
        good = await bare.get("/api/client-token")
        client_id = good.cookies.get("dtt_client")
        assert client_id

        token = auth.issue_client_token(client_id)[0]
        assert auth.verify_client_token(client_id, token) is True
        # A token minted for someone else, or with a fake expiry, must not pass.
        assert auth.verify_client_token("someone-else", token) is False
        assert auth.verify_client_token(client_id, "9999999999.deadbeef") is False
        assert auth.verify_client_token(client_id, "") is False


@pytest.mark.anyio
async def test_order_lifecycle_from_chat(client):
    """ORDER_CREATED opens an Order, deliveries fulfil it, ORDER_COMPLETED closes it."""
    headers = {"X-API-Key": "test-key"}

    def event(raw, ttype, item=None, qty=None, **kw):
        row = dict(TX, transaction_type=ttype, item_name=item, quantity=qty,
                   raw_message=raw, normalized_message=raw,
                   fingerprint="fp-" + raw, source="ORDER", status="PENDING",
                   transaction_owner="Doodly_yousuf", buyer_username="Doodly_yousuf",
                   seller_username=kw.get("seller_username"), total_price=None)
        return row

    rows = [
        event("You ordered 1K Emeralds", "ORDER_CREATED", "Emeralds", 1000),
        event(".AngryCargo40826 delivered you 2 Emeralds", "ORDER_DELIVERY", "Emeralds", 2,
              seller_username="AngryCargo40826"),
        event(".Degrotegame delivered you 6 Emeralds", "ORDER_DELIVERY", "Emeralds", 6,
              seller_username="Degrotegame"),
    ]
    r = await client.post("/api/transactions/bulk", json={"transactions": rows}, headers=headers)
    assert r.status_code == 200 and r.json()["inserted"] == 3

    orders = (await client.get("/api/orders", headers=headers)).json()["items"]
    assert len(orders) == 1
    order = orders[0]
    assert order["item_name"] == "Emeralds"
    assert order["quantity"] == 1000
    assert order["fulfilled_quantity"] == 8          # deliveries were linked
    assert order["remaining_quantity"] == 992
    assert order["status"] == "PARTIALLY_FILLED"

    # Re-announcing the same order must not duplicate it.
    again = await client.post("/api/transactions/bulk",
                              json={"transactions": [event("You ordered 1K Emeralds", "ORDER_CREATED", "Emeralds", 1000)]},
                              headers={**headers})
    assert again.json()["inserted"] == 0
    assert len((await client.get("/api/orders", headers=headers)).json()["items"]) == 1

    # Completion message uses the singular item name; it must still match.
    done = event("Your Emerald order is complete!", "ORDER_COMPLETED", "Emerald")
    await client.post("/api/transactions/bulk", json={"transactions": [done]}, headers=headers)
    orders = (await client.get("/api/orders", headers=headers)).json()["items"]
    assert orders[0]["status"] == "COMPLETED"
    assert orders[0]["remaining_quantity"] == 0


@pytest.mark.anyio
async def test_balances_separate_from_money_totals(client):
    """BALANCE snapshots land in their own table and never affect money totals."""
    headers = {"X-API-Key": "test-key"}

    def balance(raw, who, amount):
        return dict(TX, transaction_type="BALANCE", transaction_owner=who,
                    raw_message=raw, normalized_message=raw,
                    fingerprint="bal-" + raw, source="BALANCE", status="OBSERVED",
                    total_price=amount, quantity=None, item_name=None,
                    money_paid=None, money_received=None,
                    buyer_username=None, seller_username=None)

    rows = [
        balance("$100,982,091", "Doodly_yousuf", "100982091"),
        balance("F18 has $ 105K", "F18", "105000"),
    ]
    before = (await client.get("/api/stats", headers=headers)).json()

    r = await client.post("/api/transactions/bulk", json={"transactions": rows}, headers=headers)
    assert r.status_code == 200

    # A balance is a snapshot, not income: money totals must be untouched.
    after = (await client.get("/api/stats", headers=headers)).json()
    assert after["total_transactions"] == before["total_transactions"]
    assert after["total_money_received"] == before["total_money_received"]

    board = (await client.get("/api/balances", headers=headers)).json()
    assert board["total"] == 2
    assert [b["username"] for b in board["items"]] == ["Doodly_yousuf", "F18"]
    assert board["items"][1]["amount"] == "105000.00"

    hist = (await client.get("/api/balances/F18", headers=headers)).json()
    assert hist["latest"] == "105000.00"
    assert len(hist["history"]) == 1

    missing = await client.get("/api/balances/Nobody", headers=headers)
    assert missing.status_code == 404


async def _start_link(client, username):
    r = await client.post("/api/auth/link/start",
                          json={"username": username}, headers={"X-API-Key": "test-key"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["code"]) == 6 and body["username"] == username
    return body["code"]


@pytest.mark.anyio
async def test_link_flow_scopes_private_views(client):
    """A link code proves in-game presence and yields a username-scoped session."""
    headers = {"X-API-Key": "test-key"}
    client.cookies.delete("dtt_session")

    # The mod cannot mint codes without the API key.
    r = await client.post("/api/auth/link/start", json={"username": "AuthUser"})
    assert r.status_code == 401

    # Private views are closed until a session exists.
    client.cookies.delete("dtt_session")
    assert (await client.get("/api/auth/me")).status_code == 401
    assert (await client.get("/api/me/summary")).status_code == 401

    code = await _start_link(client, "AuthUser")

    # A bad code is rejected and leaves us signed out.
    bad = await client.post("/api/auth/link/claim", json={"code": "000000"})
    assert bad.status_code == 400
    assert (await client.get("/api/auth/me")).status_code == 401

    claim = await client.post("/api/auth/link/claim", json={"code": code})
    assert claim.status_code == 200 and claim.json()["username"] == "AuthUser"
    assert (await client.get("/api/auth/me")).json()["username"] == "AuthUser"

    # Codes are single use.
    again = await client.post("/api/auth/link/claim", json={"code": code})
    assert again.status_code == 400

    # Seed activity for the signed-in player and for somebody else.
    def tx(raw, owner, ttype="SELL", price=None):
        return dict(TX, transaction_type=ttype, transaction_owner=owner,
                    raw_message=raw, normalized_message=raw, fingerprint="auth-" + raw,
                    money_received=price, money_paid=None, total_price=price)

    rows = [
        tx("AuthUser sold a thing", "AuthUser", price="5000"),
        tx("OtherGuy sold a thing", "OtherGuy", price="9999"),
    ]
    assert (await client.post("/api/transactions/bulk",
                              json={"transactions": rows}, headers=headers)).status_code == 200

    summary = (await client.get("/api/me/summary")).json()
    assert summary["username"] == "AuthUser"
    assert summary["observed_transactions"] == 1          # OtherGuy is invisible
    assert summary["money_received"] == "5000.00"

    mine = (await client.get("/api/me/transactions")).json()
    assert mine["total"] == 1
    assert mine["items"][0]["transaction_owner"] == "AuthUser"

    # Signing out closes the private views again.
    assert (await client.post("/api/auth/logout")).status_code == 200
    client.cookies.delete("dtt_session")
    assert (await client.get("/api/me/summary")).status_code == 401


@pytest.mark.anyio
async def test_new_code_revokes_previous(client):
    client.cookies.delete("dtt_session")
    first = await _start_link(client, "AuthUser")
    second = await _start_link(client, "AuthUser")
    assert first != second

    stale = await client.post("/api/auth/link/claim", json={"code": first})
    assert stale.status_code == 400                       # revoked by the new code

    fresh = await client.post("/api/auth/link/claim", json={"code": second})
    assert fresh.status_code == 200
    client.cookies.delete("dtt_session")


@pytest.mark.anyio
async def test_session_cookie_is_httponly_and_hashed(client):
    """The session cookie must be unreadable by JS and unrecoverable from the DB."""
    from sqlalchemy import select as sa_select
    from app.database import SessionLocal
    from app.models import PlayerSession
    from app.services.auth import hash_token

    client.cookies.delete("dtt_session")
    code = await _start_link(client, "AuthUser")
    r = await client.post("/api/auth/link/claim", json={"code": code})
    assert r.status_code == 200

    raw = r.cookies.get("dtt_session")
    assert raw, "expected a session cookie"

    header = r.headers["set-cookie"].lower()
    assert "httponly" in header and "samesite=lax" in header

    async with SessionLocal() as session:
        hashes = (await session.execute(sa_select(PlayerSession.token_hash))).scalars().all()
    assert hash_token(raw) in hashes          # only the digest is stored
    assert raw not in hashes                  # never the token itself

    client.cookies.delete("dtt_session")


@pytest.mark.anyio
async def test_personal_analytics_profit_and_loss(client):
    """Personal analytics are scoped to the signed-in player's own money."""
    headers = {"X-API-Key": "test-key"}
    client.cookies.delete("dtt_session")
    code = await _start_link(client, "Ledger")
    assert (await client.post("/api/auth/link/claim", json={"code": code})).status_code == 200

    def tx(raw, owner, ttype, item, paid=None, got=None):
        return dict(TX, transaction_type=ttype, transaction_owner=owner, item_name=item,
                    raw_message=raw, normalized_message=raw, fingerprint="p-" + raw,
                    money_paid=paid, money_received=got, total_price=paid or got)

    rows = [
        tx("Ledger bought 10 Emeralds", "Ledger", "BUY", "Emeralds", paid="10000"),
        tx("Ledger sold 10 Emeralds", "Ledger", "SELL", "Emeralds", got="14000"),
        tx("Ledger bought 5 Diamonds", "Ledger", "BUY", "Diamond", paid="5000"),
        tx("Ledger sold 5 Diamonds", "Ledger", "SELL", "Diamond", got="3000"),
        tx("SomeoneElse bought 1 Diamond", "SomeoneElse", "BUY", "Diamond", paid="999999"),
    ]
    await client.post("/api/transactions/bulk", json={"transactions": rows}, headers=headers)

    a = (await client.get("/api/me/analytics")).json()
    assert a["username"] == "Ledger"
    # Other players' money is excluded: 999999 never shows up.
    assert a["totals"]["spent"] == "15000.00"
    assert a["totals"]["received"] == "17000.00"
    assert a["totals"]["net"] == "2000.00"

    by_item = {i["item"]: i for i in a["items"]}
    assert by_item["Emeralds"]["net"] == "4000.00"      # profitable
    assert by_item["Diamond"]["net"] == "-2000.00"      # loss making
    assert by_item["Emeralds"]["count"] == 2
    # Sorted by net, so the winner leads.
    assert a["items"][0]["item"] == "Emeralds"

    assert a["daily"] and sum(Decimal(d["net"]) for d in a["daily"]) == Decimal("2000.00")
    assert {t["type"] for t in a["types"]} == {"BUY", "SELL"}

    client.cookies.delete("dtt_session")


@pytest.mark.anyio
async def test_friends_are_private_and_summarised(client):
    """A signed-in player keeps a manual friends list and sees their observed stats."""
    headers = {"X-API-Key": "test-key"}
    client.cookies.delete("dtt_session")

    # Friends require a session, like every other /api/me view.
    assert (await client.get("/api/me/friends")).status_code == 401

    code = await _start_link(client, "BuddyOwner")
    assert (await client.post("/api/auth/link/claim", json={"code": code})).status_code == 200

    def tx(raw, owner, ttype="SELL", item="Emeralds", paid=None, got=None):
        return dict(TX, transaction_type=ttype, transaction_owner=owner, item_name=item,
                    raw_message=raw, normalized_message=raw, fingerprint="fr-" + raw,
                    money_paid=paid, money_received=got, total_price=paid or got)

    await client.post("/api/transactions/bulk", json={"transactions": [
        tx("Buddy bought 10 Emeralds", "Buddy", "BUY", "Emeralds", paid="10000"),
        tx("Buddy sold 10 Emeralds", "Buddy", "SELL", "Emeralds", got="25000"),
        tx("Owner sold 1 Diamond", "BuddyOwner", "SELL", "Diamond", got="500000"),
        tx("Stranger sold a thing", "Stranger", "SELL", "Mace", got="7777777"),
    ]}, headers=headers)

    # Case-insensitive input resolves to the observed casing.
    added = await client.post("/api/me/friends", json={"username": "buddy"})
    assert added.status_code == 201, added.text
    body = added.json()
    assert body["username"] == "Buddy"
    assert body["observed_transactions"] == 2
    assert body["money_spent"] == "10000.00"
    assert body["money_received"] == "25000.00"
    assert body["net"] == "15000.00"
    assert body["saw_activity"] is True

    # Duplicates are rejected, and you cannot friend yourself.
    assert (await client.post("/api/me/friends", json={"username": "Buddy"})).status_code == 409
    assert (await client.post("/api/me/friends", json={"username": "BuddyOwner"})).status_code == 400

    # A friend with no observed rows still lists, flagged as unseen.
    unseen = await client.post("/api/me/friends", json={"username": "Ghost"})
    assert unseen.status_code == 201
    assert unseen.json()["saw_activity"] is False

    listing = (await client.get("/api/me/friends")).json()
    assert listing["username"] == "BuddyOwner"
    assert listing["total"] == 2
    assert {i["username"] for i in listing["items"]} == {"Buddy", "Ghost"}
    buddy = next(i for i in listing["items"] if i["username"] == "Buddy")
    assert buddy["money_received"] == "25000.00"

    # Removal is scoped to the owner and is case-insensitive.
    assert (await client.delete("/api/me/friends/buddy")).status_code == 200
    assert (await client.delete("/api/me/friends/buddy")).status_code == 404
    assert (await client.get("/api/me/friends")).json()["total"] == 1

    # Another player must not see or mutate this list.
    client.cookies.delete("dtt_session")
    other = await _start_link(client, "Nosy")
    assert (await client.post("/api/auth/link/claim", json={"code": other})).status_code == 200
    assert (await client.get("/api/me/friends")).json()["total"] == 0
    assert (await client.delete("/api/me/friends/Ghost")).status_code == 404

    client.cookies.delete("dtt_session")


DONUTSTATS_HTML = """
<html><head><title>TestUser | DonutSMP Stats</title></head><body>
<h1><span>TestUser</span></h1>
<div class="rounded-btn border border-surface-700 bg-surface-800/50 p-4 flex items-start gap-3">
  <div class="min-w-0">
    <span class="text-xs text-muted uppercase tracking-wider font-medium block mb-1">Money</span>
    <span class="font-mono text-accent text-lg font-medium">578.83M</span>
  </div>
</div>
<div class="rounded-btn border border-surface-700 bg-surface-800/50 p-4 flex items-start gap-3">
  <div class="min-w-0">
    <span class="text-xs text-muted uppercase tracking-wider font-medium block mb-1">Kills</span>
    <span class="font-mono text-accent text-lg font-medium">184</span>
  </div>
</div>
</body></html>
"""


def test_donutstats_secondary_parser_reads_stat_cards():
    from app.services import donutstats

    parsed = donutstats._parse_html(DONUTSTATS_HTML, "TestUser")
    assert parsed["found"] is True
    assert parsed["display_name"] == "TestUser"
    assert parsed["source"] == "donutstats.org"
    assert parsed["stats"] == [
        {"label": "Money", "value": "578.83M"},
        {"label": "Kills", "value": "184"},
    ]


def test_donutstats_secondary_parser_detects_missing_player():
    from app.services import donutstats

    parsed = donutstats._parse_html(
        "<html><body><h1>Ghost</h1><p>Player not found or API error.</p></body></html>",
        "Ghost",
    )
    assert parsed["found"] is False
    assert parsed["stats"] == []
    assert parsed["username"] == "Ghost"


def test_donutstats_primary_maps_api_fields():
    from app.services import donutstats

    mapped = donutstats._map_primary({
        "money": "578830291",
        "shards": "1698",
        "kills": "184",
        "deaths": "94",
        "playtime": "1570236022",
        "placed_blocks": "75220",
        "broken_blocks": "127873",
        "mobs_killed": "11660",
        "money_spent_on_shop": "0",
        "money_made_from_sell": "1.9632327339459175e+8",
    }, "doodly_yousuf")

    assert mapped["source"] == "donutstats.co"
    assert mapped["found"] is True
    stats = {s["label"]: s["value"] for s in mapped["stats"]}
    assert stats["Money"] == "578.83M"
    assert stats["Playtime"] == "18.17d"
    assert stats["Earned /sell"] == "196.32M"
    assert stats["Spent /shop"] == "0"


@pytest.mark.anyio
async def test_donutstats_endpoint_uses_primary(client, monkeypatch):
    from app.services import donutstats

    async def fake_primary(username):
        return donutstats._map_primary({"money": "1000000", "kills": "5"}, username)

    monkeypatch.setattr(donutstats, "_fetch_primary", fake_primary)
    donutstats._cache.clear()

    r = await client.get("/api/players/TestUser/donutstats")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["found"] is True
    assert body["source"] == "donutstats.co"
    assert body["stats"][0] == {"label": "Money", "value": "1M"}

    bad = await client.get("/api/players/bad-name!/donutstats")
    assert bad.status_code == 400


@pytest.mark.anyio
async def test_donutstats_endpoint_falls_back_to_secondary(client, monkeypatch):
    from app.services import donutstats

    calls = {"primary": 0, "secondary": 0}

    async def failing_primary(username):
        calls["primary"] += 1
        raise donutstats.DonutStatsError("boom")

    async def working_secondary(username):
        calls["secondary"] += 1
        return donutstats._parse_html(DONUTSTATS_HTML, username)

    monkeypatch.setattr(donutstats, "_fetch_primary", failing_primary)
    monkeypatch.setattr(donutstats, "_fetch_secondary", working_secondary)
    donutstats._cache.clear()

    r = await client.get("/api/players/FallbackUser/donutstats")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source"] == "donutstats.org"
    assert body["stats"][0] == {"label": "Money", "value": "578.83M"}
    # The primary is retried before the secondary is used.
    assert calls == {"primary": 2, "secondary": 1}


def _leaderboard_rows(start: int, count: int):
    return [
        {"username": f"Player{start + i}", "uuid": f"uuid-{start + i}", "value": str(start + i)}
        for i in range(count)
    ]


def test_leaderboard_maps_rows_and_ranks():
    from app.services import donutstats

    page1 = donutstats._map_leaderboard("money", 1, _leaderboard_rows(0, 45))
    assert page1["found"] is True
    assert page1["label"] == "Money"
    assert page1["source"] == "donutstats.co"
    assert page1["has_prev"] is False
    assert page1["has_next"] is True
    assert len(page1["entries"]) == 45
    assert page1["entries"][0]["rank"] == 1
    assert page1["entries"][-1]["rank"] == 45


def test_leaderboard_drops_page_overlap_and_numbers_correctly():
    from app.services import donutstats

    first = _leaderboard_rows(0, 45)
    # Upstream repeats the previous page's last row as the first entry.
    second = [first[-1]] + _leaderboard_rows(45, 44)
    page2 = donutstats._map_leaderboard("money", 2, second)

    assert len(page2["entries"]) == 44
    assert page2["has_prev"] is True
    assert page2["entries"][0]["username"] == "Player45"
    assert page2["entries"][0]["rank"] == 46
    assert page2["entries"][-1]["rank"] == 89


def test_leaderboard_formats_playtime_and_money():
    from app.services import donutstats

    playtime = donutstats._map_leaderboard(
        "playtime", 1, [{"username": "A", "uuid": "u", "value": "86400000"}]
    )
    assert playtime["entries"][0]["display"] == "1.00d"

    money = donutstats._map_leaderboard(
        "money", 1, [{"username": "B", "uuid": "v", "value": "2943536491998"}]
    )
    assert money["entries"][0]["display"] == "2.94T"


@pytest.mark.anyio
async def test_leaderboard_endpoint_lists_and_serves_categories(client, monkeypatch):
    from app.services import donutstats

    listing = await client.get("/api/leaderboards")
    assert listing.status_code == 200, listing.text
    ids = [c["id"] for c in listing.json()["categories"]]
    assert "money" in ids and "playtime" in ids and "shards" in ids

    async def fake_fetch(category, page):
        return donutstats._map_leaderboard(category, page, _leaderboard_rows(0, 45))

    monkeypatch.setattr(donutstats, "_fetch_leaderboard", fake_fetch)
    donutstats._cache.clear()

    r = await client.get("/api/leaderboards/kills?page=1")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["label"] == "Kills"
    assert body["source"] == "donutstats.co"
    assert body["entries"][0]["rank"] == 1

    missing = await client.get("/api/leaderboards/not-a-board")
    assert missing.status_code == 404


@pytest.mark.anyio
async def test_leaderboard_endpoint_degrades_when_upstream_fails(client, monkeypatch):
    from app.services import donutstats

    async def failing_fetch(category, page):
        raise donutstats.DonutStatsError("down")

    monkeypatch.setattr(donutstats, "_fetch_leaderboard", failing_fetch)
    donutstats._cache.clear()

    r = await client.get("/api/leaderboards/sell?page=3")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["unavailable"] is True
    assert body["entries"] == []
    assert body["has_prev"] is True


def test_donutstats_payloads_hide_upstream_query():
    """Service payloads carry data only; the upstream query stays server-side."""
    from app.services import donutstats

    payloads = [
        donutstats._map_primary({"money": "1000"}, "TestUser"),
        donutstats._parse_html(DONUTSTATS_HTML, "TestUser"),
        donutstats._missing("TestUser", "donutstats.org"),
        donutstats._map_leaderboard("money", 1, _leaderboard_rows(0, 1)),
    ]
    for payload in payloads:
        assert "source_url" not in payload, payload


@pytest.mark.anyio
async def test_public_endpoints_do_not_leak_upstream_urls(client, monkeypatch):
    """The browser must never learn the upstream host, path, or query string."""
    from app.services import donutstats

    async def fake_primary(username):
        return donutstats._map_primary({"money": "1000000"}, username)

    monkeypatch.setattr(donutstats, "_fetch_primary", fake_primary)
    donutstats._cache.clear()

    stats = await client.get("/api/players/TestUser/donutstats")
    listing = await client.get("/api/leaderboards")
    assert stats.status_code == 200 and listing.status_code == 200
    for body in (stats.text, listing.text):
        assert "source_url" not in body
        assert "api.php" not in body
        assert "player.php" not in body
        assert "path=" not in body and "user=" not in body


def _request_from(peer: str, headers: dict[str, str] | None = None):
    from starlette.requests import Request

    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({
        "type": "http", "method": "GET", "path": "/", "headers": raw,
        "client": (peer, 1234), "server": ("test", 80), "scheme": "http",
        "query_string": b"",
    })


def test_client_ip_ignores_forwarded_header_from_untrusted_peer():
    from app.api.routes import client_ip

    forged = _request_from("203.0.113.9", {"X-Forwarded-For": "1.2.3.4"})
    assert client_ip(forged) == "203.0.113.9"


def test_client_ip_resolves_real_client_behind_trusted_proxy():
    from app.api.routes import client_ip

    proxied = _request_from("127.0.0.1", {"X-Forwarded-For": "198.51.100.7"})
    assert client_ip(proxied) == "198.51.100.7"


def test_client_ip_ignores_hops_a_client_prepends():
    from app.api.routes import client_ip

    chain = _request_from(
        "127.0.0.1",
        {"X-Forwarded-For": "10.0.0.9, 192.168.1.5, 198.51.100.7"},
    )
    assert client_ip(chain) == "198.51.100.7"


@pytest.mark.anyio
async def test_leaderboards_are_publicly_cacheable_and_page_capped(client):
    listing = await client.get("/api/leaderboards")
    assert listing.status_code == 200, listing.text
    assert listing.headers.get("cache-control") == "public, max-age=600"

    # The page bound is enforced by request validation, before any upstream call.
    too_deep = await client.get("/api/leaderboards/money?page=501")
    assert too_deep.status_code == 422

    zero = await client.get("/api/leaderboards/money?page=0")
    assert zero.status_code == 422


@pytest.mark.anyio
async def test_mod_builds_lists_jars_and_serves_download(client):
    r = await client.get("/api/mod/builds")
    assert r.status_code == 200, r.text
    builds = r.json()["builds"]
    if not builds:
        pytest.skip("no mod jars present in the configured dist directory")
    build = builds[0]
    assert build["minecraft"] and build["version"]
    assert build["filename"].endswith(".jar")

    download = await client.get(build["url"])
    assert download.status_code == 200, download.text
    assert download.headers["content-type"] == "application/java-archive"
    assert "attachment" in download.headers.get("content-disposition", "")


@pytest.mark.anyio
async def test_mod_download_rejects_invalid_input(client):
    assert (await client.get("/api/mod/download?mc=../../etc")).status_code == 400
    assert (
        await client.get("/api/mod/download?mc=1.21.11&version=../secret")
    ).status_code == 400
    assert (await client.get("/api/mod/download?mc=9.9.9")).status_code == 404
