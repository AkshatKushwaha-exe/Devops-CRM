from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Activity


def test_contact_lifecycle(client, contact_payload):
    created = client.post("/api/contacts", json=contact_payload)
    assert created.status_code == 201
    contact_id = created.json()["id"]
    assert client.get(f"/api/contacts/{contact_id}").json()["name"] == "Priya Sharma"
    assert client.get("/api/contacts").json()["total"] == 1
    edited = client.put(
        f"/api/contacts/{contact_id}", json={**contact_payload, "status": "customer"}
    )
    assert edited.status_code == 200
    assert edited.json()["status"] == "customer"
    assert client.delete(f"/api/contacts/{contact_id}").status_code == 204
    assert client.get(f"/api/contacts/{contact_id}").status_code == 404


def test_duplicate_email_is_case_insensitive_and_rolls_back_activity(
    client, contact, contact_payload, database
):
    response = client.post("/api/contacts", json={**contact_payload, "email": "PRIYA@EXAMPLE.COM"})
    assert response.status_code == 409
    with Session(database) as db:
        assert db.scalar(select(func.count(Activity.id))) == 1
    assert client.get("/api/contacts").json()["total"] == 1


def test_search_and_status_filters(client, contact):
    client.post(
        "/api/contacts", json={"name": "Other", "email": "other@example.com", "status": "customer"}
    )
    assert client.get("/api/contacts?search=BLOOM").json()["total"] == 1
    assert client.get("/api/contacts?status=customer").json()["total"] == 1
    assert client.get("/api/contacts?search=missing").json()["items"] == []


def test_search_treats_wildcards_as_literal(client, contact):
    assert client.get("/api/contacts", params={"search": "%"}).json()["total"] == 0


def test_blank_name_and_bad_email_rejected(client, contact_payload):
    for invalid in ({"name": "   "}, {"email": "broken"}, {"status": "other"}):
        assert client.post("/api/contacts", json={**contact_payload, **invalid}).status_code == 422


def test_contact_pagination(client, contact):
    client.post("/api/contacts", json={"name": "Second", "email": "second@example.com"})
    first = client.get("/api/contacts?limit=1").json()
    second = client.get("/api/contacts?limit=1&offset=1").json()
    assert first["total"] == second["total"] == 2
    assert first["items"][0]["id"] != second["items"][0]["id"]
    assert client.get("/api/contacts?offset=-1").status_code == 422


def test_contact_with_deals_cannot_be_deleted(client, contact, deal_payload):
    deal = client.post("/api/deals", json=deal_payload).json()
    assert client.delete(f"/api/contacts/{contact['id']}").status_code == 409
    assert client.get(f"/api/deals/{deal['id']}").status_code == 200
    client.delete(f"/api/deals/{deal['id']}")
    assert client.delete(f"/api/contacts/{contact['id']}").status_code == 204


def test_update_to_existing_email_is_rejected(client, contact, contact_payload):
    second = client.post(
        "/api/contacts", json={"name": "Second", "email": "second@example.com"}
    ).json()
    response = client.put(f"/api/contacts/{second['id']}", json=contact_payload)
    assert response.status_code == 409
    assert client.get(f"/api/contacts/{second['id']}").json()["email"] == "second@example.com"


def test_unknown_contact_operations(client, contact_payload):
    assert client.put("/api/contacts/999", json=contact_payload).status_code == 404
    assert client.delete("/api/contacts/999").status_code == 404
