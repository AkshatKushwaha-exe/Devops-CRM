import pytest


def test_deal_lifecycle(client, deal_payload):
    created = client.post("/api/deals", json=deal_payload)
    assert created.status_code == 201
    deal_id = created.json()["id"]
    detail = client.get(f"/api/deals/{deal_id}").json()
    assert detail["contact"]["name"] == "Priya Sharma"
    assert detail["value"] == "1500.50"
    edited = client.put(
        f"/api/deals/{deal_id}",
        json={**deal_payload, "title": "Brand identity plus", "value": "2300.75"},
    )
    assert edited.status_code == 200
    assert edited.json()["value"] == "2300.75"
    assert client.delete(f"/api/deals/{deal_id}").status_code == 204
    assert client.get(f"/api/deals/{deal_id}").status_code == 404


def test_move_deal_and_record_activity(client, deal_payload):
    deal = client.post("/api/deals", json=deal_payload).json()
    response = client.patch(f"/api/deals/{deal['id']}/stage", json={"stage": "won"})
    assert response.status_code == 200
    assert response.json()["stage"] == "won"
    activities = client.get("/api/activities").json()
    assert activities[0]["kind"] == "stage_changed"
    client.patch(f"/api/deals/{deal['id']}/stage", json={"stage": "won"})
    assert len(client.get("/api/activities").json()) == len(activities)


@pytest.mark.parametrize("value", ["-1", "1.001", "10000000000", "NaN", "Infinity"])
def test_invalid_money_rejected(client, deal_payload, value):
    assert client.post("/api/deals", json={**deal_payload, "value": value}).status_code == 422


def test_invalid_contact_and_stage_rejected(client, deal_payload):
    assert client.post("/api/deals", json={**deal_payload, "contact_id": 999}).status_code == 404
    assert client.post("/api/deals", json={**deal_payload, "stage": "invalid"}).status_code == 422


def test_reassign_contact(client, deal_payload):
    other = client.post(
        "/api/contacts", json={"name": "Other", "email": "other@example.com"}
    ).json()
    deal = client.post("/api/deals", json=deal_payload).json()
    updated = client.put(
        f"/api/deals/{deal['id']}", json={**deal_payload, "contact_id": other["id"]}
    )
    assert updated.json()["contact"]["name"] == "Other"
    assert client.delete(f"/api/contacts/{deal_payload['contact_id']}").status_code == 204


def test_filters_and_pagination(client, deal_payload):
    client.post("/api/deals", json=deal_payload)
    client.post("/api/deals", json={**deal_payload, "title": "New project", "stage": "won"})
    assert client.get("/api/deals?stage=won").json()["total"] == 1
    assert client.get("/api/deals?search=bloom").json()["total"] == 2
    assert client.get("/api/deals?search=Brand").json()["total"] == 1
    page = client.get("/api/deals?limit=1&offset=1").json()
    assert page["total"] == 2
    assert len(page["items"]) == 1
    assert client.get("/api/deals?contact_id=999").json()["total"] == 0


def test_invalid_date_and_extra_fields(client, deal_payload):
    assert (
        client.post("/api/deals", json={**deal_payload, "expected_close": "not-a-date"}).status_code
        == 422
    )
    assert client.post("/api/deals", json={**deal_payload, "currency": "USD"}).status_code == 422


def test_unknown_deal_operations(client, deal_payload):
    assert client.put("/api/deals/999", json=deal_payload).status_code == 404
    assert client.patch("/api/deals/999/stage", json={"stage": "won"}).status_code == 404
    assert client.delete("/api/deals/999").status_code == 404
