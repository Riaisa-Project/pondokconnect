"""Render/container entrypoint: migrate, bootstrap privately, then serve one origin."""

import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def main():
    os.umask(0o077)
    os.chdir(ROOT)
    try:
        from alembic import command
        from alembic.config import Config

        from backend.bootstrap import run_bootstrap
        from backend.config import settings
        from backend.database import SessionLocal

        settings.upload_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        if settings.serve_frontend and not (settings.frontend_dist / "index.html").is_file():
            raise RuntimeError("Frontend belum dibangun")
        command.upgrade(Config(str(ROOT / "alembic.ini")), "head")
        storage = settings.upload_dir.parent
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        manifest = storage / "private" / f"admin-accounts-{stamp}-{secrets.token_hex(3)}.csv"
        with SessionLocal() as db:
            result = run_bootstrap(
                db,
                apply=True,
                credentials_file=manifest,
                storage_dir=storage,
                owner_email=os.environ.get("BOOTSTRAP_OWNER_EMAIL", "pengelola@pondokconnect.id"),
            )
        print(
            "Startup ready: "
            f"profiles_added={result['profiles_added']}, admins_created={result['admins_created']}, "
            f"owners_created={result['owners_created']}.",
            flush=True,
        )
        if manifest.is_file():
            print(f"Initial credentials saved privately at {manifest}; values are not logged.", flush=True)
    except Exception:
        print(
            "Startup failed. Check database credentials/TLS, migration state, and writable persistent storage. "
            "No credentials or document content are logged.",
            file=sys.stderr,
            flush=True,
        )
        return 1
    import uvicorn

    from backend.proxy import forwarded_hosts

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "10000")),
        workers=1,
        access_log=False,
        proxy_headers=True,
        forwarded_allow_ips=forwarded_hosts(),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
