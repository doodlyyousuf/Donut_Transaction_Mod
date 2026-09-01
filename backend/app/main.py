from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.config import settings
from app.database import engine, Base
from app.api.routes import router, auth_router, ws_router, limiter
from app.dashboard import app as dashboard_app  # noqa: F401 (module reference)

@asynccontextmanager
async def lifespan(_: FastAPI):
    import app.models  # register all models with Base
    if settings.auto_create_tables:      # dev convenience; prod uses Alembic
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="DonutSMP Transaction Tracker API", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_cors = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _cors == ["*"] else _cors,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(auth_router)
app.include_router(ws_router)
