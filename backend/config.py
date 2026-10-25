from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(ROOT / ".env", ROOT / "backend/.env"), extra="ignore")
    database_url: str = Field(default="", repr=False)
    database_backend: Literal["mysql", "tidb"] = "mysql"
    tidb_database_url: str | None = Field(default=None, repr=False)
    database_tls_ca: str | None = None
    jwt_secret: str = Field(min_length=32, repr=False)
    app_env: str = "development"
    demo_mode: bool = True
    demo_accounts_enabled: bool = True
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    upload_dir: Path = ROOT / "storage/uploads"
    rate_limit_enabled: bool = True
    rate_limit_storage_uri: str = "memory://"
    public_frontend_url: str = "http://localhost:5173"
    frontend_dist: Path = ROOT / "frontend/dist"
    serve_frontend: bool = False
    render_external_url: str | None = None
    groq_api_key: SecretStr | None = None
    groq_vision_model: str = "qwen/qwen3.8-27b"
    groq_timeout_seconds: float = Field(default=35, ge=1, le=90)
    ocr_enabled: bool = True

    @property
    def resolved_database_url(self) -> str:
        value = self.tidb_database_url if self.database_backend == "tidb" else self.database_url
        if not value:
            variable = "TIDB_DATABASE_URL" if self.database_backend == "tidb" else "DATABASE_URL"
            raise ValueError(f"Isi {variable} untuk koneksi database")
        url = make_url(value)
        if url.drivername == "mysql":
            url = url.set(drivername="mysql+pymysql")
        return url.render_as_string(hide_password=False)

    @model_validator(mode="after")
    def production_settings(self):
        if self.app_env == "production":
            if self.demo_mode:
                raise ValueError("DEMO_MODE harus false pada production")
            if make_url(self.resolved_database_url).drivername != "mysql+pymysql":
                raise ValueError("Production memerlukan database MySQL/TiDB melalui PyMySQL")
            if self.render_external_url:
                self.public_frontend_url = self.render_external_url.rstrip("/")
                self.cors_origins = [self.public_frontend_url]
        return self

    @field_validator("jwt_secret")
    @classmethod
    def reject_placeholder(cls, value):
        if value.startswith("CHANGE_ME"):
            raise ValueError("Generate a random JWT_SECRET before starting the application")
        return value


settings = Settings()
