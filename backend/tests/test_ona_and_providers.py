from __future__ import annotations

from fastapi.testclient import TestClient
from app.main import app, state
from app.models.domain import SourceProviderType
from app.providers.ingest import (
    SimulatorIngestProvider,
    UniversalCsvIcsProvider,
    normalize_external_api_event,
)
from app.services.ona_engine import (
    compute_organization_health_overview,
    detect_peer_exclusions,
)


client = TestClient(app)


def test_peer_exclusion_detection_finds_torn_apart_squads() -> None:
    provider = SimulatorIngestProvider(scenario="default_mixed")
    employees, meetings = provider.load_organization_data()
    alerts = detect_peer_exclusions(employees, meetings)

    # Should detect Core Platform (4 of 6 included, 2 omitted) and Experience Squad (5 of 6 included, 1 omitted)
    flagged_squads = {a.squad for a in alerts}
    assert "Core Platform" in flagged_squads
    assert "Experience Squad" in flagged_squads

    # Growth Squad and Enterprise CS have all 5 members included, so they must NOT be flagged
    assert "Growth Squad" not in flagged_squads
    assert "Enterprise CS" not in flagged_squads


def test_k_anonymity_strictly_redacts_small_departments() -> None:
    provider = SimulatorIngestProvider(scenario="default_mixed")
    employees, meetings = provider.load_organization_data()
    overview = compute_organization_health_overview(
        active_provider="simulator",
        scenario_id="default_mixed",
        employees=employees,
        meetings=meetings,
        pulses=[],
        loop_me_in_signals=[],
        k_anonymity_threshold=5,
    )

    by_dept = {d.department: d for d in overview.departments}
    # Legal & Security has 3 employees (<5) -> must be redacted
    legal = by_dept["Legal & Security"]
    assert legal.headcount == 3
    assert legal.is_redacted is True
    assert legal.avg_meeting_hours_per_week is None
    assert legal.inclusion_index_pct is None

    # Engineering has 11 employees (>=5) -> must NOT be redacted
    eng = by_dept["Engineering"]
    assert eng.headcount == 11
    assert eng.is_redacted is False
    assert eng.avg_meeting_hours_per_week is not None


def test_universal_csv_and_ics_ingestion() -> None:
    employees_csv = (
        "id,name,role,department,squad,manager_id,weekly_focus_blocks,back_to_back_chains\n"
        "e1,Alice,Dev,Eng,Alpha,m1,4,1\n"
        "e2,Bob,Dev,Eng,Alpha,m1,4,1\n"
        "e3,Charlie,Dev,Eng,Alpha,m1,3,2\n"
        "e4,Diana,Dev,Eng,Alpha,m1,3,2\n"
        "e5,Evan,Dev,Eng,Alpha,m1,5,0\n"
    )
    ics_calendar = (
        "BEGIN:VCALENDAR\n"
        "BEGIN:VEVENT\n"
        "UID:ics-alpha-sync\n"
        "SUMMARY:Alpha Squad Weekly Architecture\n"
        "ORGANIZER:mailto:e1\n"
        "ATTENDEE:mailto:e1\n"
        "ATTENDEE:mailto:e2\n"
        "ATTENDEE:mailto:e3\n"
        "ATTENDEE:mailto:e4\n"
        "RRULE:FREQ=WEEKLY\n"
        "DESCRIPTION:Agenda: 1. API migration 2. Docs at https://docs.google.com/doc1\n"
        "END:VEVENT\n"
        "END:VCALENDAR\n"
    )

    provider = UniversalCsvIcsProvider(employees_csv, ics_calendar)
    employees, meetings = provider.load_organization_data()
    assert len(employees) == 5
    assert len(meetings) == 1
    assert meetings[0].has_agenda is True
    assert meetings[0].has_doc_link is True

    # Because 4 of 5 Alpha squad members are in the weekly ICS event and e5 is omitted, exclusion is detected
    alerts = detect_peer_exclusions(employees, meetings)
    assert len(alerts) == 1
    assert alerts[0].squad == "Alpha"
    assert alerts[0].excluded_peer_count == 1


def test_google_and_msgraph_event_normalization_strips_raw_text() -> None:
    gcal_raw = {
        "id": "g-101",
        "summary": "Backend Sync",
        "description": "Objectives: 1. Review latency 2. Check https://notion.so/team-spec for details",
        "organizer": {"email": "lead@example.org"},
        "attendees": [
            {"email": "lead@example.org"},
            {"email": "dev1@example.org"},
            {"email": "dev2@example.org", "optional": True},
        ],
        "recurringEventId": "rec-1",
    }
    normalized_gcal = normalize_external_api_event(SourceProviderType.GOOGLE_WORKSPACE, gcal_raw)
    assert normalized_gcal.has_agenda is True
    assert normalized_gcal.has_doc_link is True
    assert normalized_gcal.is_recurring is True
    assert normalized_gcal.optional_attendees == ["dev2@example.org"]

    msgraph_raw = {
        "id": "ms-202",
        "subject": "Quick Catchup",
        "body": {"content": "let's talk"},
        "type": "singleInstance",
        "organizer": {"emailAddress": {"address": "pm@example.org"}},
        "attendees": [
            {"type": "required", "emailAddress": {"address": "pm@example.org"}},
            {"type": "required", "emailAddress": {"address": "eng@example.org"}},
        ],
    }
    normalized_ms = normalize_external_api_event(SourceProviderType.MICROSOFT_GRAPH, msgraph_raw)
    assert normalized_ms.has_agenda is False
    assert normalized_ms.has_doc_link is False
    assert normalized_ms.is_recurring is False


def test_fastapi_endpoints_and_multi_channel_nudges() -> None:
    state.load_scenario("default_mixed")

    res_overview = client.get("/api/health/overview")
    assert res_overview.status_code == 200
    data_overview = res_overview.json()
    assert data_overview["total_employees"] == 25
    assert data_overview["peer_exclusion_count"] >= 2

    res_nudges = client.get("/api/nudges/channels")
    assert res_nudges.status_code == 200
    nudges = res_nudges.json()
    assert len(nudges) >= 2
    first_nudge = nudges[0]
    # Verify all 4 open channels are generated for every nudge
    assert "web_portal_payload" in first_nudge
    assert "slack_block_kit" in first_nudge
    assert "teams_adaptive_card" in first_nudge
    assert "generic_webhook_payload" in first_nudge

    # Submit an anonymous Loop-Me-In signal
    res_loop = client.post(
        "/api/inclusion/loop-me-in",
        json={
            "squad": "Experience Squad",
            "topic_area": "Design system token updates",
            "preferred_remedy": "shared_async_notes",
            "feeling_note": "Would love a short summary after syncs!",
        },
    )
    assert res_loop.status_code == 200
    assert res_loop.json()["status"] == "recorded_anonymously"
