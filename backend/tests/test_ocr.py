"""OCR tests use generated images and a synthetic household, never a live provider."""

import base64
import json
from io import BytesIO
from types import SimpleNamespace

import httpx
import pytest
from PIL import Image
from pydantic import SecretStr

from backend.limiter import limiter


def image_attachment(format="PNG", size=(120, 80), exif=False):
    stream = BytesIO()
    image = Image.new("RGB", size, "white")
    options = {}
    if exif:
        metadata = Image.Exif()
        metadata[270] = "private-metadata-never-send"
        options["exif"] = metadata
    image.save(stream, format=format, **options)
    return {"filename": "synthetic-kk.png", "content_base64": base64.b64encode(stream.getvalue()).decode()}


def payload(**changes):
    return {"attachment": image_attachment(), "consent": True, **changes}


HOUSEHOLD = {
    "members": [
        {"nama": "ANAK SIMULASI", "nik": "0000000000000001", "jenis_kelamin": "L"},
        {"nama": "ANGGOTA SIMULASI", "nik": None, "jenis_kelamin": None},
    ],
    "kepala_keluarga": "WALI SIMULASI",
}


@pytest.fixture
def upstream(monkeypatch):
    from backend import ocr

    config = SimpleNamespace(
        groq_api_key=SecretStr("fake-provider-key"),
        groq_vision_model="qwen/qwen3.8-27b",
        groq_timeout_seconds=35,
        ocr_enabled=True,
    )
    monkeypatch.setattr(ocr, "settings", config)
    state = {"calls": [], "status": 200, "content": json.dumps(HOUSEHOLD), "exception": None}
    real_client = httpx.AsyncClient

    def handler(request):
        state["calls"].append(request)
        if state["exception"]:
            raise state["exception"]
        if "body" in state:
            return httpx.Response(state["status"], json=state["body"])
        return httpx.Response(
            state["status"],
            json={"choices": [{"finish_reason": "stop", "message": {"content": state["content"]}}]},
        )

    monkeypatch.setattr(
        ocr.httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    return state, config


@pytest.mark.parametrize("consent", [False, None, "true", 1])
def test_ocr_requires_explicit_boolean_consent(client, consent):
    response = client.post("/ocr/kk", json=payload(consent=consent))
    assert response.status_code == 422
    assert "content_base64" not in response.text


def test_ocr_missing_consent_rejected_before_provider(client, upstream):
    request = payload()
    del request["consent"]
    assert client.post("/ocr/kk", json=request).status_code == 422
    assert upstream[0]["calls"] == []


def test_ocr_returns_only_validated_household_without_saving_document(client, upstream, tmp_path):
    response = client.post("/ocr/kk", json=payload())
    assert response.status_code == 200, response.text
    assert response.json() == HOUSEHOLD
    assert response.headers["cache-control"] == "no-store"
    assert not list(tmp_path.iterdir())


def test_ocr_strips_metadata_and_sends_normalized_jpeg(client, upstream):
    response = client.post("/ocr/kk", json=payload(attachment=image_attachment("JPEG", exif=True)))
    assert response.status_code == 200
    request = upstream[0]["calls"][0]
    assert str(request.url) == "https://api.groq.com/openai/v1/chat/completions"
    body = json.loads(request.content)
    assert body["model"] == "qwen/qwen3.8-27b"
    assert body["response_format"] == {"type": "json_object"}
    assert body["reasoning_effort"] == "none"
    encoded = body["messages"][1]["content"][1]["image_url"]["url"]
    assert encoded.startswith("data:image/jpeg;base64,")
    data = base64.b64decode(encoded.split(",")[1])
    assert b"private-metadata-never-send" not in data
    with Image.open(BytesIO(data)) as image:
        assert not image.getexif()


@pytest.mark.parametrize(
    "data", [b"%PDF-1.4\n%%EOF", b"not-an-image", b"\x89PNG\r\n\x1a\ncorrupt", b"\xff\xd8\xffcorrupt"]
)
def test_ocr_rejects_non_images_and_corrupt_images_without_provider(client, upstream, data):
    request = payload(attachment={"filename": "kk.png", "content_base64": base64.b64encode(data).decode()})
    assert client.post("/ocr/kk", json=request).status_code == 422
    assert upstream[0]["calls"] == []


def test_ocr_rejects_bad_base64(client, upstream):
    request = payload(attachment={"filename": "kk.png", "content_base64": "private-invalid-base64!"})
    response = client.post("/ocr/kk", json=request)
    assert response.status_code == 422
    assert "private-invalid-base64" not in response.text
    assert upstream[0]["calls"] == []


def test_ocr_rejects_decoded_file_larger_than_five_mib(client, upstream):
    request = payload(
        attachment={
            "filename": "kk.png",
            "content_base64": base64.b64encode(b"x" * (5 * 1024 * 1024 + 1)).decode(),
        }
    )
    assert client.post("/ocr/kk", json=request).status_code == 422
    assert upstream[0]["calls"] == []


def test_ocr_rejects_more_than_twenty_megapixels(client, upstream):
    request = payload(attachment=image_attachment(size=(5000, 4001)))
    assert client.post("/ocr/kk", json=request).status_code == 422
    assert upstream[0]["calls"] == []


@pytest.mark.parametrize(
    "content",
    [
        "not json private-provider-details",
        json.dumps({**HOUSEHOLD, "raw_text": "private-provider-details"}),
        json.dumps({"members": [{"nama": "SIMULASI", "nik": "123", "jenis_kelamin": "L"}]}),
        json.dumps({"members": HOUSEHOLD["members"] * 16}),
    ],
)
def test_ocr_rejects_untrusted_or_malformed_provider_output(client, upstream, content):
    upstream[0]["content"] = content
    response = client.post("/ocr/kk", json=payload())
    assert response.status_code == 502
    assert "private-provider-details" not in response.text
    assert "0000000000000001" not in response.text


@pytest.mark.parametrize("status", [400, 401, 403, 429, 500, 503])
def test_ocr_upstream_rejection_is_sanitized(client, upstream, status):
    upstream[0].update(status=status, content="private-provider-details")
    response = client.post("/ocr/kk", json=payload())
    assert response.status_code in (502, 503)
    assert "private-provider-details" not in response.text
    assert "fake-provider-key" not in response.text


def test_ocr_timeout_keeps_manual_registration_available(client, upstream):
    upstream[0]["exception"] = httpx.ReadTimeout("private-provider-details")
    response = client.post("/ocr/kk", json=payload())
    assert response.status_code == 503
    assert "manual" in response.json()["detail"].lower()
    assert "private-provider-details" not in response.text


@pytest.mark.parametrize(
    "body",
    [
        None,
        [],
        {"choices": []},
        {"choices": ["bad"]},
        {"choices": [{"finish_reason": "stop", "message": None}]},
    ],
)
def test_ocr_rejects_malformed_provider_envelopes(client, upstream, body):
    upstream[0]["body"] = body
    assert client.post("/ocr/kk", json=payload()).status_code == 502


def test_ocr_rejects_incomplete_provider_result(client, upstream):
    upstream[0]["body"] = {
        "choices": [{"finish_reason": "length", "message": {"content": json.dumps(HOUSEHOLD)}}]
    }
    assert client.post("/ocr/kk", json=payload()).status_code == 502


def test_ocr_rejects_oversized_provider_response(client, upstream):
    upstream[0]["content"] = "private-provider-details" * 5000
    response = client.post("/ocr/kk", json=payload())
    assert response.status_code == 502
    assert "private-provider-details" not in response.text


@pytest.mark.parametrize("disabled", ["flag", "key"])
def test_ocr_unconfigured_returns_unavailable_without_provider(client, upstream, disabled):
    if disabled == "flag":
        upstream[1].ocr_enabled = False
    else:
        upstream[1].groq_api_key = None
    assert client.post("/ocr/kk", json=payload()).status_code == 503
    assert upstream[0]["calls"] == []


def test_ocr_rate_limit_allows_only_three_provider_calls_per_minute(client, upstream):
    original = limiter.enabled
    limiter.enabled = True
    limiter.reset()
    try:
        for _ in range(3):
            assert client.post("/ocr/kk", json=payload()).status_code == 200
        assert client.post("/ocr/kk", json=payload()).status_code == 429
        assert len(upstream[0]["calls"]) == 3
    finally:
        limiter.enabled = original
        limiter.reset()
