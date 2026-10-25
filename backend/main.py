from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse, JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
from sqlalchemy.exc import DataError, IntegrityError, OperationalError
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.limiter import limiter
from backend.middleware import BodyLimitMiddleware
from backend.ocr import ocr_available
from backend.routers import (
    activation,
    admin,
    chat,
    dashboard,
    kemenag,
    ocr,
    pendaftaran,
    pengaduan,
    ponpes,
    stats,
)

app = FastAPI(
    title="Pondok Connect Lamongan",
    version="1.1.0",
    description="Pengawasan dan pelaporan pesantren Lamongan, direktori bersumber serta layanan pengurus. Aplikasi tidak menerbitkan IJOP. Login menerima JSON dan menghasilkan token Bearer.",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(BodyLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def private_responses(request: Request, call_next):
    response = await call_next(request)
    if "Cache-Control" not in response.headers:
        response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Pydantic error input can contain passwords, NIK, or base64 files: never echo it.
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
                for error in exc.errors()
            ]
        },
    )


@app.exception_handler(IntegrityError)
async def integrity_error(request, exc):
    return JSONResponse(status_code=409, content={"detail": "Data duplikat atau melanggar relasi database"})


@app.exception_handler(OperationalError)
async def database_error(request, exc):
    return JSONResponse(status_code=503, content={"detail": "Database sementara tidak tersedia"})


@app.exception_handler(DataError)
async def data_error(request, exc):
    return JSONResponse(status_code=422, content={"detail": "Nilai data tidak sesuai kapasitas database"})


@app.get("/api/health", tags=["Sistem"], include_in_schema=False)
@app.get("/health", tags=["Sistem"])
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except OperationalError:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unavailable"})
    return {"status": "ok", "database": "ok", "demo": settings.demo_mode}


@app.get("/api/system/features", include_in_schema=False)
@app.get("/system/features", tags=["Sistem"])
def features():
    available = ocr_available()
    return {
        "demo": settings.demo_mode,
        "demo_accounts_available": settings.demo_mode and settings.demo_accounts_enabled,
        "ocr_available": available,
        "provider": "Groq" if available else None,
    }


for router in (
    activation.router,
    admin.router,
    dashboard.router,
    ponpes.router,
    kemenag.router,
    stats.router,
    pendaftaran.router,
    pengaduan.router,
    chat.router,
    ocr.router,
):
    app.include_router(router)
    app.include_router(router, prefix="/api", include_in_schema=False)


if settings.serve_frontend:

    @app.get("/{path:path}", include_in_schema=False)
    @limiter.exempt
    def frontend(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Endpoint API tidak ditemukan")
        root = settings.frontend_dist.resolve()
        target = (root / path).resolve()
        if not target.is_relative_to(root):
            raise HTTPException(404, "Halaman tidak ditemukan")
        if target.is_file():
            cache = "public, max-age=31536000, immutable" if path.startswith("assets/") else "no-cache"
            return FileResponse(target, headers={"Cache-Control": cache})
        if path.startswith(("assets/", "admin/", "pendaftaran/", "pengaduan/", "chat/", "storage/")):
            raise HTTPException(404, "Halaman tidak ditemukan")
        index = root / "index.html"
        if not index.is_file():
            raise HTTPException(503, "Frontend belum dibangun")
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(title=app.title, version=app.version, description=app.description, routes=app.routes)
    schema.setdefault("components", {}).setdefault("securitySchemes", {})["OAuth2PasswordBearer"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "POST /admin/login dengan JSON email/password, lalu tempel access_token di sini.",
    }
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi
