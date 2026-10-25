from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.auth import create_token, current_user, hash_password, verify_password
from backend.database import get_db
from backend.limiter import limiter
from backend.models.models import User
from backend.schemas.schemas import ChangePassword, Login, TokenOut, UserOut
from backend.services import audit

router = APIRouter(prefix="/admin", tags=["Autentikasi"])
DUMMY_HASH = hash_password("unused-password-for-timing")


@router.post("/login", response_model=TokenOut)
@limiter.limit("5/minute")
def login(payload: Login, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    valid = verify_password(payload.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid:
        raise HTTPException(401, "Email atau password salah", headers={"WWW-Authenticate": "Bearer"})
    return TokenOut(access_token=create_token(user), must_change_password=user.must_change_password)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.post("/change-password")
def change_password(
    payload: ChangePassword,
    request: Request,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    # Serialize password mutations with resets so old credentials cannot win a race.
    user = db.scalar(
        select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True)
    )
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(400, "Password lama salah")
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    audit(db, user.id, "change_password", {"user_id": user.id}, request)
    db.commit()
    return {"message": "Password berhasil diganti. Silakan login kembali."}
