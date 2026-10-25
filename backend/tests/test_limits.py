from backend.limiter import limiter
from backend.tests.test_workflows import complaint


def test_complaint_rate_limit(client):
    old = limiter.enabled
    limiter.enabled = True
    limiter.reset()
    try:
        for _ in range(5):
            assert client.post("/pengaduan/kirim", json=complaint()).status_code == 201
        assert client.post("/pengaduan/kirim", json=complaint()).status_code == 429
    finally:
        limiter.enabled = old
        limiter.reset()


def test_chat_rate_limit(client):
    old = limiter.enabled
    limiter.enabled = True
    limiter.reset()
    try:
        payload = {"ponpes_id": 1, "nama_warga": "Wali", "kontak_warga": "08122222222", "pesan": "Halo"}
        for _ in range(30):
            assert client.post("/chat/kirim", json=payload).status_code == 201
        assert client.post("/chat/kirim", json=payload).status_code == 429
    finally:
        limiter.enabled = old
        limiter.reset()


def test_general_rate_limit(client):
    old = limiter.enabled
    limiter.enabled = True
    limiter.reset()
    try:
        for _ in range(60):
            assert client.get("/health").status_code == 200
        assert client.get("/health").status_code == 429
    finally:
        limiter.enabled = old
        limiter.reset()


def test_large_body_rejected(client):
    response = client.post(
        "/pendaftaran/kirim",
        content=b"x" * (8 * 1024 * 1024 + 1),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413


def test_openapi_has_json_for_all_mutations(client):
    schema = client.get("/openapi.json").json()
    for path, methods in schema["paths"].items():
        for verb, operation in methods.items():
            if verb in ("post", "put"):
                assert "application/json" in operation["requestBody"]["content"], path
