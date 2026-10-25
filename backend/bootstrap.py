"""Initialize the sourced directory and provision private portal login accounts.

The default CLI mode only reads the database. Apply mode exports newly generated
passwords to an exclusive 0600 CSV inside persistent storage before committing.
Neither imports nor account provisioning assert institution legal verification.
"""

import argparse
import csv
import hashlib
import json
import os
import re
import secrets
import string
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.auth import hash_password, verify_password
from backend.config import settings
from backend.database import SessionLocal
from backend.models.models import Kecamatan, Ponpes, User
from backend.profiles import PROFILES
from backend.reference_catalog import REFERENCE_CATALOG, import_catalog, validate_records

DISTRICTS = (
    "Babat",
    "Bluluk",
    "Brondong",
    "Deket",
    "Glagah",
    "Kalitengah",
    "Karangbinangun",
    "Karanggeneng",
    "Kedungpring",
    "Kembangbahu",
    "Lamongan",
    "Laren",
    "Maduran",
    "Mantup",
    "Modo",
    "Ngimbang",
    "Paciran",
    "Pucuk",
    "Sambeng",
    "Sarirejo",
    "Sekaran",
    "Solokuro",
    "Sugio",
    "Sukodadi",
    "Sukorame",
    "Tikung",
    "Turi",
)
LOGIN_DOMAIN = "pondokconnect.id"
DEMO_PASSWORDS = ("admin123", "satgas123")
CSV_FIELDS = ("ponpes_id", "slug", "nama_ponpes", "role", "email", "password")


def directory_records():
    """Combine the reviewed catalog and three real original institutions."""
    records = [dict(record) for record in REFERENCE_CATALOG]
    original = json.loads((Path(__file__).parent / "data" / "ponpes_locations.json").read_text())
    for slug, location in original.items():
        records.append(
            {"slug": slug, **{key: value for key, value in location.items() if key != "nspp_demo"}}
        )
    for record in records:
        profile = PROFILES.get(record["slug"])
        if profile and all(
            profile[key] == record[key] for key in ("nama_ponpes", "kecamatan", "alamat_lengkap")
        ):
            overview = next(
                (section for section in profile["bagian"] if section["judul"] == "Sekilas pesantren"),
                None,
            )
            if overview:
                record["deskripsi"] = overview["teks"]
                record["sumber_profil_url"] = overview["sumber_url"]
    validate_records(records, set(DISTRICTS))
    return records


def bootstrap_directory(db: Session):
    """Stage missing districts and sourced profiles; the caller owns commit."""
    names = set(db.scalars(select(Kecamatan.nama_kecamatan)))
    missing = [name for name in DISTRICTS if name not in names]
    db.add_all(Kecamatan(nama_kecamatan=name) for name in missing)
    db.flush()
    result = import_catalog(db, directory_records())
    return {
        "districts_added": len(missing),
        "profiles_added": result["added"],
        "profiles_preserved": result["preserved"],
        "profiles_conflicts": result["conflicts"],
    }


def admin_email(slug: str, *, ponpes_id: int | None = None):
    """Use the persistent institution number for a short, unique portal ID.

    Unsaved directory rows use a slug only during the read-only preview. Apply
    flushes the directory first, so every new account uses its institution ID.
    """
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        raise ValueError("Slug pesantren tidak dapat dijadikan alias admin")
    if ponpes_id is not None:
        if type(ponpes_id) is not int or ponpes_id < 1:
            raise ValueError("Nomor pesantren untuk alias admin tidak valid")
        return f"admin{ponpes_id:02d}@{LOGIN_DOMAIN}"
    local = f"admin-{slug}"
    if len(local) > 64:
        local = f"{local[:51]}-{hashlib.sha256(slug.encode()).hexdigest()[:12]}"
    return f"{local}@{LOGIN_DOMAIN}"


def _owner_email(value):
    if value is None:
        return None
    value = value.strip().lower()
    if (
        len(value) > 100
        or not re.fullmatch(r"[a-z0-9]+(?:[._+-][a-z0-9]+)*@[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}", value)
        or len(value.partition("@")[0]) > 64
    ):
        raise ValueError("Alias pengelola portal tidak valid atau melebihi 100 karakter")
    return value


