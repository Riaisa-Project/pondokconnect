from slowapi import Limiter
from starlette.requests import Request

from backend.config import settings


def client_ip(request: Request) -> str:
    """Gunakan IP klien terverifikasi dari request.client.host.

    Uvicorn hanya me-rewrite request.client.host saat di belakang proxy tepercaya
    (forwarded_allow_ips). Jangan membaca header X-Forwarded-For mentah dari klien.
    """
    return request.client.host if request.client and request.client.host else "127.0.0.1"


limiter = Limiter(
    key_func=client_ip,
    default_limits=["60/minute"],
    storage_uri=settings.rate_limit_storage_uri,
    enabled=settings.rate_limit_enabled,
)
