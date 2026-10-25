import csv
import json
import stat
from decimal import Decimal

import pytest
from sqlalchemy import event, func, select

from backend.auth import hash_password, verify_password
from backend.models.models import AuditLog, Kecamatan, Ponpes, User


@pytest.fixture
def production_db(factory, monkeypatch):
    # Keep real bcrypt hashing/verification while making account batches fast.
    import bcrypt

    real_gensalt = bcrypt.gensalt
    monkeypatch.setattr(bcrypt, "gensalt", lambda: real_gensalt(rounds=4))
    with factory() as session:
        yield session


def count(db, model):
    return db.scalar(select(func.count()).select_from(model))


def read_credentials(path):
    with path.open(newline="") as manifest:
        return list(csv.DictReader(manifest))


def test_fresh_directory_has_only_real_references_and_no_invented_legal_facts(production_db):
    from backend.bootstrap import bootstrap_directory

    result = bootstrap_directory(production_db)
    assert result["districts_added"] == 27
    assert result["profiles_added"] == 33
    assert count(production_db, Kecamatan) == 27
    rows = production_db.scalars(select(Ponpes)).all()
    assert len(rows) == 33
    assert "al-maruf" not in {row.slug for row in rows}
    assert count(production_db, User) == 0
    for row in rows:
        assert row.profil_referensi is True
        assert row.nspp is None and row.nama_pengasuh is None and row.tipe_pesantren is None
        assert row.no_sk_ijop is None
        assert row.tanggal_ijop_mulai is None and row.tanggal_ijop_selesai is None
        assert row.status_ijop == "proses_verifikasi"
        assert row.kuota_putra == row.kuota_putri == 0
        assert row.kontak_sekretariat is None
    original = next(row for row in rows if row.slug == "sunan-drajat")
    assert original.latitude == Decimal("-6.88080000")
    assert original.longitude == Decimal("112.39020000")
    assert "Banjaranyar" in original.deskripsi
    unknown = next(row for row in rows if row.slug == "al-ishlah-sendangagung")
    assert unknown.latitude is None and unknown.longitude is None
    production_db.rollback()
    assert count(production_db, Ponpes) == 0


def test_dry_run_executes_no_writes_and_creates_no_manifest(production_db, tmp_path):
    from backend.bootstrap import run_bootstrap

    writes = []

    def observe(_connection, _cursor, statement, _params, _context, _many):
        if statement.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE", "CREATE", "ALTER")):
            writes.append(statement)

    event.listen(production_db.bind, "before_cursor_execute", observe)
    manifest = tmp_path / "private" / "accounts.csv"
    try:
        result = run_bootstrap(
            production_db,
            credentials_file=manifest,
            storage_dir=tmp_path,
            owner_email="portal-owner@pondokconnect.invalid",
        )
    finally:
        event.remove(production_db.bind, "before_cursor_execute", observe)
    assert result["applied"] is False
    assert result["profiles_added"] == 33 and result["admins_created"] == 33
    assert result["owners_created"] == 1
    assert writes == []
    assert not manifest.exists() and not manifest.parent.exists()
    assert count(production_db, User) == count(production_db, Ponpes) == 0


def test_apply_provisions_unique_owners_and_secure_credentials_idempotently(production_db, tmp_path):
    from backend.bootstrap import run_bootstrap

    manifest = tmp_path / "private" / "accounts.csv"
    result = run_bootstrap(
        production_db,
        apply=True,
        credentials_file=manifest,
        storage_dir=tmp_path,
        owner_email="portal-owner@pondokconnect.invalid",
    )
    assert result["applied"] is True and result["admins_created"] == 33
    assert result["owners_created"] == 1
    assert stat.S_IMODE(manifest.stat().st_mode) == 0o600
    rows = read_credentials(manifest)
    assert len(rows) == 34
    assert len({row["password"] for row in rows}) == 34
    assert all(len(row["password"]) == 24 for row in rows)
    institutions = production_db.scalars(select(Ponpes)).all()
    assert len({row.user_admin_id for row in institutions}) == 33
    for row in rows:
        user = production_db.scalar(select(User).where(User.email == row["email"]))
        assert user.must_change_password
        assert user.password_hash.startswith("$2")
        assert verify_password(row["password"], user.password_hash)
        assert user.no_hp == ""
        assert len(user.email) <= 100
        if row["slug"]:
            institution = next(item for item in institutions if item.slug == row["slug"])
            assert user.role == "admin_ponpes" and institution.user_admin_id == user.id
            assert user.email == f"admin{institution.id:02d}@pondokconnect.id"
        else:
            assert user.role == "satgas_kemenag"
    before = {user.id: user.password_hash for user in production_db.scalars(select(User))}
    second = run_bootstrap(
        production_db,
        apply=True,
        storage_dir=tmp_path,
        owner_email="portal-owner@pondokconnect.invalid",
    )
    assert second["admins_created"] == second["owners_created"] == second["passwords_rotated"] == 0
    assert second["profiles_preserved"] == 33 and second["admins_preserved"] == 33
    assert before == {user.id: user.password_hash for user in production_db.scalars(select(User))}


