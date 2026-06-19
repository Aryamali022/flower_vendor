"""Application configuration loaded from environment / .env file."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # FastAPI / JWT
    secret_key: str = "dev-insecure-secret-change-me"
    access_token_expire_minutes: int = 720  # 12 hours — long shifts, minimal re-login
    algorithm: str = "HS256"

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # CORS
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5500"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
