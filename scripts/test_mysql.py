"""Migrate and test an isolated MySQL database without printing credentials."""

import os
import subprocess
import sys
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parent.parent


def main():
    config = dotenv_values(ROOT / ".env")
    url = make_url(config["DATABASE_URL"]).set(database="pondokconnect_test")
    if url.host not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("MySQL tests require the local development database")
    environment = dict(
        os.environ,
        DATABASE_URL=url.render_as_string(hide_password=False),
        TEST_DATABASE_URL=url.render_as_string(hide_password=False),
    )
    subprocess.run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "db",
            "sh",
            "-c",
            'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root',
        ],
        input="CREATE DATABASE IF NOT EXISTS pondokconnect_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n"
        "GRANT ALL PRIVILEGES ON pondokconnect_test.* TO 'pondokconnect'@'%';\n",
        text=True,
        cwd=ROOT,
        check=True,
    )
    # Test suite recreates domain tables. Reset the migration version only on this isolated DB.
    from sqlalchemy import create_engine, text

    with create_engine(url).begin() as connection:
        tables = connection.execute(text("SHOW TABLES")).scalars().all()
        allowed = {
            "alembic_version",
            "users",
            "kecamatan",
            "ponpes",
            "pendaftaran_santri",
            "pengaduan_kekerasan",
            "chat_konsultasi",
            "audit_logs",
            "pengawasan_pesantren",
            "pengaduan_perkembangan",
        }
        if not set(tables) <= allowed:
            raise RuntimeError("Unexpected tables in test database; refusing to reset")
        connection.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        try:
            for table in tables:
                connection.execute(text(f"DROP TABLE `{table}`"))
        finally:
            connection.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    for command in (
        ["-m", "alembic", "upgrade", "head"],
        ["-m", "alembic", "check"],
        ["-m", "alembic", "downgrade", "base"],
        ["-m", "alembic", "upgrade", "head"],
        ["-m", "pytest", "-q"],
    ):
        subprocess.run([sys.executable, *command], cwd=ROOT, env=environment, check=True)


if __name__ == "__main__":
    main()
