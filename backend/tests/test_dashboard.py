from decimal import Decimal


def test_empty_dashboard(client):
    data = client.get("/api/dashboard").json()
    assert data["total_contacts"] == data["active_deals"] == 0
    assert Decimal(data["pipeline_value"]) == Decimal(data["won_revenue"]) == 0
    assert data["win_rate"] == 0
    assert len(data["stages"]) == 5


def test_totals_exclude_closed_deals_from_pipeline(client, deal_payload):
    for stage, value in [("new", "0.10"), ("qualified", "0.20"), ("won", "100"), ("lost", "200")]:
        client.post("/api/deals", json={**deal_payload, "stage": stage, "value": value})
    data = client.get("/api/dashboard").json()
    assert data["total_contacts"] == 1
    assert data["active_deals"] == 2
    assert Decimal(data["pipeline_value"]) == Decimal("0.30")
    assert Decimal(data["won_revenue"]) == Decimal("100")
    assert data["win_rate"] == 50


def test_upcoming_deals_order_and_exclude_closed(client, deal_payload):
    for title, date, stage in [
        ("Later", "2030-06-20", "new"),
        ("Sooner", "2030-06-01", "qualified"),
        ("Closed", "2030-05-01", "won"),
    ]:
        client.post(
            "/api/deals",
            json={**deal_payload, "title": title, "expected_close": date, "stage": stage},
        )
    data = client.get("/api/dashboard").json()
    assert [d["title"] for d in data["upcoming_deals"]] == ["Sooner", "Later"]


def test_activity_pagination(client, contact_payload):
    for i in range(3):
        client.post("/api/contacts", json={**contact_payload, "email": f"person{i}@example.com"})
    first = client.get("/api/activities?limit=1").json()
    second = client.get("/api/activities?limit=1&offset=1").json()
    assert len(first) == len(second) == 1
    assert first[0]["id"] > second[0]["id"]


def test_dashboard_reflects_stage_update_and_deletion(client, deal_payload):
    deal = client.post("/api/deals", json=deal_payload).json()
    assert client.get("/api/dashboard").json()["active_deals"] == 1
    client.patch(f"/api/deals/{deal['id']}/stage", json={"stage": "won"})
    assert client.get("/api/dashboard").json()["active_deals"] == 0
    assert Decimal(client.get("/api/dashboard").json()["won_revenue"]) == Decimal("1500.50")
    client.delete(f"/api/deals/{deal['id']}")
    assert Decimal(client.get("/api/dashboard").json()["won_revenue"]) == 0
