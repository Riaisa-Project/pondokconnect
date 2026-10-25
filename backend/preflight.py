"""Report readiness without printing credentials or mutating the database."""

import json
import sys

from sqlalchemy import inspect, text


def main():
    try:
        from backend.config import settings
        from backend.database import engine

        result = {
            "production": settings.app_env == "production",
            "demo": settings.demo_mode,
            "database_backend": settings.database_backend,
            "frontend_built": (settings.frontend_dist / "index.html").is_file(),
            "groq_configured": bool(settings.groq_api_key),
        }
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
            result["database_connected"] = True
            tables = inspect(connection).get_table_names()
            result["migration"] = (
                connection.scalar(text("SELECT version_num FROM alembic_version"))
                if "alembic_version" in tables
                else "not_migrated"
            )
            if settings.database_backend == "tidb":
                result["tidb_transaction_mode"] = connection.scalar(text("SELECT @@tidb_txn_mode"))
                cipher = connection.exec_driver_sql("SHOW STATUS LIKE 'Ssl_cipher'").first()
                result["tls_active"] = bool(cipher and cipher[1])
                constraint = connection.exec_driver_sql(
                    "SHOW GLOBAL VARIABLES LIKE 'tidb_enable_check_constraint'"
                ).first()
                result["check_constraints_enabled"] = bool(
                    constraint and str(constraint[1]).upper() in {"ON", "1"}
                )
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception:
        print(
            json.dumps(
                {
                    "database_connected": False,
                    "detail": "Periksa konfigurasi database, TLS dan akses jaringan.",
                }
            )
        )
        return 1


if __name__ == "__main__":
    sys.exit(main())
