"""Run the API for browser tests against an isolated local MySQL database."""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parent.parent
TEST_DATABASE = "pondokconnect_frontend_test"


def main():
    os.chdir(ROOT)
    config = dotenv_values(ROOT / ".env")
    url = make_url(config["DATABASE_URL"]).set(database=TEST_DATABASE)
    if url.host not in {"127.0.0.1", "localhost"}:
        raise RuntimeError("Browser tests require the local development database")
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
        input=f"CREATE DATABASE IF NOT EXISTS {TEST_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n"
        f"GRANT ALL PRIVILEGES ON {TEST_DATABASE}.* TO 'pondokconnect'@'%';\n",
        text=True,
        check=True,
    )
    upload_dir = tempfile.mkdtemp(prefix="pondokconnect-e2e-")
    os.environ.update(
        DATABASE_URL=url.render_as_string(hide_password=False),
        APP_ENV="test",
        DEMO_MODE="true",
        RATE_LIMIT_ENABLED="false",
        OCR_ENABLED="false",
        GROQ_API_KEY="",
        UPLOAD_DIR=upload_dir,
    )
    import uvicorn
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text

    from backend.database import Base, SessionLocal, engine
    from backend.seeds import seed

    assert engine.url.database == TEST_DATABASE
    Base.metadata.drop_all(engine)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
    command.upgrade(Config(str(ROOT / "alembic.ini")), "head")
    with SessionLocal() as db:
        seed(db)
        if os.environ.get("REFERENCE_CATALOG_FIXTURE") == "1":
            from backend.reference_catalog import import_catalog

            import_catalog(db)
            db.commit()
    try:
        uvicorn.run("backend.main:app", host="127.0.0.1", port=8001, access_log=False)
    finally:
        engine.dispose()
        shutil.rmtree(upload_dir)


if __name__ == "__main__":
    import sys

    sys.path.insert(0, str(ROOT))
    main()
