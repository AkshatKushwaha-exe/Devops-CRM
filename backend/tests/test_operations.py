from pathlib import Path

from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from alembic import command
from app.db import get_db
from app.main import app


def test_health_and_readiness(client):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/ready").json() == {"status": "ready"}


def test_metrics_exposed_without_record_ids(client, contact):
    client.get(f"/api/contacts/{contact['id']}")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]
    assert "crm_http_requests_total" in response.text
    assert 'route="/api/contacts/{contact_id}"' in response.text


def test_unavailable_database_returns_safe_error(client):
    def broken_db():
        raise OperationalError("SELECT 1", {}, Exception("private database detail"))
        yield  # dependency remains a generator

    app.dependency_overrides[get_db] = broken_db
    response = client.get("/ready")
    assert response.status_code == 503
    assert "private" not in response.text
    assert client.get("/health").status_code == 200


def test_migration_roundtrip(database):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    with database.begin() as connection:
        assert {"contacts", "deals", "activities"} <= set(inspect(connection).get_table_names())
        assert (
            connection.execute(text("SELECT version_num FROM alembic_version")).scalar() == "0001"
        )
        config.attributes["connection"] = connection
        command.downgrade(config, "base")
        assert "contacts" not in inspect(connection).get_table_names()
        command.upgrade(config, "head")
        assert "contacts" in inspect(connection).get_table_names()


def test_seed_is_idempotent(database, monkeypatch, client):
    from sqlalchemy import func, select
    from sqlalchemy.orm import sessionmaker

    from app import seed
    from app.models import Contact, Deal

    factory = sessionmaker(bind=database)
    monkeypatch.setattr(seed, "SessionLocal", factory)
    seed.seed()
    seed.seed()
    with factory() as db:
        assert db.scalar(select(func.count(Contact.id))) == 8
        assert db.scalar(select(func.count(Deal.id))) == 9
    for path in ("/api/contacts", "/api/deals", "/api/dashboard"):
        assert client.get(path).status_code == 200


def test_api_docs_are_served_under_the_api_prefix(client):
    assert client.get("/api/openapi.json").json()["info"]["title"] == "DevOps CRM"
    assert client.get("/api/docs").status_code == 200
    assert client.get("/docs").status_code == 404


def test_version_reports_the_build(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "app_version", "014afef")
    monkeypatch.setattr(settings, "app_environment", "Production")
    assert client.get("/api/version").json() == {"version": "014afef", "environment": "Production"}
