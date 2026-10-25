from sqlalchemy import MetaData, create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from backend.config import settings
from backend.database_options import connection_options, is_tidb_url, verify_tidb_mode


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


engine = create_engine(
    settings.resolved_database_url,
    pool_pre_ping=True,
    pool_recycle=1800,
    hide_parameters=True,
    **connection_options(
        settings.resolved_database_url,
        database_backend=settings.database_backend,
        tls_ca=settings.database_tls_ca,
    ),
)
if settings.database_backend == "tidb" or is_tidb_url(settings.resolved_database_url):
    event.listen(engine, "connect", lambda connection, _: verify_tidb_mode(connection))
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as db:
        yield db
