from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    jwt_secret_key: SecretStr
    app_environment: str = "development"
    jwt_issuer: str = "sdjhrca-operations"
    access_token_minutes: int = 30
    upload_directory: Path = Path("uploads")
    max_upload_bytes: int = 10 * 1024 * 1024
    bootstrap_admin_email: str | None = None
    bootstrap_admin_name: str | None = None
    bootstrap_admin_password: SecretStr | None = None
    cors_origins: list[str] = []

    @field_validator("database_url")
    @classmethod
    def require_postgresql(cls, value: str) -> str:
        if not value.startswith(("postgresql+psycopg://", "postgresql://")):
            raise ValueError("DATABASE_URL must use PostgreSQL")
        return value

    @field_validator("jwt_secret_key")
    @classmethod
    def require_strong_jwt_secret(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET_KEY must contain at least 32 characters")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()