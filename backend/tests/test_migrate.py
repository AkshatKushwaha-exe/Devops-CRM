import pytest
from sqlalchemy import inspect, text

from app import migrate
from app.db import make_engine


@pytest.fixture
def empty_engine(tmp_path, monkeypatch):
    engine = make_engine(f"sqlite:///{tmp_path / 'migrate.db'}")
    monkeypatch.setattr(migrate, "engine", engine)
    yield engine
    engine.dispose()


def state(engine):
    with engine.connect() as connection:
        return migrate.schema_state(connection, migrate.alembic_config())


def test_upgrade_applies_pending_migrations_once(empty_engine):
    assert state(empty_engine) is migrate.SchemaState.PENDING
    assert migrate.upgrade(timeout=5) is migrate.SchemaState.PENDING
    assert {"contacts", "deals", "activities"} <= set(inspect(empty_engine).get_table_names())
    assert state(empty_engine) is migrate.SchemaState.CURRENT
    assert migrate.upgrade(timeout=5) is migrate.SchemaState.CURRENT


def test_database_ahead_of_image_is_left_unchanged(empty_engine):
    migrate.upgrade(timeout=5)
    with empty_engine.begin() as connection:
        connection.execute(text("UPDATE alembic_version SET version_num = '9999_future'"))
    assert migrate.upgrade(timeout=5) is migrate.SchemaState.AHEAD
    assert migrate.wait(timeout=5) is migrate.SchemaState.AHEAD


def test_wait_times_out_while_migrations_are_pending(empty_engine):
    with pytest.raises(SystemExit, match="still pending"):
        migrate.wait(timeout=0, interval=0)


def test_wait_returns_once_schema_is_current(empty_engine, capsys):
    migrate.upgrade(timeout=5)
    migrate.main(["wait", "--timeout", "5"])
    assert "already at head" in capsys.readouterr().out
