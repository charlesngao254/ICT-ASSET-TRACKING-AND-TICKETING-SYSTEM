from collections.abc import Callable
from datetime import UTC, datetime
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.constants import AccountStatus, Role
from app.database import get_db
from app.models import AuthSession, User
from app.security import decode_access_token


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    try:
        user_id, session_id = decode_access_token(credentials.credentials)
    except (jwt.InvalidTokenError, ValueError, KeyError):
        raise unauthorized from None

    auth_session = db.get(AuthSession, session_id)
    if (
        auth_session is None
        or auth_session.user_id != user_id
        or auth_session.revoked_at is not None
        or auth_session.expires_at <= datetime.now(UTC)
    ):
        raise unauthorized

    user = db.get(User, user_id)
    if user is None or user.status != AccountStatus.ACTIVE:
        raise unauthorized
    request.state.auth_session_id = auth_session.id
    return user


def require_roles(*roles: Role) -> Callable:
    def role_dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in {role.value for role in roles}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return role_dependency


def current_session_id(request: Request) -> UUID:
    session_id = getattr(request.state, "auth_session_id", None)
    if session_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return session_id