def test_bootstrap_preserves_linked_admin_profile_edits_and_history(production_db, tmp_path):
    from backend.bootstrap import bootstrap_directory, run_bootstrap

    bootstrap_directory(production_db)
    existing = production_db.scalar(select(Ponpes).where(Ponpes.slug == "sunan-drajat"))
    user = User(
        email="established-admin@example.org",
        nama_lengkap="Pengurus lama",
        no_hp="081234567890",
        role="admin_ponpes",
        password_hash=hash_password("EstablishedPassword!42"),
        must_change_password=False,
    )
    production_db.add(user)
    production_db.flush()
    existing.user_admin_id = user.id
    existing.alamat_lengkap = "Koreksi alamat oleh pengurus"
    existing.deskripsi = "Deskripsi yang ditulis pengurus"
    existing.kuota_putra = 15
    history = AuditLog(user_id=user.id, aksi="profil_diperbarui", detail="Riwayat lama")
    production_db.add(history)
    production_db.commit()
    previous_hash = user.password_hash
    result = run_bootstrap(
        production_db,
        apply=True,
        credentials_file=tmp_path / "accounts.csv",
        storage_dir=tmp_path,
    )
    assert result["admins_created"] == 32 and result["admins_preserved"] == 1
    production_db.refresh(existing)
    production_db.refresh(user)
    assert existing.user_admin_id == user.id
    assert existing.alamat_lengkap == "Koreksi alamat oleh pengurus"
    assert existing.deskripsi == "Deskripsi yang ditulis pengurus" and existing.kuota_putra == 15
    assert user.password_hash == previous_hash and not user.must_change_password
    assert count(production_db, AuditLog) == 1
    assert production_db.get(AuditLog, history.id).detail == "Riwayat lama"


def test_cli_default_is_read_only_and_prints_counts_only(production_db, tmp_path, capsys, monkeypatch):
    import backend.bootstrap as bootstrap

    monkeypatch.setattr(bootstrap, "SessionLocal", lambda: production_db)
    assert bootstrap.main(["--credentials-file", str(tmp_path / "credentials.csv")]) == 0
    output = json.loads(capsys.readouterr().out)
    assert output["applied"] is False and output["admins_created"] == 33
    assert "password" not in output and "email" not in output
    assert not (tmp_path / "credentials.csv").exists()


@pytest.mark.parametrize("apply", [False, True])
def test_short_login_collision_keeps_existing_account_and_institution_ownership(
    production_db, tmp_path, apply
):
    from backend.bootstrap import bootstrap_directory, run_bootstrap

    bootstrap_directory(production_db)
    institution = production_db.scalar(select(Ponpes).order_by(Ponpes.id))
    occupied = User(
        email=f"ADMIN{institution.id:02d}@pondokconnect.id",
        nama_lengkap="Akun yang sudah ada",
        no_hp="",
        role="warga",
        password_hash=hash_password("ExistingPrivatePassword!42"),
    )
    production_db.add(occupied)
    production_db.commit()
    manifest = tmp_path / "accounts.csv"
    with pytest.raises(ValueError, match="berbenturan"):
        run_bootstrap(production_db, apply=apply, credentials_file=manifest, storage_dir=tmp_path)
    production_db.refresh(institution)
    assert institution.user_admin_id is None
    assert count(production_db, User) == 1
    assert occupied.role == "warga"
    assert verify_password("ExistingPrivatePassword!42", occupied.password_hash)
    assert not manifest.exists()


@pytest.mark.parametrize("apply", [False, True])
def test_unused_slug_alias_does_not_block_short_numbered_accounts(production_db, tmp_path, apply):
    from backend.bootstrap import run_bootstrap

    occupied = User(
        email="ADMIN-SUNAN-DRAJAT@pondokconnect.id",
        nama_lengkap="Akun lama tanpa hubungan",
        no_hp="",
        role="warga",
        password_hash=hash_password("NotADemoPassword!42"),
    )
    production_db.add(occupied)
    production_db.commit()
    manifest = tmp_path / "accounts.csv"
    result = run_bootstrap(production_db, apply=apply, credentials_file=manifest, storage_dir=tmp_path)
    assert result["admins_created"] == 33
    assert count(production_db, Ponpes) == (33 if apply else 0)
    assert count(production_db, User) == (34 if apply else 1)
    assert occupied.role == "warga"
    assert manifest.exists() is apply


