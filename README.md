# DonutSMP Transaction Tracker

A complete observation-based transaction tracking system for DonutSMP Minecraft servers, consisting of:

- **Minecraft Fabric Mod** (1.21.11) - Passive chat observation with offline queue and sync
- **FastAPI Backend** - REST API, WebSocket, PostgreSQL with NUMERIC money handling
- **React Dashboard** - Real-time web interface with live transaction feed

## Architecture

```
Minecraft Client (Fabric 1.21.11, Java 21)
  Chat event → Normalize → ParserRegistry → TransactionRecord
      → fingerprint (SHA-256) → OfflineQueue (config/queue.jsonl)
      → SyncWorker (async, X-API-Key) ──HTTP──► FastAPI :8000
                                                    │
                                          PostgreSQL (NUMERIC money)
                                                    │
                                          WebSocket /ws/transactions
                                                    │
         React+TS+Tailwind ◄── served by dashboard :8765 (SPA, talks to :8000)
```

## Features

- **Exact Format Parsing**: Dedicated parsers for DonutSMP chat formats (BUY, LIST, DELIVERY, SELL)
- **Money Accuracy**: BigDecimal end-to-end, stored as PostgreSQL NUMERIC - zero float error
- **Duplicate Prevention**: SHA-256 fingerprint deduplication with unique index
- **Offline Queue**: Durable queue.jsonl survives restarts, drains on reconnect
- **Server Gating**: Only tracks on *.donutsmp.net servers
- **Real-time Sync**: WebSocket live feed in dashboard
- **Observation-only**: Mod reads only client-visible chat, no packets touched

## Prerequisites

- Java 21
- Python 3.12
- Node.js 20 LTS
- PostgreSQL 16

## Quick Start (Windows, no Docker)

### 1. Database

```bat
psql -U postgres -c "CREATE USER donut WITH PASSWORD 'password';"
psql -U postgres -c "CREATE DATABASE donutsmp OWNER donut;"
```

### 2. Backend

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Edit .env: set DATABASE_URL, API_KEY
alembic upgrade head
pytest
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 3. Frontend

```bat
cd frontend
npm install
npm run build
# Dev mode: npm run dev
# Production dashboard:
cd ..\backend
.venv\Scripts\activate
uvicorn app.dashboard:app --host 127.0.0.1 --port 8765
```

### 4. Minecraft Mod

```bat
cd minecraft-mod
gradlew.bat build
# Jar: build\libs\donutsmp-transaction-tracker-1.0.0.jar
# Drop into .minecraft\mods\ of Fabric 1.21.11 instance
```

## Configuration

### Backend (.env)

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/donutsmp
API_KEY=your-secret-key-here
HOST=127.0.0.1
PORT=8000
DASHBOARD_PORT=8765
FRONTEND_DIST=../frontend/dist
AUTO_CREATE_TABLES=0
CORS_ORIGINS=http://localhost:8765,http://127.0.0.1:5173
```

When you host FastAPI online, set `HOST=0.0.0.0`, point `DATABASE_URL` at your hosted Postgres, generate a strong `API_KEY`, and set `CORS_ORIGINS` to your dashboard origin (or `*` while testing). The Minecraft mod does not use CORS; it only needs `backendUrl` and the same `apiKey`.

### Minecraft Mod Config

Generated at: `.minecraft/config/donutsmp-transaction-tracker/donutsmp-transaction-tracker.json`

```json
{
  "backendUrl": "http://localhost:8000",
  "webPort": 8765,
  "apiKey": "your-secret-key-here",
  "trackingEnabled": true,
  "autoStartWeb": false,
  "syncIntervalSeconds": 10,
  "debugLogging": false
}
```

After you deploy the API, change `backendUrl` to that HTTPS URL (for example `https://api.example.com`) and set `apiKey` to the same value as `API_KEY` on the server. The mod keeps working offline via `queue.jsonl` and drains when the hosted API is reachable.

## In-Game Commands

- `/transactions` - Show tracking status
- `/transactions sync` - Force immediate queue sync
- `/transactions status` - Check backend connectivity
- `/transactions web` - Start and open dashboard
- `/transactions web stop` - Stop dashboard
- `/transactions web restart` - Restart dashboard
- **Right Shift** - Open in-game tracker screen

## API Endpoints

### Public

- `GET /api/health` - Health check
- `GET /api/transactions/{id}` - Get single transaction
- `GET /api/orders` - List orders
- `GET /api/orders/{id}` - Get order details
- `GET /api/players` - List observed players
- `GET /api/players/{username}` - Player detail
- `GET /api/stats` - Overall statistics

### Authenticated (X-API-Key header)

- `GET /api/transactions` - List transactions (filters, pagination)
- `POST /api/transactions/bulk` - Bulk transaction upload
- `POST /api/dashboard/start` - Start dashboard server
- `POST /api/dashboard/stop` - Stop dashboard server
- `POST /api/dashboard/restart` - Restart dashboard server

### WebSocket

- `WS /ws/transactions` - Live transaction feed

## Parser Formats

### Buy
```
You bought 1 Ominous Trial Key for $ 440K
```

### Listing
```
You listed 7 Emerald for $ 39K
RealSwitchy listed 64 Dried Kelp Block for $ 59K
```

### Delivery
```
Jonas1138 delivered you 2 Diamond Boots
```

### Sell Money
```
$ 63.7K
```

## Testing

### Backend

```bash
cd backend
pytest
```

### Minecraft Mod

```bash
cd minecraft-mod
gradlew test
```

## Rebuilding for Minecraft 26.1.2

The spec targets 1.21.11, but your instance runs 26.1.2. To rebuild:

Edit `gradle.properties`:
```properties
minecraft_version=26.1.2
# 26.1+ needs no yarn mappings (game ships unobfuscated)
loader_version=0.19.3
fabric_version=0.154.2+26.1.2
```

Edit `fabric.mod.json`:
```json
"depends": {
  "minecraft": "~26.1.2",
  "fabricloader": ">=0.19.3",
  "java": ">=21"
}
```

Update `build.gradle` Java toolchain to 25 if needed.

## Data Accuracy Rules

- `$ 63.7K` → SELL with `item_name = NULL`, `quantity = NULL` (no invention)
- `RealSwitchy listed …` → `transaction_owner = RealSwitchy` (never reassigned to local)
- `You bought …` → `buyer = local`, `seller = NULL` (unknown, not guessed)
- Delivery matching requires exact item + buyer + recency
- Raw message always stored verbatim alongside normalized form
- Unknown messages never become transactions (debug logging available)
- Money is BigDecimal → JSON string → NUMERIC(20,2) (no float ever touches currency)

## Extending Parsers

To add a new transaction format:

1. Create `parser/NewFormatParser.java` implementing `MessageParser`
2. Add anchored regex for the format
3. Return `TransactionRecord` with only fields present in message
4. Register in `ParserRegistry.PARSERS` (order = priority)
5. Add JUnit test case in `ParserTest.java`

## License

This project is provided as-is for DonutSMP server tracking purposes.

## Important Notes

- This mod observes public chat on multiplayer servers
- Verify that client-side chat-logging mods are permitted under DonutSMP's rules
- The mod is read-only and touches no packets (observation-only)
- API keys should be kept secure and never committed to repositories
- PostgreSQL NUMERIC type ensures precise money calculations
