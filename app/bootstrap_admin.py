from sqlalchemy import func, select

from app.config import get_settings
from app.constants import AccountStatus, Role
from app.database import SessionLocal
from app.models import User
from app.security import hash_password


def main() -> None:
    settings = get_settings()
    if not all((settings.bootstrap_admin_email, settings.bootstrap_admin_name, settings.bootstrap_admin_password)):
        raise SystemExit("Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, and BOOTSTRAP_ADMIN_PASSWORD")

    with SessionLocal() as db:
        email = settings.bootstrap_admin_email.strip().lower()
        user = db.scalar(select(User).where(func.lower(User.email) == email))
        if user is None:
            db.add(
                User(
                    full_name=settings.bootstrap_admin_name.strip(),
                    email=email,
                    department="Administration",
                    role=Role.SYSTEM_ADMINISTRATOR.value,
                    status=AccountStatus.ACTIVE.value,
                    password_hash=hash_password(settings.bootstrap_admin_password.get_secret_value()),
                )
            )
            db.commit()
            print(f"Created bootstrap administrator account for {email}")
        elif user.role != Role.SYSTEM_ADMINISTRATOR.value or user.status != AccountStatus.ACTIVE.value:
            raise SystemExit("Bootstrap email exists but is not an active System Administrator")
        else:
            print("Bootstrap administrator already exists; no account changes made")


if __name__ == "__main__":
    main()