from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from alembic import command
from app.db import get_db, make_engine
from app.main import app


@pytest.fixture
def database(tmp_path):
    # Every test gets a new database built by the actual Alembic migration.
    engine = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def client(database):
    factory = sessionmaker(bind=database)

    def override_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def contact_payload():
    return {"name": "Priya Sharma", "email": "priya@example.com", "company": "Bloom"}


@pytest.fixture
def contact(client, contact_payload):
    response = client.post("/api/contacts", json=contact_payload)
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def deal_payload(contact):
    return {"title": "Brand identity", "contact_id": contact["id"], "value": "1500.50"}
