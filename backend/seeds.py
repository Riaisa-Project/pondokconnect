import argparse
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.auth import hash_password
from backend.config import settings
from backend.database import SessionLocal
from backend.locations import LOCATIONS, fill_demo_location
from backend.models.models import Kecamatan, Ponpes, User

KECAMATAN = (
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


def seed(db: Session):
    if not settings.demo_mode or settings.app_env == "production":
        raise RuntimeError("Seed akun demo hanya diizinkan pada lingkungan demo non-production")
    for name in KECAMATAN:
        if not db.scalar(select(Kecamatan).where(Kecamatan.nama_kecamatan == name)):
            db.add(Kecamatan(nama_kecamatan=name))
    db.flush()
    accounts = [
        ("satgas@kemenag.go.id", "satgas123", "Satgas Kemenag (Demo)", "satgas_kemenag"),
        ("admin@sunandrajat.id", "admin123", "Admin Sunan Drajat (Demo)", "admin_ponpes"),
    ]
    for email, password, name, role in accounts:
        if not db.scalar(select(User).where(User.email == email)):
            db.add(
                User(
                    email=email,
                    password_hash=hash_password(password),
                    nama_lengkap=name,
                    no_hp="080000000000",
                    role=role,
                    must_change_password=False,
                )
            )
    db.flush()
    admin = db.scalar(select(User).where(User.email == "admin@sunandrajat.id"))
    examples = [
        ("000000000001", "Pondok Pesantren Sunan Drajat Paciran", "sunan-drajat", "Paciran"),
        ("000000000002", "Ponpes Tarbiyatut Tholabah Kranji Paciran", "tarbiyatut-tholabah", "Paciran"),
        ("000000000003", "Ponpes Al-Ma’ruf Babat", "al-maruf", "Babat"),
        ("000000000004", "Ponpes Matholi’ul Anwar Simo Sungelebak", "matholiul-anwar", "Karanggeneng"),
    ]
    for index, (nspp, name, slug, district) in enumerate(examples):
        existing = db.scalar(select(Ponpes).where(Ponpes.nspp == nspp))
        if existing:
            fill_demo_location(existing, district)
            if existing.deskripsi is None:
                existing.deskripsi = "Profil contoh untuk demonstrasi Pondok Connect. Pendidikan menggabungkan pendalaman ilmu agama, pembentukan karakter, dan keterampilan belajar dalam kehidupan berasrama. Hubungi pengurus untuk informasi resmi tentang program dan penerimaan santri."
            if existing.program_unggulan is None:
                existing.program_unggulan = [
                    "Kajian kitab (contoh)",
                    "Tahfiz Al-Qur'an (contoh)",
                    "Pengembangan bahasa (contoh)",
                ]
            if existing.fasilitas is None:
                existing.fasilitas = [
                    "Asrama santri (contoh)",
                    "Ruang belajar (contoh)",
                    "Perpustakaan (contoh)",
                    "Masjid (contoh)",
                ]
            continue
        kecamatan = db.scalar(select(Kecamatan).where(Kecamatan.nama_kecamatan == district))
        location = LOCATIONS.get(slug)
        db.add(
            Ponpes(
                nspp=nspp,
                nama_ponpes=name,
                slug=slug,
                kecamatan_id=kecamatan.id,
                user_admin_id=admin.id if index == 0 else None,
                nama_pengasuh="Pengasuh (data simulasi)",
                alamat_lengkap=location["alamat_lengkap"]
                if location
                else f"Alamat simulasi, {district}, Lamongan",
                **(
                    {"latitude": location["latitude"], "longitude": location["longitude"]} if location else {}
                ),
                tipe_pesantren="kombinasi",
                pendaftaran_dibuka=True,
                konsultasi_dibuka=True,
                status_ijop="aktif",
                no_sk_ijop=f"DEMO-BUKAN-IZIN-RESMI/{index + 1}",
                tanggal_ijop_mulai=date(2020, 1, 1),
                tanggal_ijop_selesai=date(2099, 12, 31),
                deskripsi="Profil contoh untuk demonstrasi Pondok Connect. Pendidikan memadukan ilmu agama, pembentukan karakter dan kehidupan berasrama. Program dan fasilitas berikut adalah contoh, bukan informasi resmi pesantren.",
                program_unggulan=[
                    "Kajian kitab (contoh)",
                    "Tahfiz Al-Qur'an (contoh)",
                    "Pengembangan bahasa (contoh)",
                ],
                fasilitas=[
                    "Asrama santri (contoh)",
                    "Ruang belajar (contoh)",
                    "Perpustakaan (contoh)",
                    "Masjid (contoh)",
                ],
                kuota_putra=50,
                kuota_putri=50,
                kontak_sekretariat="080000000000",
            )
        )
    db.commit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed data simulasi Pondok Connect (idempoten)")
    parser.add_argument(
        "--demo", action="store_true", required=True, help="Konfirmasi pemakaian akun/data demo"
    )
    parser.parse_args()
    with SessionLocal() as session:
        seed(session)
        from backend.reference_catalog import import_catalog

        result = import_catalog(session)
        session.commit()
    print(
        f"Seed layanan demo selesai; profil bersumber ditambahkan={result['added']}, dipertahankan={result['preserved']}. Izin/NSPP layanan demo tetap simulasi."
    )
