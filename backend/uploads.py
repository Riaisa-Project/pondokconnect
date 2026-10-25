import base64
import binascii
import os
import re
import secrets
from contextlib import contextmanager

from fastapi import HTTPException
from fastapi.responses import FileResponse

from backend.config import settings
from backend.schemas.schemas import Attachment

MAX_FILE_BYTES = 5 * 1024 * 1024


@contextmanager
def staged_attachment(attachment: Attachment | None):
    """Keep private files only if the surrounding DB transaction succeeds."""
    path = None
    name = None
    if attachment:
        try:
            data = base64.b64decode(attachment.content_base64, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(422, "Lampiran bukan base64 valid") from None
        if not 0 < len(data) <= MAX_FILE_BYTES:
            raise HTTPException(422, "Lampiran maksimal 5 MiB")
        if data.startswith(b"%PDF-"):
            suffix = ".pdf"
        elif data.startswith(b"\x89PNG\r\n\x1a\n"):
            suffix = ".png"
        elif data.startswith(b"\xff\xd8\xff"):
            suffix = ".jpg"
        else:
            raise HTTPException(422, "Lampiran harus PDF, PNG, atau JPEG")
        settings.upload_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        name = secrets.token_hex(24) + suffix
        path = settings.upload_dir / name
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
    try:
        yield name
    except BaseException:
        if path:
            path.unlink(missing_ok=True)
        raise


def private_file(name: str | None):
    if not name or not re.fullmatch(r"[a-f0-9]{48}\.(pdf|png|jpg)", name):
        raise HTTPException(404, "Berkas tidak ditemukan")
    path = settings.upload_dir / name
    if not path.is_file() or path.is_symlink():
        raise HTTPException(404, "Berkas tidak ditemukan")
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename="lampiran" + path.suffix,
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )
