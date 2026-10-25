import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models.models import User

# The token endpoint deliberately accepts JSON as required by the PRD.
# Swagger uses HTTP Bearer (overridden in main.py) after copying the login token.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/admin/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    if len(password.encode()) > 72:
        return False
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def password_version(user: User) -> str:
    return hmac.new(settings.jwt_secret.encode(), user.password_hash.encode(), hashlib.sha256).hexdigest()


def create_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user.id),
            "iat": now,
            "exp": now + timedelta(minutes=60),
            "jti": secrets.token_hex(16),
            "pwdv": password_version(user),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    error = HTTPException(401, "Token tidak valid atau kedaluwarsa", headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "exp", "iat", "pwdv"]},
        )
        if not isinstance(claims["sub"], str) or not claims["sub"].isdigit():
            raise error
        user = db.get(User, int(claims["sub"]))
        if (
            not user
            or not isinstance(claims["pwdv"], str)
            or not hmac.compare_digest(claims["pwdv"], password_version(user))
        ):
            raise error
        return user
    except (jwt.InvalidTokenError, ValueError, OverflowError):
        raise error from None


def require_roles(*roles):
    def dependency(user: User = Depends(current_user)):
        if user.role not in roles:
            raise HTTPException(403, "Akses tidak diizinkan untuk peran ini")
        if user.must_change_password:
            raise HTTPException(403, "Wajib mengganti password terlebih dahulu")
        return user

    return dependency


satgas_only = require_roles("satgas_kemenag")
ponpes_only = require_roles("admin_ponpes")
