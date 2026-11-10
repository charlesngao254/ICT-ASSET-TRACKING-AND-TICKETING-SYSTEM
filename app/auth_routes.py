from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.constants import AccountStatus, Role
from app.database import get_db
from app.dependencies import current_session_id, get_current_user
from app.models import AuthSession, User
from app.schemas import AccessRequestCreate, AccessRequestOut, ChangePasswordRequest, LoginRequest, TokenOut, UserOut
from app.security import create_access_token, hash_password, session_expiry, verify_password


router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.post("/access-requests", response_model=AccessRequestOut, status_code=status.HTTP_201_CREATED)
def request_access(payload: AccessRequestCreate, db: Session = Depends(get_db)) -> User:
    email = str(payload.email).strip().lower()
    if db.query(User.id).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account request already exists")
    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        department=payload.department.strip(),
        role=Role.STAFF.value,
        requested_role=payload.requested_role.value,
        status=AccountStatus.PENDING.value,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    record_audit(db, None, "access_request.created", "user", user.id)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenOut:
    email = str(payload.email).strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email).one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user.status != AccountStatus.ACTIVE.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")

    expires_at = session_expiry()
    auth_session = AuthSession(user_id=user.id, expires_at=expires_at)
    db.add(auth_session)
    record_audit(db, user, "auth.login", "user", user.id)
    db.commit()
    db.refresh(auth_session)
    token = create_access_token(user.id, auth_session.id, expires_at)
    return TokenOut(access_token=token, expires_at=expires_at, user=user)


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    user: User = Depends(get_current_user),
    session_id=Depends(current_session_id),
    db: Session = Depends(get_db),
) -> None:
    auth_session = db.get(AuthSession, session_id)
    if auth_session and auth_session.revoked_at is None:
        auth_session.revoked_at = datetime.now(UTC)
        record_audit(db, user, "auth.logout", "user", user.id)
        db.commit()


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    db.query(AuthSession).filter(
        AuthSession.user_id == user.id,
        AuthSession.revoked_at.is_(None),
    ).update({AuthSession.revoked_at: datetime.now(UTC)}, synchronize_session=False)
    record_audit(db, user, "auth.password_changed", "user", user.id)
    db.commit()