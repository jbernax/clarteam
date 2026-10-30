from __future__ import annotations

from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app, state
from app.providers.ms_teams_connector import (
    compute_focus_and_b2b_from_timestamps,
    validate_teams_webhook_url,
)

client = TestClient(app)


def test_teams_webhook_ssrf_validation() -> None:
    valid_url = "https://contoso.webhook.office.com/webhookb2/abc-123/IncomingWebhook/xyz"
    assert validate_teams_webhook_url(valid_url) == valid_url

    with pytest.raises(ValueError, match="https://"):
        validate_teams_webhook_url("http://contoso.webhook.office.com/webhook")

    with pytest.raises(ValueError, match="localhost"):
        validate_teams_webhook_url("https://localhost/webhook")

    with pytest.raises(ValueError, match="Untrusted webhook host"):
        validate_teams_webhook_url("https://evil-attacker.example.com/steal")


def test_secret_redaction_in_teams_connector_config() -> None:
    res = client.post(
        "/api/connectors/teams/config",
        json={
            "tenant_id": "contoso-tenant-id",
            "client_id": "contoso-client-id",
            "client_secret": "super-secret-azure-ad-key",
            "teams_webhook_url": "https://contoso.webhook.office.com/webhookb2/secret-token",
            "bot_shared_secret": "my-shared-hmac-secret",
            "lookback_days": 30,
            "dry_run_mode": True,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["tenant_id"] == "contoso-tenant-id"
    assert body["client_id"] == "contoso-client-id"
    # Secrets MUST be masked as <REDACTED>
    assert body["client_secret_masked"] == "<REDACTED>"
    assert body["teams_webhook_url_masked"] == "<REDACTED>"
    assert body["bot_shared_secret_masked"] == "<REDACTED>"
    assert "super-secret-azure-ad-key" not in res.text
    assert "secret-token" not in res.text
    assert "my-shared-hmac-secret" not in res.text

    # Reset shared secret so subsequent callback tests don't require header unless tested
    state.teams_config.bot_shared_secret = ""


def test_compute_focus_and_b2b_from_timestamps() -> None:
    # Day with 3 back-to-back meetings (09:00-10:00, 10:00-11:00, 11:00-12:00)
    # Leaves 12:00-17:30 (330 mins = two >=120m focus blocks on that day)
    intervals = [
        (
            datetime(2026, 10, 26, 9, 0, tzinfo=timezone.utc),
            datetime(2026, 10, 26, 10, 0, tzinfo=timezone.utc),
        ),
        (
            datetime(2026, 10, 26, 10, 0, tzinfo=timezone.utc),
            datetime(2026, 10, 26, 11, 0, tzinfo=timezone.utc),
        ),
        (
            datetime(2026, 10, 26, 11, 0, tzinfo=timezone.utc),
            datetime(2026, 10, 26, 12, 0, tzinfo=timezone.utc),
        ),
    ]
    focus_blocks, b2b_chains = compute_focus_and_b2b_from_timestamps(intervals)
    assert b2b_chains == 1
    assert focus_blocks >= 2


def test_full_two_way_teams_connector_sync_dispatch_and_callbacks() -> None:
    # 1. Trigger MS Graph Sync (Sandbox mode)
    sync_res = client.post("/api/connectors/teams/sync")
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    report = sync_data["last_sync_report"]
    assert report is not None
    assert report["users_fetched"] == 19
    assert report["deduplicated_series_count"] == 4
    assert report["descriptions_stripped_count"] > 0

    # Verify ONA detected partial-squad exclusion in 'Cloud Core Squad' and 'Checkout Squad'
    ona_res = client.get("/api/ona/insights")
    assert ona_res.status_code == 200
    ona_squads = {a["squad"] for a in ona_res.json()["peer_exclusion_alerts"]}
    assert "Cloud Core Squad" in ona_squads
    assert "Checkout Squad" in ona_squads

    # Verify k-anonymity redacts the 3-person 'Security & Compliance' department
    ov_res = client.get("/api/health/overview")
    depts = {d["department"]: d for d in ov_res.json()["departments"]}
    assert depts["Security & Compliance"]["is_redacted"] is True
    assert depts["Engineering"]["is_redacted"] is False

    # 2. Dispatch an outbound Adaptive Card v1.5 to Microsoft Teams
    disp_res = client.post("/api/connectors/teams/dispatch", json={})
    assert disp_res.status_code == 200
    disp_record = disp_res.json()
    assert disp_record["direction"] == "outbound_nudge"
    assert disp_record["envelope_preview"]["type"] == "message"
    attachments = disp_record["envelope_preview"]["attachments"]
    assert attachments[0]["contentType"] == "application/vnd.microsoft.card.adaptive"

    # 3. Simulate Inbound Adaptive Card callbacks from Microsoft Teams
    cb_pulse = client.post(
        "/api/connectors/teams/webhook/callback",
        json={
            "action_type": "submit_pulse",
            "meeting_id": "ms-series-weekly-status",
            "usefulness_score": 2,
            "tags": ["could_be_async", "too_many_people"],
        },
    )
    assert cb_pulse.status_code == 200
    assert cb_pulse.json()["status"] == "pulse_recorded_from_teams_card"

    cb_loop = client.post(
        "/api/connectors/teams/webhook/callback",
        json={
            "action_type": "submit_loop_me_in",
            "squad": "Cloud Core Squad",
            "topic_area": "Multi-region failover architecture",
            "preferred_remedy": "shared_async_notes",
            "feeling_note": "Would love a 3-bullet summary in the Teams channel after the sync.",
        },
    )
    assert cb_loop.status_code == 200
    assert cb_loop.json()["status"] == "loop_me_in_recorded_from_teams_card"

    cb_ack = client.post(
        "/api/connectors/teams/webhook/callback",
        json={
            "action_type": "acknowledge_nudge",
            "nudge_id": "nudge-excl-ms-series-cloud-arch-cloud-core-squad",
            "organizer_resolution": "Added omitted squad members as Optional and shared OneNote link",
        },
    )
    assert cb_ack.status_code == 200
    assert "nudge-excl-ms-series-cloud-arch-cloud-core-squad" in cb_ack.json()["acknowledged_nudges"]

    # Restore default simulator scenario for other tests
    state.load_scenario("default_mixed")