def _account_plan(db, institutions, owner_email, rotate_demo_passwords):
    users = list(db.scalars(select(User)))
    users_by_id = {user.id: user for user in users}
    by_email = {}
    for user in users:
        key = user.email.casefold()
        if key in by_email:
            raise ValueError("Terdapat benturan alias akun yang sudah ada")
        by_email[key] = user
    created = []
    linked = {}
    preserved = 0
    reserved = set(by_email)
    for institution in institutions:
        if institution.user_admin_id is not None:
            admin = users_by_id.get(institution.user_admin_id)
            if admin is None or admin.role != "admin_ponpes" or admin.id in linked:
                raise ValueError("Kepemilikan akun admin pesantren tidak valid")
            linked[admin.id] = institution
            preserved += 1
            continue
        email = admin_email(institution.slug, ponpes_id=institution.id)
        # Preview rows have no persistent number yet. Validate/reserve the real
        # short alias once the directory is flushed, before creating any user.
        if institution.id is not None:
            if email.casefold() in reserved:
                raise ValueError("Alias admin pesantren berbenturan dengan akun lain")
            reserved.add(email.casefold())
        created.append((institution, email, "admin_ponpes"))
    owner_email = _owner_email(owner_email)
    owner_created = 0
    if owner_email:
        owner = by_email.get(owner_email.casefold())
        if owner:
            if owner.role != "satgas_kemenag":
                raise ValueError("Alias pengelola portal dimiliki akun dengan peran lain")
        elif owner_email.casefold() in reserved:
            raise ValueError("Alias pengelola portal berbenturan dengan admin pesantren")
        else:
            created.append((None, owner_email, "satgas_kemenag"))
            owner_created = 1
    rotations = []
    if rotate_demo_passwords:
        for user in users:
            if user.role in {"admin_ponpes", "satgas_kemenag"} and any(
                verify_password(password, user.password_hash) for password in DEMO_PASSWORDS
            ):
                rotations.append((user, linked.get(user.id)))
    return (
        {
            "admins_created": len(created) - owner_created,
            "admins_preserved": preserved,
            "owners_created": owner_created,
            "passwords_rotated": len(rotations),
        },
        created,
        rotations,
    )


def _new_password(seen):
    alphabet = string.ascii_letters + string.digits + "!#$%&*+-=?@_"
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(24))
        if password not in seen:
            seen.add(password)
            return password


def _credential(user, institution, password):
    return {
        "ponpes_id": institution.id if institution is not None else "",
        "slug": institution.slug if institution is not None else "",
        "nama_ponpes": institution.nama_ponpes if institution is not None else "",
        "role": user.role,
        "email": user.email,
        "password": password,
    }


def provision_accounts(db: Session, *, owner_email=None, rotate_demo_passwords=False):
    """Stage missing accounts and return transient credentials; never commit."""
    institutions = list(db.scalars(select(Ponpes).order_by(Ponpes.id)))
    result, created, rotations = _account_plan(db, institutions, owner_email, rotate_demo_passwords)
    credentials = []
    seen = set()
    for institution, email, role in created:
        password = _new_password(seen)
        user = User(
            email=email,
            nama_lengkap=(
                f"Admin {institution.nama_ponpes}" if institution else "Pengelola Portal Pondok Connect"
            )[:100],
            no_hp="",
            role=role,
            password_hash=hash_password(password),
            must_change_password=True,
        )
        db.add(user)
        db.flush()
        if institution is not None:
            institution.user_admin_id = user.id
        credentials.append(_credential(user, institution, password))
    for user, institution in rotations:
        password = _new_password(seen)
        user.password_hash = hash_password(password)
        user.must_change_password = True
        credentials.append(_credential(user, institution, password))
    db.flush()
    return result, credentials


