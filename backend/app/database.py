import ssl
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

def _supabase_ssl() -> ssl.SSLContext:
    ctx = ssl.create_default_context()
    # School/office proxies inject a self-signed cert; asyncpg then fails handshake.
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def _engine_kwargs(url: str) -> dict:
    kwargs: dict = {"echo": False, "pool_pre_ping": True}
    if "supabase.co" in url or "pooler.supabase.com" in url:
        kwargs["connect_args"] = {"ssl": _supabase_ssl()}
    return kwargs

# Test runs override DATABASE_URL with sqlite+aiosqlite
engine = create_async_engine(settings.database_url, **_engine_kwargs(settings.database_url))
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session
