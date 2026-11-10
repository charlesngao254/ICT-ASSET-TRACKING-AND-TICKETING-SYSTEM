from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from pwdlib import PasswordHash

from app.config import get_settings


password_hasher = PasswordHash.recommended()
JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    return password_hasher.verify(password, password_hash)


def create_access_token(user_id: UUID, session_id: UUID, expires_at: datetime) -> str:
    settings = get_settings()
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "iss": settings.jwt_issuer,
        "iat": datetime.now(UTC),
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret_key.get_secret_value(), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> tuple[UUID, UUID]:
    settings = get_settings()
    payload = jwt.decode(
        token,
        settings.jwt_secret_key.get_secret_value(),
        algorithms=[JWT_ALGORITHM],
        issuer=settings.jwt_issuer,
        options={"require": ["sub", "sid", "exp", "iss"]},
    )
    return UUID(payload["sub"]), UUID(payload["sid"])


def session_expiry() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=get_settings().access_token_minutes)