import ssl

import pytest


def test_missing_database_configuration_has_no_embedded_login(monkeypatch):
    from backend.config import Settings

    monkeypatch.delenv("DATABASE_URL", raising=False)
    config = Settings(
        _env_file=None,
        database_backend="mysql",
        jwt_secret="test-configuration-key-" * 3,
        app_env="development",
    )
    with pytest.raises(ValueError, match="DATABASE_URL"):
        _ = config.resolved_database_url


def test_tidb_connection_does_not_require_a_local_database_url():
    from backend.config import Settings

    config = Settings(
        _env_file=None,
        database_url="",
        database_backend="tidb",
        tidb_database_url="mysql://example:example@gateway.example.tidbcloud.com:4000/pondokconnect",
        jwt_secret="test-configuration-key-" * 3,
        app_env="production",
        demo_mode=False,
    )
    assert config.resolved_database_url.startswith("mysql+pymysql://")


def test_mysql_test_runner_refuses_remote_databases_before_any_mutation(monkeypatch):
    from scripts import test_mysql

    monkeypatch.setattr(
        test_mysql,
        "dotenv_values",
        lambda _: {"DATABASE_URL": "mysql+pymysql://example:example@cloud.example:4000/pondokconnect"},
    )

    def unexpected_command(*args, **kwargs):
        pytest.fail("The test runner attempted a command before rejecting the remote database")

    monkeypatch.setattr(test_mysql.subprocess, "run", unexpected_command)
    with pytest.raises(RuntimeError, match="local"):
        test_mysql.main()


def test_cloud_database_options_verify_tls_and_preserve_isolation():
    from backend.database_options import connection_options

    options = connection_options(
        "mysql+pymysql://example:password@gateway01.example.tidbcloud.com:4000/pondok"
    )
    context = options["connect_args"]["ssl"]
    assert isinstance(context, ssl.SSLContext)
    assert context.check_hostname is True
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert options["isolation_level"] == "READ COMMITTED"
    assert "init_command" not in options["connect_args"]


def test_local_mysql_does_not_require_cloud_tls():
    from backend.database_options import connection_options

    options = connection_options("mysql+pymysql://example:password@127.0.0.1:3307/pondok")
    assert "ssl" not in options.get("connect_args", {})
    assert options["isolation_level"] == "READ COMMITTED"


def test_internal_login_alias_accepts_generated_accounts_but_rejects_bad_addresses():
    from backend.schemas.schemas import Login

    assert Login(email="admin-sunan-drajat@pondokconnect.invalid", password="example").email
    assert Login(email="admin05@pondokconnect.id", password="example").email
    with pytest.raises(ValueError):
        Login(email="not-an-email", password="example")


def test_api_prefix_and_features_are_available(client):
    response = client.get("/api/ponpes/?q=Sunan")
    assert response.status_code == 200
    assert response.json()["total"] == 1
    features = client.get("/api/system/features").json()
    assert isinstance(features["demo"], bool)
    assert isinstance(features["ocr_available"], bool)
    assert "groq_api_key" not in features


def test_supervisor_can_search_beyond_first_directory_page(client, satgas):
    response = client.get("/admin/kemenag/ponpes?q=Matholi", headers=satgas)
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["slug"] == "matholiul-anwar"


def test_reference_profiles_are_counted_as_unconfirmed_oversight(client, db, satgas):
    from backend.reference_catalog import import_catalog

    import_catalog(db)
    db.commit()
    result = client.get("/admin/dashboard", headers=satgas).json()
    assert result["status_dokumen"]["belum_dikonfirmasi"] == 34
    assert result["status_dokumen"]["terdaftar"] == 0
    assert result["metrics"]["ponpes_total"] == 34
    assert result["metrics"]["pengawasan_belum_dikonfirmasi"] == 34
