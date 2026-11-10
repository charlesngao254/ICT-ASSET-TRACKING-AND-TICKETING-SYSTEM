import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.admin_routes import router as admin_router
from app.auth_routes import router as auth_router
from app.config import get_settings
from app.database import get_db
from app.resource_routes import router as resource_router
from app.schemas import HealthOut


settings = get_settings()
web_root = Path(__file__).resolve().parent.parent
production = settings.app_environment.lower() == "production"
app = FastAPI(
    title="SDJHRCA Department Operations API",
    version="1.0.0",
    docs_url=None if production else "/api/docs",
    redoc_url=None,
    openapi_url=None if production else "/api/openapi.json",
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(resource_router)
app.mount("/assets", StaticFiles(directory=web_root / "assets"), name="assets")


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "The request conflicts with an existing record or relationship"},
    )


@app.get("/health", response_model=HealthOut, tags=["operations"])
def health(db: Session = Depends(get_db)) -> HealthOut:
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable") from None
    return HealthOut(status="ok", database="postgresql")


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(web_root / "index.html")


@app.get("/workflow.js", include_in_schema=False)
def workflow_script() -> FileResponse:
    return FileResponse(web_root / "workflow.js", media_type="text/javascript")