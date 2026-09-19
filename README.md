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
      → SyncWorker (async, X-API-Key) ──HTTP──► FastAPI :18700
                                                    │
                                          PostgreSQL (NUMERIC money)
                                                    │
                                          WebSocket /ws/transactions
                                                    │
         React+TS+Tailwind ◄── served by dashboard :18701 (SPA, talks to :18700)
```

## Features

- **Exact Format Parsing**: Dedicated parsers for DonutSMP chat formats (BUY, LIST, DELIVERY, SELL)
- **Money Accuracy**: BigDecimal end-to-end, stored as PostgreSQL NUMERIC - zero float error
- **Duplicate Prevention**: SHA-256 fingerprint deduplication with unique index
- **Offline Queue**: Durable queue.jsonl survives restarts, drains on reconnect
- **Server Gating**: Only tracks on *.donutsmp.net servers
- **Real-time Sync**: WebSocket live feed in dashboard
- **Material 3 Dashboard**: Dynamic color themes, order lifecycle and balance views
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
# Edit .env: set DATABASE_URL (API_KEY is generated on first start)
alembic upgrade head
pytest
uvicorn app.main:app --host 127.0.0.1 --port 18700
```

### 3. Frontend

```bat
cd frontend
npm install
npm run build
# Dev mode: npm run dev  (Vite on :15173, proxies /api and /ws to :18700)
# Production dashboard:
cd ..\backend
.venv\Scripts\activate
uvicorn app.dashboard:app --host 127.0.0.1 --port 18701
```

### 4. Minecraft Mod

```bat
cd minecraft-mod
gradlew.bat build
# Jar: build\libs\donutsmp-transaction-tracker-1.0.6+mc1.21.11.jar
# Drop into .minecraft\mods\ of Fabric 1.21.11 instance
```

## Hosting on Your Own Server (no Docker, single domain)

Run FastAPI with uvicorn behind nginx. nginx serves the built SPA and reverse-proxies
`/api` and `/ws` to uvicorn, so the dashboard and the API share one HTTPS origin.
Keep uvicorn bound to `127.0.0.1`; never expose the API port directly.

### Automated deploy (recommended)

`deploy/vps.sh` drives an idempotent install over SSH. It is the whole workflow:

```bash
# One-time: describe the server
cp deploy/vps.env.example deploy/vps.env
$EDITOR deploy/vps.env

# First provision (installs packages, creates the database, enables systemd + nginx)
./deploy/vps.sh bootstrap

# After code changes: rebuild, migrate, restart
./deploy/vps.sh update
```

Other commands:

```bash
./deploy/vps.sh ssh              # interactive shell on the VPS
./deploy/vps.sh ssh "uptime"     # run a single remote command
./deploy/vps.sh status           # service state and /api/health
./deploy/vps.sh logs             # follow the API log
./deploy/vps.sh show             # print the resolved configuration
```

`bootstrap` copies `backend/`, `frontend/` and `deploy/` to `REMOTE_DIR`
(default `/opt/donutsmp-tracker`), builds the SPA locally first, creates the
`donut` system user and PostgreSQL database, writes a `.env` with a freshly
generated `API_KEY`, runs `alembic upgrade head`, then installs
`deploy/systemd/donutsmp-api.service` and the nginx site. It never overwrites an
existing `backend/.env`, so the API key and database password survive redeploys.

Prerequisites: the SSH public key printed by `ssh-keygen -f ~/.ssh/donutsmp_vps`
must be in `authorized_keys` on the target, and the SSH user needs root or
passwordless `sudo`.

### Ports and public exposure

Only the frontend port is public; the API stays on `127.0.0.1:18700` and is
reached through the frontend origin via `/api` and `/ws`, so there is no CORS to
configure and the session cookie is first-party.

