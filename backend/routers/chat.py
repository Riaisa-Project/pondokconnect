import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import case, func, select, update
from sqlalchemy.orm import Session

from backend.auth import ponpes_only
from backend.database import get_db
from backend.limiter import limiter
from backend.models.models import Chat, User
from backend.schemas.schemas import ChatCreate, ChatOut, ChatRead, ChatReply
from backend.services import get_ponpes, own_ponpes, require_service

router = APIRouter(tags=["Konsultasi"])


def first_message(db, ponpes_id, session_id):
    row = db.scalar(
        select(Chat)
        .where(Chat.ponpes_id == ponpes_id, Chat.session_id == session_id)
        .order_by(Chat.id)
        .limit(1)
    )
    if not row:
        raise HTTPException(404, "Sesi chat tidak ditemukan")
    return row


@router.post("/chat/kirim", response_model=ChatOut, status_code=201)
@limiter.limit("30/minute")
def send(payload: ChatCreate, request: Request, db: Session = Depends(get_db)):
    ponpes = get_ponpes(db, payload.ponpes_id)
    require_service(db, ponpes, "konsultasi")
    if payload.session_id:
        initial = first_message(db, ponpes.id, payload.session_id)
        name, contact = initial.nama_warga, initial.kontak_warga
    else:
        name, contact = payload.nama_warga, payload.kontak_warga
    row = Chat(
        ponpes_id=ponpes.id,
        session_id=payload.session_id or secrets.token_hex(32),
        nama_warga=name,
        kontak_warga=contact,
        pesan=payload.pesan,
        sender_role="warga",
    )
    db.add(row)
    db.commit()
    return row


@router.get("/chat/{ponpes_id}/{session_id}")
def history(
    ponpes_id: int,
    session_id: str,
    after_id: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    first_message(db, ponpes_id, session_id)
    rows = db.scalars(
        select(Chat)
        .where(Chat.ponpes_id == ponpes_id, Chat.session_id == session_id, Chat.id > after_id)
        .order_by(Chat.id)
        .limit(limit)
    ).all()
    return {
        "items": [ChatOut.model_validate(row) for row in rows],
        "next_after_id": rows[-1].id if rows else after_id,
    }


@router.get("/admin/chat")
def inbox(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(ponpes_only),
    db: Session = Depends(get_db),
):
    ponpes = own_ponpes(db, user.id)
    grouped = select(
        Chat.session_id,
        func.max(Chat.id).label("last_id"),
        func.sum(case(((Chat.sender_role == "warga") & (Chat.is_read.is_(False)), 1), else_=0)).label(
            "unread_count"
        ),
    )
    grouped = grouped.where(Chat.ponpes_id == ponpes.id).group_by(Chat.session_id).subquery()
    rows = db.execute(
        select(Chat, grouped.c.unread_count)
        .join(grouped, Chat.id == grouped.c.last_id)
        .order_by(Chat.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return {
        "items": [
            {
                "session_id": row.session_id,
                "nama_warga": row.nama_warga,
                "kontak_warga": row.kontak_warga,
                "last_message": ChatOut.model_validate(row),
                "unread_count": int(unread),
            }
            for row, unread in rows
        ],
        "total": db.scalar(select(func.count()).select_from(grouped)),
        "limit": limit,
        "offset": offset,
    }


@router.post("/admin/chat/reply", response_model=ChatOut, status_code=201)
def reply(payload: ChatReply, user: User = Depends(ponpes_only), db: Session = Depends(get_db)):
    ponpes = own_ponpes(db, user.id)
    initial = first_message(db, ponpes.id, payload.session_id)
    row = Chat(
        ponpes_id=ponpes.id,
        session_id=payload.session_id,
        nama_warga=initial.nama_warga,
        kontak_warga=initial.kontak_warga,
        pesan=payload.pesan,
        sender_role="admin_ponpes",
    )
    db.add(row)
    db.commit()
    return row


@router.put("/admin/chat/read")
def mark_read(payload: ChatRead, user: User = Depends(ponpes_only), db: Session = Depends(get_db)):
    ponpes = own_ponpes(db, user.id)
    first_message(db, ponpes.id, payload.session_id)
    db.execute(
        update(Chat)
        .where(
            Chat.ponpes_id == ponpes.id, Chat.session_id == payload.session_id, Chat.sender_role == "warga"
        )
        .values(is_read=True)
    )
    db.commit()
    return {"message": "Pesan ditandai dibaca"}
