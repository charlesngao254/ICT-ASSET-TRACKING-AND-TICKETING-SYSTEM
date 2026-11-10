from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.constants import AccountStatus, Role
from app.database import get_db
from app.dependencies import require_roles
from app.models import AuthSession, AuditLog, User
from app.schemas import AccessRequestOut, AccountApproval, UserOut


router = APIRouter(prefix="/api/v1/admin", tags=["administration"])
admin_user = require_roles(Role.SYSTEM_ADMINISTRATOR)


@router.get("/access-requests", response_model=list[AccessRequestOut])
def list_access_requests(
    _: User = Depends(admin_user),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(db.scalars(select(User).where(User.status == AccountStatus.PENDING.value).order_by(User.created_at)))


@router.post("/access-requests/{user_id}/approve", response_model=UserOut)
def approve_access_request(
    user_id: UUID,
    payload: AccountApproval,
    actor: User = Depends(admin_user),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None or user.status != AccountStatus.PENDING.value:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending request not found")
    user.role = payload.role.value
    if user.password_hash is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Access request has no password set")
    user.status = AccountStatus.ACTIVE.value
    user.requested_role = None
    user.updated_at = datetime.now(UTC)
    record_audit(db, actor, "access_request.approved", "user", user.id, {"role": user.role})
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(
    _: User = Depends(admin_user),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(db.scalars(select(User).order_by(User.department, User.full_name)))


@router.patch("/users/{user_id}/disable", response_model=UserOut)
def disable_user(
    user_id: UUID,
    actor: User = Depends(admin_user),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == actor.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot disable your own account")
    user.status = AccountStatus.DISABLED.value
    db.query(AuthSession).filter(
        AuthSession.user_id == user.id,
        AuthSession.revoked_at.is_(None),
    ).update({AuthSession.revoked_at: datetime.now(UTC)}, synchronize_session=False)
    record_audit(db, actor, "user.disabled", "user", user.id)
    db.commit()
    db.refresh(user)
    return user


@router.get("/audit", response_model=list[dict])
def list_audit_logs(
    limit: int = 100,
    _: User = Depends(admin_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    limit = min(max(limit, 1), 500)
    entries = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit))
    return [
        {
            "id": entry.id,
            "actor_id": entry.actor_id,
            "action": entry.action,
            "entity_type": entry.entity_type,
            "entity_id": entry.entity_id,
            "details": entry.details,
            "created_at": entry.created_at,
        }
        for entry in entries
    ]