| Setting | Default | Used by |
|---------|---------|---------|
| `VPS_FRONTEND_PORT` | `18701` | nginx, when `VPS_USE_TLS=0` |
| backend `PORT` | `18700` | uvicorn, loopback only |
| `DASHBOARD_PORT` | `18701` | optional in-process dashboard |

With `VPS_USE_TLS=0` the dashboard is served on `VPS_FRONTEND_PORT` and is
reached as `http://<host>:<port>/`. Serving on a dedicated high port (rather
than port 80 at `/`) lets a test instance coexist with real sites that already
own port 80, without a domain or certificate. Because it is plain HTTP the
session cookie is sent unencrypted; run `/tracker link` only on a network you
trust until TLS is in place.

If `VPS_FRONTEND_PORT=80`, the deploy falls back to
`deploy/nginx/donutsmp-http.conf` and serves on port 80 at `/`.

Set `VPS_USE_TLS=1` and `VPS_HOSTNAME=tracker.example.com` in `deploy/vps.env`
once DNS points at the box: bootstrap then installs
`deploy/nginx/donutsmp.conf` (nginx on 80/443) and runs certbot, and
`VPS_FRONTEND_PORT` is ignored.

### Manual setup

The steps below mirror what the script does, for servers where you would rather
run each part yourself.

The defaults are deliberately non-standard to avoid clashing with other apps on a
shared server: **18700** (API), **18701** (dashboard), **15173** (Vite dev). Change
`PORT` in `backend/.env`, the `--port` in the systemd unit, and both `proxy_pass`
lines in the nginx config together if you want different ones. Check a port is free
with:

```bash
ss -tnlp | grep 18700
```

### 1. Build the frontend

```bash
cd frontend
npm install
npm run build
```

### 2. Backend (PostgreSQL)

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`: set `DATABASE_URL`, keep `HOST=127.0.0.1` and `AUTO_CREATE_TABLES=0`.
Leave `API_KEY` empty; it is generated on first start and written back into `.env`.

```bash
alembic upgrade head
pytest
```

### 3. systemd service

```bash
sudo cp deploy/systemd/donutsmp-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now donutsmp-api
```

The unit assumes the project lives at `/opt/donutsmp-tracker`. Adjust the paths,
`User`/`Group`, and `EnvironmentFile` if your layout differs.

### 4. nginx

```bash
sudo cp deploy/nginx/donutsmp.conf /etc/nginx/sites-available/donutsmp
```

Edit `server_name`, the `root` (point it at `frontend/dist`), and the TLS
certificate paths, then enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/donutsmp /etc/nginx/sites-enabled/donutsmp
sudo nginx -t
sudo systemctl reload nginx
```

`/api/bootstrap` is explicitly returned as `403` by nginx (and is loopback-only in
the API), so the API key is never served to a remote browser.

### 5. Point the mod at your server

The jars in `minecraft-mod/dist/` already ship with this host's URL and API key.
Drop the matching jar into `mods/` and play. To retarget a different server, edit
`.minecraft/config/donutsmp-transaction-tracker/donutsmp-transaction-tracker.json`:

```json
{
  "backendUrl": "https://tracker.example.com",
  "apiKey": "<API_KEY from backend/.env>",
  "trackingEnabled": true
}
```

Notes:

- Read endpoints (`/api/transactions`, `/api/stats`, `/api/orders`, `/api/players`)
  are public; the write endpoint (`POST /api/transactions/bulk`) requires `X-API-Key`.
- The dashboard calls the API on its own origin (relative paths), so no CORS setup or
  `VITE_API_BASE` is needed for the single-domain deployment.
- If the API is unreachable, the mod keeps events in `queue.jsonl` and drains later.

## Configuration

