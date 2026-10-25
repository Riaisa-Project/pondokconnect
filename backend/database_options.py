"""Verified cloud TLS while retaining local MySQL and isolated SQLite tests."""

import ssl

from sqlalchemy.engine import make_url


def is_tidb_url(database_url: str) -> bool:
    host = (make_url(database_url).host or "").lower()
    return host.endswith(".tidbcloud.com") or host.endswith(".tidb-cloud.com")


def connection_options(database_url: str, *, database_backend="mysql", tls_ca=None) -> dict:
    url = make_url(database_url)
    if url.get_backend_name() != "mysql":
        return {}
    args = {"connect_timeout": 15, "read_timeout": 40, "write_timeout": 40}
    if database_backend == "tidb" or is_tidb_url(database_url):
        args["ssl"] = ssl.create_default_context(cafile=tls_ca)
    return {"isolation_level": "READ COMMITTED", "connect_args": args}


def verify_tidb_mode(connection):
    """Cloud Starter exposes this variable as read-only; inspect rather than SET."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT @@tidb_txn_mode")
        value = cursor.fetchone()[0]
    if str(value).lower() != "pessimistic":
        raise RuntimeError("TiDB memerlukan mode transaksi pessimistic untuk menjaga kuota pendaftaran")