@pytest.mark.parametrize("failure", ["occupied", "export", "commit"])
def test_manifest_or_commit_failure_rolls_back_all_database_changes(
    production_db, tmp_path, monkeypatch, failure
):
    import backend.bootstrap as bootstrap

    manifest = tmp_path / "accounts.csv"
    if failure == "occupied":
        manifest.write_text("already exists")
    elif failure == "export":
        # Simulate a full persistent disk after the file was opened.
        monkeypatch.setattr(bootstrap.os, "fsync", lambda _descriptor: (_ for _ in ()).throw(OSError("full")))
    else:
        # The export succeeds, but the database rejects the transaction.
        monkeypatch.setattr(
            production_db, "commit", lambda: (_ for _ in ()).throw(RuntimeError("commit rejected"))
        )
    with pytest.raises((OSError, RuntimeError)):
        bootstrap.run_bootstrap(production_db, apply=True, credentials_file=manifest, storage_dir=tmp_path)
    assert count(production_db, User) == count(production_db, Ponpes) == count(production_db, Kecamatan) == 0
    if failure == "occupied":
        assert manifest.read_text() == "already exists"
    else:
        assert not manifest.exists()


def test_apply_rejects_missing_manifest_and_paths_outside_private_storage(production_db, tmp_path):
    from backend.bootstrap import run_bootstrap

    with pytest.raises(ValueError, match="credentials-file"):
        run_bootstrap(production_db, apply=True, storage_dir=tmp_path)
    with pytest.raises(ValueError, match="storage"):
        run_bootstrap(
            production_db,
            apply=True,
            credentials_file=tmp_path.parent / "outside.csv",
            storage_dir=tmp_path,
        )
    assert count(production_db, User) == count(production_db, Ponpes) == 0


def test_only_explicit_rotation_replaces_known_demo_passwords(production_db, tmp_path):
    from backend.bootstrap import bootstrap_directory, run_bootstrap

    bootstrap_directory(production_db)
    institutions = list(production_db.scalars(select(Ponpes).order_by(Ponpes.id)))
    privileged = []
    for index, password in enumerate(("admin123", "ChangedByAnAdministrator!42", "satgas123")):
        user = User(
            email=f"existing-{index}@example.org",
            nama_lengkap=f"Akun lama {index}",
            no_hp="",
            role="admin_ponpes" if index != 2 else "satgas_kemenag",
            password_hash=hash_password(password),
            must_change_password=False,
        )
        production_db.add(user)
        production_db.flush()
        if index != 2:
            institutions[index].user_admin_id = user.id
        privileged.append(user)
    original_hashes = [user.password_hash for user in privileged]
    production_db.commit()
    normal = run_bootstrap(
        production_db, apply=True, credentials_file=tmp_path / "new.csv", storage_dir=tmp_path
    )
    assert normal["passwords_rotated"] == 0
    assert [user.password_hash for user in privileged] == original_hashes
    result = run_bootstrap(
        production_db,
        apply=True,
        credentials_file=tmp_path / "rotated.csv",
        storage_dir=tmp_path,
        rotate_demo_passwords=True,
    )
    assert result["passwords_rotated"] == 2
    rows = read_credentials(tmp_path / "rotated.csv")
    assert {row["email"] for row in rows} == {"existing-0@example.org", "existing-2@example.org"}
    assert privileged[1].password_hash == original_hashes[1]
    assert not privileged[1].must_change_password
    for index in (0, 2):
        assert privileged[index].password_hash != original_hashes[index]
        assert privileged[index].must_change_password
        credential = next(row for row in rows if row["email"] == privileged[index].email)
        assert verify_password(credential["password"], privileged[index].password_hash)


def test_provisioning_covers_preexisting_non_catalog_institution_and_long_slugs(production_db, tmp_path):
    from backend.bootstrap import bootstrap_directory, run_bootstrap

    bootstrap_directory(production_db)
    district = production_db.scalar(select(Kecamatan).where(Kecamatan.nama_kecamatan == "Babat"))
    slugs = ["al-maruf", "a" * 145, "a" * 144 + "b"]
    for slug in slugs:
        production_db.add(
            Ponpes(
                nama_ponpes="Institusi yang sudah tersimpan",
                slug=slug,
                kecamatan_id=district.id,
                alamat_lengkap="Alamat yang tersimpan sebelumnya",
                profil_referensi=False,
            )
        )
    production_db.commit()
    result = run_bootstrap(
        production_db, apply=True, credentials_file=tmp_path / "all.csv", storage_dir=tmp_path
    )
    assert result["admins_created"] == 36
    rows = read_credentials(tmp_path / "all.csv")
    assert len(rows) == 36 and len({row["email"] for row in rows}) == 36
    assert all(len(row["email"]) <= 100 and len(row["email"].partition("@")[0]) <= 64 for row in rows)
    assert set(slugs).issubset({row["slug"] for row in rows})


def test_run_bootstrap_refuses_pending_application_changes(production_db, tmp_path):
    from backend.bootstrap import run_bootstrap

    production_db.add(Kecamatan(nama_kecamatan="Data belum disimpan"))
    with pytest.raises(ValueError, match="perubahan"):
        run_bootstrap(
            production_db, apply=True, credentials_file=tmp_path / "accounts.csv", storage_dir=tmp_path
        )
    assert not (tmp_path / "accounts.csv").exists()