### Backend (.env)

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/donutsmp
API_KEY=
HOST=127.0.0.1
PORT=18700
DASHBOARD_PORT=18701
FRONTEND_DIST=../frontend/dist
AUTO_CREATE_TABLES=0
CORS_ORIGINS=http://localhost:18701,http://127.0.0.1:15173
```

Leave `API_KEY` empty. The backend generates one on first start and writes it into `.env`. The Minecraft mod (and local dashboard) call `GET /api/bootstrap` from localhost and save that key automatically.

When you host FastAPI online, set `HOST=0.0.0.0`, point `DATABASE_URL` at your hosted Postgres, and set `CORS_ORIGINS` to your dashboard origin (or `*` while testing). Bootstrap only works on the server machine, so a remote Minecraft client must use the same `apiKey` as the hosted `API_KEY`.

### Minecraft Mod Config

Generated at: `.minecraft/config/donutsmp-transaction-tracker/donutsmp-transaction-tracker.json`

```json
{
  "backendUrl": "https://donutstats.asifent.com",
  "webPort": 18701,
  "apiKeyEnc": "<obfuscated key>",
  "trackingEnabled": true,
  "autoStartWeb": false,
  "syncIntervalSeconds": 10,
  "debugLogging": false,
  "autoBalanceCheck": true,
  "balanceCommand": "bal",
  "balanceCheckCooldownSeconds": 15,
  "balanceCheckPeriodicSeconds": 0
}
```

Both Fabric jars ship with the hosted URL and key already filled in, so dropping either jar into `mods/` is enough to sync. Leftover `localhost` / port-80 configs are rewritten on first launch. To point at a different server, edit `backendUrl` (and `apiKeyEnc`, which is written automatically) in that JSON; custom values are left alone. The mod keeps working offline via `queue.jsonl` and drains when the API is reachable.

The shared key is stored obfuscated (repeating-key XOR + Base64, see `SecretCodec`) both in the jar and in `apiKeyEnc`, and is never exposed to the browser. A legacy plaintext `apiKey` from an older config is read once and rewritten obfuscated on the next save. This raises the bar against casual copying; it is not a cryptographic guarantee — anyone inspecting the running client can still recover the value.

After any transaction the mod runs `/bal` to refresh the player's balance snapshot, throttled by `balanceCheckCooldownSeconds`. Set `balanceCheckPeriodicSeconds` above `0` to also check on a fixed period even while idle. A balance check the mod issued is hidden from chat (it is still recorded for the dashboard), while a `/bal` or `/balance` the player types shows normally. Set `balanceCommand` if the server uses a different alias.

## In-Game Commands

- `/transactions` - Show tracking status
- `/transactions sync` - Force immediate queue sync
- `/transactions status` - Check backend connectivity
- `/transactions web` - Start and open dashboard
- `/transactions web stop` - Stop dashboard
- `/transactions web restart` - Restart dashboard
- `/tracker link` - Show a one-time code to sign in to your private dashboard view
- **Right Shift** - Open in-game tracker screen

## API Endpoints

### Public

- `GET /api/health` - Health check
- `GET /api/bootstrap` - Localhost-only: return (or generate) the API key
- `GET /api/transactions` - List transactions (filters, pagination)
- `GET /api/transactions/{id}` - Get single transaction
- `GET /api/orders` - List orders
- `GET /api/orders/{id}` - Get order details
- `GET /api/players` - List observed players
- `GET /api/players/{username}` - Player detail
- `GET /api/players/{username}/donutstats` - Public player stats via donutstats.co, falling back to donutstats.org (cached)
- `GET /api/leaderboards` - List the available donutstats.co leaderboard categories
- `GET /api/leaderboards/{category}?page=` - One page of a donutstats.co leaderboard (money, shards, kills, deaths, mobskilled, placedblocks, brokenblocks, shop, sell, playtime)
- `GET /api/balances` - Latest observed balance per player (highest first)
- `GET /api/balances/{username}` - Observed balance history for a player
- `GET /api/stats` - Overall statistics (balances excluded)
- `POST /api/auth/link/claim` - Exchange an in-game link code for a session cookie
- `GET /api/auth/me` - Current signed-in player (session cookie)
- `POST /api/auth/logout` - End the current session
- `GET /api/me/summary` - Private summary for the signed-in player
- `GET /api/me/transactions` - Private transaction list for the signed-in player
- `GET /api/me/orders` - Private order list for the signed-in player
- `GET /api/me/balance` - Private balance history for the signed-in player
- `GET /api/me/analytics?days=` - Private profit/loss totals, daily series, and per-item breakdown
- `GET /api/me/friends` - The signed-in player's friends list with observed summaries
- `POST /api/me/friends` - Add a friend by username (`{"username": "..."}`)
- `DELETE /api/me/friends/{username}` - Remove a friend

### Authenticated (X-API-Key header)

- `POST /api/transactions/bulk` - Bulk transaction upload
- `POST /api/auth/link/start` - Mint a one-time link code for a player (called by the mod)
- `POST /api/dashboard/start` - Start dashboard server
- `POST /api/dashboard/stop` - Stop dashboard server
- `POST /api/dashboard/restart` - Restart dashboard server

### WebSocket

- `WS /ws/transactions` - Live transaction feed (`transaction` and `balance` events)

## Parser Formats

The four spec-mandated formats plus the extra formats observed in real DonutSMP chat logs.

### Buy (local)
```
You bought 1 Ominous Trial Key for $ 440K
```

### Buy (observed other player)
```
qzweel_ bought 1 Soul Sand for $ 1K
SideWayzzzz bought 16 Ender Pearls for $ 3.4K
```

### Listing
```
You listed 7 Emerald for $ 39K
RealSwitchy listed 64 Dried Kelp Block for $ 59K
```

### Sale of your listing (local player earned)
```
P5Games1 bought your Mace for $7.7M
Visiblestalk bought your Emerald for $188K
```

### Sell (observed other player, item unknowable)
```
SideWayzzzz sold multiple items for $ 2.5K
```

### Auction earnings (local)
```
You earned $345K from auction
You earned $345K from auction got delivered 2 items
```

### Delivery
```
Jonas1138 delivered you 2 Diamond Boots
Midsann delivered you 1 Diamond Boots while you were away
Players delivered you 4
```

### Sell Money
```
$ 63.7K
```

### Player payment
```
SideWayzzzz was paid $ 25M by Schtiev123
You were paid $ 60K by Eidunas
```

### Bounty
```
You added $ 10M to Doodly_yousuf's bounty
SideWayzzzz added $7.8M to your bounty.
```

### Kill reward
```
+$17.8M for killing Doodly_yousuf
```

### Order created (local)
```
You ordered 1K Emeralds
```
Opens an `Order` row in `PENDING` state with `quantity = 1000`. The `K`/`M`/`B`
suffix is expanded to an exact integer; the message carries no price, so
`total_price` stays `NULL`.

### Order completed (local)
```
Your Emerald order is complete!
```
Closes the matching open order. DonutSMP is inconsistent about plurals — the
order above is created as `Emeralds` but completed as `Emerald` — so completion
matching compares item names ignoring a trailing `s`.

## Orders

Orders are created and closed from the order chat messages above, and are
advanced by deliveries (`X delivered you N Item`) through the conservative
linking in `backend/app/services/orders.py`:

| Event | Effect on the order |
|-------|---------------------|
| `You ordered 1K Emeralds` | New order, `PENDING`, `remaining = 1000` |
| `X delivered you N Emeralds` | `fulfilled += N`; `PARTIALLY_FILLED`, or `COMPLETED` when `remaining` reaches 0 |
| `Your Emerald order is complete!` | `COMPLETED`, `remaining = 0` |

A repeated `You ordered ...` for an order that is still open widens the target
quantity instead of creating a duplicate row.

## Counterparties

Every transaction stores who the other side was, so a payment is never shown as
an anonymous amount. The columns have per-type meanings, matching the mod's
parsers:

| Type | `buyer_username` | `seller_username` | `recipient_username` |
|------|------------------|-------------------|----------------------|
| `PAYMENT_RECEIVED` | the payer | – | the payee |
| `PAYMENT_SENT` | the payer | – | the payee |
| `SELL` | the purchaser | the lister | – |
| `BUY` | the buyer | the seller (unknown locally) | – |
| `LIST` | – | the lister | – |
| `ORDER_DELIVERY` | – | the deliverer | the recipient |

The dashboard renders this as a "from X" / "to X" line on each row (and a
Counterparty column in the transactions table), resolved by `counterpartyOf` in
`frontend/src/lib/format.ts`. The owner is skipped, so a transaction never lists
itself as its own counterparty. Where the chat genuinely did not name the other
side - a local buy has no known seller, a multiple-item sell has no known buyer,
a kill reward is paid by the game - the counterparty is left NULL rather than
guessed (§41).

## Balances

Balances are recorded as **snapshots**, never as money movement. Two chat forms
are understood:

| Form | Meaning | Owner |
|------|---------|-------|
| `You have $ 313,162,724` | Your own `/bal` reply (current) | local player |
| `$100,982,091` | Your own `/bal` reply (legacy, digit directly after `$`) | local player |
| `F18 has $ 105K` | Another player queried your balance | `F18` |

A snapshot stores the observed amount in `balances.amount` and leaves
`money_paid`/`money_received` as `NULL`, so balances never count toward income,
spending, or the `net` total. Because a balance is only known at the moment it
is seen in chat, `/api/balances` returns the latest snapshot per player and the
dashboard labels them "observed".

The bare-money form requires a digit immediately after `$`; a `/sell` payout
like `$ 63.7K` always has a space plus a suffix, so the two never collide.

## Per-player sign-in

The public pages show everything trackers have observed. The **Personal** view
mode shows only one player's data, and requires proving presence in-game:

1. In-game run `/tracker link`. The mod asks the API for a code (the request is
   signed with the server API key) and prints a 6-digit code in chat.
2. In the dashboard, enter the code (the account button, or the sign-in prompt
   shown when **Personal** mode is selected).
3. The API consumes the code and sets an `HttpOnly` session cookie scoped to
   that username. `GET /api/auth/me` then reports the player, and the
   `/api/me/*` endpoints read only that player's rows.

Properties:

- Codes are single use and expire after `LINK_CODE_TTL_SECONDS` (default 300).
  Requesting a new code revokes the previous one.
- Claiming is rate limited (10/minute) and codes are compared in SQL against a
  live, unused row.
- Session tokens are random 32-byte values; only a SHA-256 digest is stored, so
  a database leak cannot be replayed as a cookie.
- The API never reads or transmits Minecraft access tokens, session tokens, or
  launcher account files. Only the username is sent, which the mod already
  reports for every observed transaction.
- `/api/me/*` never accepts a username from the client, so a session can only
  ever read its own rows.

### Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `SESSION_TTL_DAYS` | `7` | Session lifetime |
| `LINK_CODE_TTL_SECONDS` | `300` | Link-code lifetime |
| `SESSION_COOKIE_NAME` | `dtt_session` | Cookie name |
| `COOKIE_SECURE` | `false` | Force the Secure flag; auto-enabled on https |

The cookie is `SameSite=Lax`, which works for the recommended single-domain
nginx setup where the dashboard and API share an origin. If you deliberately
host them on different sites, you would need `SameSite=None; Secure` and https.

### Limits of the trust anchor

The code proves the holder can see that player's chat. A tracker operator
already observes that player's activity, so this is not a defence against the
person running the tracker; it prevents anyone else from opening the private
dashboard view.

## View modes

The dashboard has two destination sets rather than one filtered view, because
the public and private pages answer different questions:

| Mode | Navigation | Data |
|------|------------|------|
| Public | Dashboard, Transactions, Orders, Balances, Players, Statistics, Settings | Everything every tracker has observed |
| Personal | Overview, History, Your Orders, Friends, Your Balance, Settings | Only the signed-in player's rows, plus the friends they follow |

Switch with the toggle in the navigation drawer / bottom bar, or the account
button in the app bar. The choice is remembered per browser in `localStorage`
(`dtt:view-mode`).

- Selecting **Personal** while signed out opens the sign-in dialog, and a
  successful sign-in lands on `/me`.
- The personal routes are `/me` (overview), `/me/transactions`, `/me/orders`,
  and `/me/balance`; opening one of them directly switches the navigation to
  personal mode.
- The **Overview** page shows profit/loss (money received minus money spent),
  a daily net chart with a selectable range, a per-item breakdown, recent
  activity, and open orders, all computed by `GET /api/me/analytics`.
- Personal pages are guarded by the session cookie, so they are safe to link to
  even when signed out (they prompt to sign in).

## Themes and background

The dashboard generates a full Material 3 palette from a single accent color, so
every surface, container and accent stays in tune. Pick one of six accents:

`Blue`, `Blurple`, `Green`, `Purple`, `Pink`, `Amber`

They are one tap away in the top app bar (a row of color dots), and the full
picker in **Settings - Appearance** or the palette button adds light, dark and
system modes. The choice is stored per browser in `localStorage` (`dtt:theme`),
and older preset ids are migrated onto their closest new accent.

Each theme also selects an animated backdrop (`aurora`, `mesh`, `ocean`,
`plasma`, `grid` or `rainbow`), rendered by `AnimatedBackground` from the active
scheme's colors. The backdrop is purely decorative, sits behind all content, and
automatically stops under the OS reduced-motion setting.

### Friends

The personal dashboard has a **Friends** page for keeping an eye on other
players. Friends are a **manual list** owned by the signed-in player - nothing
in the observation-only data stream proves a social relationship, so the player
builds the list themselves and it is stored server-side against their username.

- Add a friend by typing their in-game username. Input is matched
  case-insensitively against observed players (`sidewayzzzz` resolves to
  `SideWayzzzz`) and stored under the observed casing.
- Each card summarises what trackers have already observed for that player:
  event count, money received, money spent, net, and the latest balance
  snapshot, with a link through to the full player detail page.
- A friend who has never been observed still lists, flagged as
  "no activity observed yet", so the list is useful before data exists.
- Duplicates return `409`, adding yourself returns `400`, and the list is capped
  at 100 entries. The list is private: only the signed-in owner can read, add,
  or remove entries, and another player's session cannot see it.
- Adding a friend only opens a shortcut to already-public observations. It
  grants no access to that player's account or session.

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

## Install the Minecraft mod

Drop one jar from `minecraft-mod/dist/` into your instance `mods/` folder. Both
already talk to `https://donutstats.asifent.com` with the hosted API key.

Prebuilt jars are also published on
[GitHub Releases](https://github.com/doodlyyousuf/Donut_Transaction_Mod/releases/latest).

| Minecraft | Jar |
|-----------|-----|
| 1.21.11 (Java 21) | `donutsmp-transaction-tracker-1.0.6+mc1.21.11.jar` |
| 26.1.2 (Java 25) | `donutsmp-transaction-tracker-1.0.6+mc26.1.2.jar` |

On first launch the mod writes
`.minecraft/config/donutsmp-transaction-tracker/donutsmp-transaction-tracker.json`.
Leftover `localhost` configs from earlier builds are rewritten automatically.
Dashboard: https://donutstats.asifent.com — in-game `/tracker link` issues a code
to sign the browser in as that player.

## Building for both Minecraft lines

The mod builds against two targets from one source tree:

| Target  | Build dir | Loom | Mappings | Java | Client class names |
|---------|-----------|------|----------|------|--------------------|
| 1.21.11 | `minecraft-mod/` | 1.14.10 | yarn | 21 | yarn (`MinecraftClient`, `Text`, ...) |
| 26.1.x  | `minecraft-mod/mc26/` | 1.18.1 | none (game ships unobfuscated) | 25 | official (`Minecraft`, `Component`, ...) |

Only three files touch Minecraft's API, so each line has its own copy:

- `src/yarn/java/...` — `DonutTrackerClient`, `TrackerScreen`, `DashboardControl` (1.21.x)
- `src/mojmap/java/...` — the same three classes using official names (26.1.x)

Everything else (`parser/`, `model/`, `core/`, `config/`, `queue/`, `sync/`) is
shared by both builds from `src/main/java`.

Build both and collect the jars in `dist/`:

```bash
cd minecraft-mod
JAVA_HOME_121=/path/to/jdk21 JAVA_HOME_261=/path/to/jdk25 ./build-all.sh
```

Or build one line at a time:

```bash
# 1.21.11 — needs JDK 21
cd minecraft-mod
JAVA_HOME=/path/to/jdk21 ./gradlew build
# -> build/libs/donutsmp-transaction-tracker-1.0.6+mc1.21.11.jar

# 26.1.x — needs JDK 25 (its own Gradle wrapper, Loom 1.18.1)
cd minecraft-mod/mc26
JAVA_HOME=/path/to/jdk25 ./gradlew build
# -> mc26/build/libs/donutsmp-transaction-tracker-1.0.6+mc26.1.2.jar
```

Version-specific build settings live in each project's `gradle.properties`:

```properties
# minecraft-mod/mc26/gradle.properties
minecraft_version=26.1.2
loader_version=0.19.3
fabric_version=0.154.2+26.1.2
java_release=25
java_depends=25
```

`fabric.mod.json` is templated at build time, so each jar declares the matching
`minecraft`/`fabricloader`/`java` constraints (`~1.21.11`/`>=21` vs
`~26.1.2`/`>=25`).

Notes for the 26.1.x line:

- Minecraft 26.1.2 requires **Java 25**, and Fabric API renamed two entry points
  used by the client glue: `ClientCommandManager` → `ClientCommands`, and
  `KeyBindingHelper` → `KeyMappingHelper` (package `client.keymapping.v1`).
- 26.1.x renders screens via `Renderable#extractRenderState(GuiGraphicsExtractor, ...)`
  instead of `Screen#render(GuiGraphics, ...)`, which is why `TrackerScreen` has a
  version-specific copy.

## Data Accuracy Rules

- `$ 63.7K` → SELL with `item_name = NULL`, `quantity = NULL` (no invention)
- `RealSwitchy listed …` → `transaction_owner = RealSwitchy` (never reassigned to local)
- `P5Games1 bought your Mace …` → SELL owned by the local player, `buyer = P5Games1`
- Observed other-player `X bought N …` records store the reported `total_price` but
  leave `money_paid`/`money_received` NULL, so only the local player's cash flow
  feeds the dashboard totals
- `X sold multiple items for $P` books `money_received = P` (and `money_paid = 0`)
  against the seller `X`, since a sale always earns that owner, whether observed
  locally or on another player
- `You bought …` → `buyer = local`, `seller = NULL` (unknown, not guessed)
- Delivery matching requires exact item + buyer + recency
- A leading `.` notification glyph before a username is removed during normalization
- `X was paid $P by Y` and active `X paid Y $P` (also `... paid you ...`) →
  `PAYMENT_RECEIVED` when the local player is the payee, `PAYMENT_SENT` when the
  local player pays; otherwise the payer owns the observed record
- Dotted account names (e.g. `.RLEIO4566`, Geyser-style) are kept verbatim; the
  payer/payee patterns accept the leading dot
- `+$P for killing X` → `PAYMENT_RECEIVED` for the local player (the message is only
  shown to the killer)
- Bounty lines use `PAYMENT_SENT`; `X added … to your bounty` is stored against `X` and
  never charged to the local player
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
