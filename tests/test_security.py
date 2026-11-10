from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.schemas import VehicleLocationIn
from app.security import create_access_token, decode_access_token, hash_password, verify_password


@pytest.fixture(autouse=True)
def configured_settings(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-secret-with-more-than-thirty-two-characters")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_database_configuration_rejects_non_postgresql() -> None:
    with pytest.raises(ValidationError):
        Settings(database_url="sqlite:///not-allowed.db", jwt_secret_key="test-secret-with-more-than-thirty-two-characters")


def test_argon2_password_hash_verifies_only_matching_password() -> None:
    password_hash = hash_password("CorrectHorseBattery2026")

    assert password_hash != "CorrectHorseBattery2026"
    assert verify_password("CorrectHorseBattery2026", password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_jwt_binds_user_and_revocable_session_ids() -> None:
    user_id = uuid4()
    session_id = uuid4()
    token = create_access_token(user_id, session_id, datetime.now(UTC) + timedelta(minutes=5))

    assert decode_access_token(token) == (user_id, session_id)
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token + "invalid")


def test_location_schema_rejects_out_of_range_coordinates() -> None:
    with pytest.raises(ValidationError):
        VehicleLocationIn(latitude=95, longitude=36, speed_kph=20)
    with pytest.raises(ValidationError):
        VehicleLocationIn(latitude=-1, longitude=181, speed_kph=20)

    assert VehicleLocationIn(latitude=-1.2864, longitude=36.8172).speed_kph == 0