def _preview(db, owner_email, rotate_demo_passwords):
    districts = set(db.scalars(select(Kecamatan.nama_kecamatan)))
    institutions = list(db.scalars(select(Ponpes).order_by(Ponpes.id)))
    existing = {row.slug: row for row in institutions}
    result = {
        "districts_added": len(set(DISTRICTS) - districts),
        "profiles_added": 0,
        "profiles_preserved": 0,
        "profiles_conflicts": 0,
    }
    for record in directory_records():
        if record["slug"] in existing:
            key = "profiles_preserved" if existing[record["slug"]].profil_referensi else "profiles_conflicts"
            result[key] += 1
        else:
            institutions.append(Ponpes(slug=record["slug"], nama_ponpes=record["nama_ponpes"]))
            result["profiles_added"] += 1
    accounts, _, _ = _account_plan(db, institutions, owner_email, rotate_demo_passwords)
    return {**result, **accounts}


def _manifest_path(credentials_file, storage_dir):
    root = Path(storage_dir).resolve()
    target = Path(credentials_file).resolve()
    if not target.is_relative_to(root) or target == root:
        raise ValueError("File kredensial harus berada di dalam direktori storage privat")
    return target


def _write_manifest(path, credentials):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", newline="", encoding="utf-8") as manifest:
            descriptor = None
            writer = csv.DictWriter(manifest, fieldnames=CSV_FIELDS)
            writer.writeheader()
            writer.writerows(credentials)
            manifest.flush()
            os.fsync(manifest.fileno())
    except BaseException:
        if descriptor is not None:
            os.close(descriptor)
        path.unlink(missing_ok=True)
        raise


def run_bootstrap(
    db: Session,
    *,
    apply=False,
    credentials_file=None,
    storage_dir=None,
    owner_email=None,
    rotate_demo_passwords=False,
):
    """Plan read-only by default; export credentials before one atomic commit."""
    if db.new or db.dirty or db.deleted:
        raise ValueError("Gunakan sesi bersih tanpa perubahan aplikasi yang belum disimpan")
    manifest = None
    exported = False
    try:
        with db.no_autoflush:
            preview = _preview(db, owner_email, rotate_demo_passwords)
        if not apply:
            return {"applied": False, **preview}
        if preview["admins_created"] + preview["owners_created"] + preview["passwords_rotated"]:
            if credentials_file is None:
                raise ValueError("--credentials-file wajib ketika akun atau password baru akan dibuat")
            manifest = _manifest_path(credentials_file, storage_dir or settings.upload_dir.parent)
        directory = bootstrap_directory(db)
        accounts, credentials = provision_accounts(
            db, owner_email=owner_email, rotate_demo_passwords=rotate_demo_passwords
        )
        if credentials:
            _write_manifest(manifest, credentials)
            exported = True
        db.commit()
        return {"applied": True, **directory, **accounts}
    except BaseException:
        db.rollback()
        if exported:
            manifest.unlink(missing_ok=True)
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description="Inisialisasi direktori dan akun privat; default dry-run")
    parser.add_argument("--apply", action="store_true", help="Ekspor kredensial dan simpan transaksi")
    parser.add_argument(
        "--credentials-file", type=Path, help="CSV baru di dalam storage; tidak boleh ditimpa"
    )
    parser.add_argument("--storage-dir", type=Path, help="Root storage persisten (default induk UPLOAD_DIR)")
    parser.add_argument("--owner-email", help="Alias login pengelola portal awal; tidak mengirim email")
    parser.add_argument(
        "--rotate-demo-passwords", action="store_true", help="Ganti hanya password demo yang dikenal"
    )
    args = parser.parse_args(argv)
    try:
        with SessionLocal() as db:
            result = run_bootstrap(
                db,
                apply=args.apply,
                credentials_file=args.credentials_file,
                storage_dir=args.storage_dir,
                owner_email=args.owner_email,
                rotate_demo_passwords=args.rotate_demo_passwords,
            )
    except (ValueError, OSError) as error:
        print(f"Bootstrap dibatalkan: {error}", file=sys.stderr)
        return 1
    except Exception:
        print("Bootstrap dibatalkan; transaksi dibatalkan tanpa menampilkan kredensial.", file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
