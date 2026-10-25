from fastapi import APIRouter, Request

from backend.limiter import limiter
from backend.ocr import OcrRequest, OcrResult, transcribe_kk

router = APIRouter(tags=["Asisten pengisian KK"])


@router.post("/ocr/kk", response_model=OcrResult)
@limiter.limit("3/minute")
async def read_family_card(payload: OcrRequest, request: Request):
    return await transcribe_kk(payload.attachment)
