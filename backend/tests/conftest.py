import os

os.environ["JWT_SECRET"] = "test-only-key-" * 5
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "sqlite://")
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["APP_ENV"] = "test"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app
from backend.seeds import seed


@pytest.fixture
def engine():
    url = os.environ["DATABASE_URL"]
    options = (
        {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}}
        if url == "sqlite://"
        else {"isolation_level": "READ COMMITTED"}
    )
    eng = create_engine(url, **options)
    if url.startswith("sqlite"):

        @event.listens_for(eng, "connect")
        def foreign_keys(conn, _):
            conn.execute("PRAGMA foreign_keys=ON")
    else:
        assert eng.url.database.endswith("_test"), "Refusing to reset a non-test database"
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture
def factory(engine):
    return sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
def db(factory):
    with factory() as session:
        seed(session)
        yield session


@pytest.fixture
def client(db, factory, tmp_path, monkeypatch):
    from backend.config import settings

    monkeypatch.setattr(settings, "upload_dir", tmp_path)

    def override():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override
    with TestClient(app) as tc:
        yield tc
    app.dependency_overrides.clear()


def login(client, email="satgas@kemenag.go.id", password="satgas123"):
    response = client.post("/admin/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def satgas(client):
    return login(client)


@pytest.fixture
def admin(client):
    return login(client, "admin@sunandrajat.id", "admin123")
