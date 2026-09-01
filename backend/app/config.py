from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/donutsmp"
    api_key: str = "change-me"
    host: str = "127.0.0.1"
    port: int = 8000
    dashboard_port: int = 8765
    frontend_dist: str = "../frontend/dist"
    auto_create_tables: bool = False
    # Comma-separated browser origins for the dashboard. Use * when the API is hosted
    # and the dashboard origin is not known yet. The Minecraft mod does not use CORS.
    cors_origins: str = "http://localhost:8765,http://127.0.0.1:5173"

settings = Settings()
