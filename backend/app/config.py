from pathlib import Path
import os
import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict

_PLACEHOLDERS = {"", "change-me", "your-secret-key-here"}
_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/donutsmp"
    api_key: str = "change-me"
    host: str = "127.0.0.1"
    port: int = 18700
    dashboard_port: int = 18701
    frontend_dist: str = "../frontend/dist"
    # Built mod jars served by /api/mod/download; relative paths resolve from the
    # backend working directory, same convention as frontend_dist.
    mod_dist_dir: str = "../minecraft-mod/dist"
    auto_create_tables: bool = False
    # Comma-separated browser origins for the dashboard. Use * when the API is hosted
    # and the dashboard origin is not known yet. The Minecraft mod does not use CORS.
    cors_origins: str = "http://localhost:18701,http://127.0.0.1:15173"
    # Per-player dashboard sessions. A player runs `/tracker link` in-game to get
    # a short-lived code, then exchanges it for a scoped session cookie.
    session_ttl_days: int = 7
    link_code_ttl_seconds: int = 300
    session_cookie_name: str = "dtt_session"
    # Anonymous handshake: the web app exchanges a short-lived signed token for
    # the HttpOnly cookie below. Public JSON endpoints require both, so a raw
    # curl or a third-party app cannot read them directly.
    client_cookie_name: str = "dtt_client"
    client_token_ttl_seconds: int = 300
    # Leave false for plain-HTTP local hosting; the API auto-enables Secure when
    # it sees an https request (directly or via X-Forwarded-Proto).
    cookie_secure: bool = False


settings = Settings()


def _persist_env(key: str, value: str) -> None:
    lines: list[str] = []
    found = False
    if _ENV_PATH.exists():
        for line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
            if line.startswith(f"{key}=") or line.startswith(f"{key} ="):
                lines.append(f"{key}={value}")
                found = True
            else:
                lines.append(line)
    if not found:
        if lines and lines[-1].strip():
            lines.append("")
        lines.append(f"{key}={value}")
    _ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def ensure_api_key() -> str:
    """Create a random API key on first run if .env still has a placeholder."""
    current = (settings.api_key or "").strip()
    if current not in _PLACEHOLDERS:
        return current
    key = secrets.token_urlsafe(32)
    settings.api_key = key
    os.environ["API_KEY"] = key
    try:
        _persist_env("API_KEY", key)
    except OSError:
        pass
    return key
