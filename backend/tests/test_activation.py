from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from backend.auth import create_token, hash_password
from backend.database import get_db
from backend.models.models import AuditLog, Chat, Kecamatan, Ponpes, User


def activation_payload(**changes):
    return {
        "nspp": "919000000001",
        "nama_pengasuh": "Pengasuh pengujian",
        "tipe_pesantren": "salafiyah",
        "kuota_putra": 10,
        "kuota_putri": 15,
        "status_ijop": "aktif",
        "no_sk_ijop": "TEST/BUKAN-IZIN-NYATA",
        "tanggal_ijop_mulai": (date.today() - timedelta(days=10)).isoformat(),
        "tanggal_ijop_selesai": (date.today() + timedelta(days=10)).isoformat(),
        **changes,
    }


@pytest.fixture
def activation_state(factory, monkeypatch):
    import bcrypt

    real_gensalt = bcrypt.gensalt
    monkeypatch.setattr(bcrypt, "gensalt", lambda: real_gensalt(rounds=4))
    with factory() as db:
        district = Kecamatan(nama_kecamatan="Paciran")
        db.add(district)
        accounts = {}
        for role in ("satgas_kemenag", "admin_ponpes", "warga"):
            account = User(
                nama_lengkap=f"Pengujian {role}",
                email=f"{role}@example.org",
                password_hash=hash_password("PasswordPengujian!42"),
                no_hp="",
                role=role,
                must_change_password=False,
            )
            db.add(account)
            accounts[role] = account
        db.flush()
        reference = Ponpes(
            profil_referensi=True,
            nama_ponpes="Pesantren Referensi Pengujian",
            slug="referensi-aktivasi-pengujian",
            kecamatan_id=district.id,
            user_admin_id=accounts["admin_ponpes"].id,
            nspp=None,
            nama_pengasuh=None,
            tipe_pesantren=None,
            alamat_lengkap="Alamat yang sudah dikoreksi pengurus",
            latitude=Decimal("-6.88080000"),
            longitude=Decimal("112.39020000"),
            deskripsi="Deskripsi yang disimpan pengurus",
            kuota_putra=0,
            kuota_putri=0,
        )
        db.add(reference)
        db.flush()
        old_audit = AuditLog(user_id=accounts["admin_ponpes"].id, aksi="existing_history", detail="Riwayat")
        chat = Chat(
            ponpes_id=reference.id,
            session_id="a" * 64,
            nama_warga="Warga pengujian",
            kontak_warga="08123456789",
            pesan="Riwayat konsultasi",
            sender_role="warga",
        )
        db.add_all([old_audit, chat])
        db.commit()
        yield db, reference, accounts


@pytest.fixture
def activation_client(activation_state, factory):
    from backend.routers import activation, pendaftaran

    app = FastAPI()
    app.include_router(activation.router)
    app.include_router(activation.router, prefix="/api", include_in_schema=False)
    app.include_router(pendaftaran.router)

    def override():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def authorization(account):
    return {"Authorization": f"Bearer {create_token(account)}"}


def activation_url(reference, prefix=""):
    return f"{prefix}/admin/kemenag/ponpes/{reference.id}/aktifkan-layanan"


@pytest.mark.parametrize("role", [None, "admin_ponpes", "warga"])
def test_activation_requires_satgas_authorization(activation_client, activation_state, role):
    db, reference, accounts = activation_state
    headers = authorization(accounts[role]) if role else {}
    response = activation_client.post(activation_url(reference), headers=headers, json=activation_payload())
    assert response.status_code == (401 if role is None else 403)
    db.refresh(reference)
    assert reference.profil_referensi and reference.nspp is None
    assert db.scalar(select(func.count(AuditLog.id))) == 1


def test_activation_refuses_satgas_that_must_change_password(activation_client, activation_state):
    db, reference, accounts = activation_state
    accounts["satgas_kemenag"].must_change_password = True
    db.commit()
    response = activation_client.post(
        activation_url(reference),
        headers=authorization(accounts["satgas_kemenag"]),
        json=activation_payload(),
    )
    assert response.status_code == 403


@pytest.mark.parametrize("prefix", ["", "/api"])
@pytest.mark.parametrize("payload", [activation_payload(), {}, {"user_admin_id": 999}])
def test_legacy_activation_is_gone_without_changing_profile_or_history(
    activation_client, activation_state, prefix, payload
):
    db, reference, accounts = activation_state
    before = (
        reference.user_admin_id,
        reference.alamat_lengkap,
        reference.latitude,
        reference.longitude,
        reference.deskripsi,
    )
    response = activation_client.post(
        activation_url(reference, prefix), headers=authorization(accounts["satgas_kemenag"]), json=payload
    )
    assert response.status_code == 410, response.text
    db.refresh(reference)
    assert reference.profil_referensi and reference.nspp is None
    assert (
        reference.user_admin_id,
        reference.alamat_lengkap,
        reference.latitude,
        reference.longitude,
        reference.deskripsi,
    ) == before
    assert db.scalar(select(func.count(Chat.id))) == 1
    assert db.scalar(select(func.count(AuditLog.id))) == 1


def test_every_bootstrapped_reference_rejects_legacy_activation(activation_client, activation_state):
    from backend.bootstrap import bootstrap_directory

    db, _, accounts = activation_state
    bootstrap_directory(db)
    db.commit()
    references = db.scalars(select(Ponpes)).all()
    assert len(references) == 34
    for reference in references:
        response = activation_client.post(
            activation_url(reference, "/api"),
            headers=authorization(accounts["satgas_kemenag"]),
            json=activation_payload(),
        )
        assert response.status_code == 410, response.text
        db.refresh(reference)
        assert reference.profil_referensi and reference.nspp is None
