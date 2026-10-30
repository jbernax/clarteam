from __future__ import annotations

import os
from typing import Any
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.models.domain import (
    ChannelNudgeBundle,
    Employee,
    LoopMeInRemedy,
    LoopMeInSignal,
    MeetingDiagnostic,
    MeetingEvent,
    MicroPulseSubmission,
    OnaInsightsResponse,
    OrganizationHealthOverview,
    PulseTag,
    TeamsAdaptiveCardCallbackPayload,
    TeamsConnectorSettingsInput,
    TeamsConnectorStatusResponse,
    TeamsDeliveryRecord,
)
from app.providers.channels import generate_nudges_from_diagnostics
from app.providers.ingest import SimulatorIngestProvider, UniversalCsvIcsProvider
from app.providers.ms_teams_connector import (
    MicrosoftGraphIngestProvider,
    MicrosoftTeamsDeliveryClient,
    TeamsConnectorConfig,
)
from app.services.ona_engine import (
    analyze_meeting_diagnostics,
    build_ona_insights,
    compute_organization_health_overview,
    detect_peer_exclusions,
)

K_ANONYMITY_THRESHOLD = int(os.getenv("K_ANONYMITY_THRESHOLD", "5"))


class AppState:
    def __init__(self) -> None:
        self.active_provider_id = "simulator"
        self.scenario_id = "default_mixed"
        provider = SimulatorIngestProvider(scenario=self.scenario_id)
        self.employees: list[Employee]
        self.meetings: list[MeetingEvent]
        self.employees, self.meetings = provider.load_organization_data()
        self.teams_config = TeamsConnectorConfig()
        self.teams_graph_provider = MicrosoftGraphIngestProvider(self.teams_config)
        self.teams_delivery = MicrosoftTeamsDeliveryClient(self.teams_config)
        self.pulses: list[MicroPulseSubmission] = [
            MicroPulseSubmission(
                meeting_id="mtg-bloated-status",
                usefulness_score=2,
                tags=[PulseTag.COULD_BE_ASYNC, PulseTag.TOO_MANY_PEOPLE, PulseTag.NO_CLEAR_AGENDA],
            ),
            MicroPulseSubmission(
                meeting_id="mtg-bloated-status",
                usefulness_score=1,
                tags=[PulseTag.COULD_BE_ASYNC, PulseTag.TOO_MANY_PEOPLE],
            ),
            MicroPulseSubmission(
                meeting_id="mtg-core-arch",
                usefulness_score=3,
                tags=[PulseTag.MISSING_KEY_PEOPLE, PulseTag.NO_CLEAR_AGENDA],
            ),
            MicroPulseSubmission(
                meeting_id="mtg-growth-sprint",
                usefulness_score=5,
                tags=[PulseTag.GREAT_DECISIONS, PulseTag.ENERGIZING_INCLUSIVE],
            ),
        ]
        self.loop_me_in_signals: list[LoopMeInSignal] = [
            LoopMeInSignal(
                squad="Core Platform",
                topic_area="Database sharding & service boundary decisions",
                preferred_remedy=LoopMeInRemedy.SHARED_ASYNC_NOTES,
                feeling_note="Key schema changes are decided in small syncs without written ADR notes for the rest of the squad.",
            )
        ]

    def load_scenario(self, scenario_id: str) -> None:
        if scenario_id not in ("default_mixed", "exclusion_heavy", "overload_crisis"):
            raise ValueError(f"Unknown scenario: {scenario_id}")
        self.active_provider_id = "simulator"
        self.scenario_id = scenario_id
        provider = SimulatorIngestProvider(scenario=scenario_id)
        self.employees, self.meetings = provider.load_organization_data()

    def load_csv_ics(self, employees_csv: str, meetings_csv_or_ics: str) -> None:
        provider = UniversalCsvIcsProvider(employees_csv, meetings_csv_or_ics)
        employees, meetings = provider.load_organization_data()
        if not employees or not meetings:
            raise ValueError("CSV/ICS payload must include at least 1 employee and 1 meeting.")
        self.active_provider_id = "csv_ics"
        self.scenario_id = "custom_import"
        self.employees = employees
        self.meetings = meetings

    def sync_microsoft_teams_graph(self) -> None:
        employees, meetings = self.teams_graph_provider.load_organization_data()
        self.active_provider_id = "microsoft_graph"
        self.scenario_id = (
            "ms_graph_sandbox" if self.teams_config.dry_run_mode else "ms_graph_live"
        )
        self.employees = employees
        self.meetings = meetings


state = AppState()

app = FastAPI(
    title="ClarTeam API",
    description="Team Clarity & Cohesion Without Meeting Overload — Open-Source Meeting Culture & Inclusion Engine",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScenarioSwitchRequest(BaseModel):
    scenario_id: str


class CsvIcsImportRequest(BaseModel):
    employees_csv: str
    meetings_csv_or_ics: str


class TeamsDispatchRequest(BaseModel):
    nudge_id: str | None = None


@app.get("/api/health/overview", response_model=OrganizationHealthOverview)
def get_health_overview() -> OrganizationHealthOverview:
    return compute_organization_health_overview(
        active_provider=state.active_provider_id,
        scenario_id=state.scenario_id,
        employees=state.employees,
        meetings=state.meetings,
        pulses=state.pulses,
        loop_me_in_signals=state.loop_me_in_signals,
        k_anonymity_threshold=K_ANONYMITY_THRESHOLD,
    )


@app.get("/api/ona/insights", response_model=OnaInsightsResponse)
def get_ona_insights() -> OnaInsightsResponse:
    return build_ona_insights(
        employees=state.employees,
        meetings=state.meetings,
        loop_me_in_signals=state.loop_me_in_signals,
    )


@app.get("/api/meetings/diagnostics", response_model=list[MeetingDiagnostic])
def get_meeting_diagnostics() -> list[MeetingDiagnostic]:
    return analyze_meeting_diagnostics(
        employees=state.employees,
        meetings=state.meetings,
        pulses=state.pulses,
    )


@app.get("/api/nudges/channels", response_model=list[ChannelNudgeBundle])
def get_multi_channel_nudges() -> list[ChannelNudgeBundle]:
    exclusion_alerts = detect_peer_exclusions(state.employees, state.meetings)
    diagnostics = analyze_meeting_diagnostics(state.employees, state.meetings, state.pulses)
    return generate_nudges_from_diagnostics(exclusion_alerts, diagnostics)


@app.get("/api/providers/catalog")
def get_providers_catalog() -> dict[str, Any]:
    return {
        "active_provider": state.active_provider_id,
        "active_scenario": state.scenario_id,
        "ingest_providers": [
            {
                "id": "csv_ics",
                "name": "Universal CSV / ICS Import",
                "status": "ready",
                "requires_admin": False,
                "description": "Zero lock-in: import standard CSV org charts & .ics/.csv calendar exports from any tool (Nextcloud, Google, Outlook, Fastmail).",
            },
            {
                "id": "google_workspace",
                "name": "Google Workspace (Calendar + Directory)",
                "status": "adapter_ready",
                "requires_admin": True,
                "description": "Normalizes Google Calendar API events into privacy-stripped metadata.",
            },
            {
                "id": "microsoft_graph",
                "name": "Microsoft 365 / Teams (Two-Way Graph & Webhook Connector)",
                "status": "ready",
                "requires_admin": True,
                "description": "Two-way connector: ingests Users & CalendarView metadata (computing Focus & Back-to-Back blocks) and delivers interactive Adaptive Cards.",
            },
            {
                "id": "simulator",
                "name": "Built-in Organization Simulator",
                "status": "active",
                "requires_admin": False,
                "description": "Test ONA exclusion detection, burnout prevention, and k-anonymity out of the box.",
            },
        ],
        "delivery_channels": [
            {"id": "web_portal", "name": "Standalone Web Portal & Email Links (Zero Chat Bot Needed)"},
            {"id": "slack", "name": "Slack Block Kit"},
            {"id": "ms_teams", "name": "Microsoft Teams Adaptive Cards"},
            {"id": "generic_webhook", "name": "Generic Webhook / Markdown (Mattermost, Discord, Matrix)"},
        ],
    }


@app.post("/api/simulator/scenario", response_model=OrganizationHealthOverview)
def switch_simulator_scenario(req: ScenarioSwitchRequest) -> OrganizationHealthOverview:
    try:
        state.load_scenario(req.scenario_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_health_overview()


@app.post("/api/import/csv-ics", response_model=OrganizationHealthOverview)
def import_csv_ics_data(req: CsvIcsImportRequest) -> OrganizationHealthOverview:
    try:
        state.load_csv_ics(req.employees_csv, req.meetings_csv_or_ics)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_health_overview()


@app.post("/api/pulse/submit")
def submit_micro_pulse(submission: MicroPulseSubmission) -> dict[str, Any]:
    state.pulses.append(submission)
    return {
        "status": "recorded_anonymously",
        "total_pulses": len(state.pulses),
        "privacy_note": "Stored without user ID or IP address; aggregated at meeting & cohort level.",
    }


@app.post("/api/inclusion/loop-me-in")
def submit_loop_me_in_signal(signal: LoopMeInSignal) -> dict[str, Any]:
    state.loop_me_in_signals.append(signal)
    return {
        "status": "recorded_anonymously",
        "total_signals": len(state.loop_me_in_signals),
        "privacy_note": "Your identity is never attached. Organizers in this squad will receive a constructive tip to share async decision notes.",
    }


# ---------------------------------------------------------------------------
# Microsoft Teams Two-Way Connector Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/connectors/teams/status", response_model=TeamsConnectorStatusResponse)
def get_teams_connector_status() -> TeamsConnectorStatusResponse:
    return state.teams_config.to_status_response(
        acknowledged_nudges=state.teams_delivery.acknowledged_nudges,
        last_sync_report=state.teams_graph_provider.last_sync_report,
        activity_ledger=state.teams_delivery.activity_ledger,
    )


@app.post("/api/connectors/teams/config", response_model=TeamsConnectorStatusResponse)
def update_teams_connector_config(
    settings: TeamsConnectorSettingsInput,
) -> TeamsConnectorStatusResponse:
    try:
        state.teams_config.update_from_input(settings)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return get_teams_connector_status()


@app.post("/api/connectors/teams/sync", response_model=TeamsConnectorStatusResponse)
def sync_teams_graph_data() -> TeamsConnectorStatusResponse:
    try:
        state.sync_microsoft_teams_graph()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return get_teams_connector_status()


@app.post("/api/connectors/teams/dispatch", response_model=TeamsDeliveryRecord)
def dispatch_teams_nudge(req: TeamsDispatchRequest) -> TeamsDeliveryRecord:
    nudges = get_multi_channel_nudges()
    if not nudges:
        raise HTTPException(status_code=404, detail="No active coaching nudges to dispatch.")

    selected = next((n for n in nudges if n.nudge_id == req.nudge_id), nudges[0])
    try:
        return state.teams_delivery.dispatch_adaptive_card(selected)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/connectors/teams/webhook/callback")
def handle_teams_adaptive_card_callback(
    payload: TeamsAdaptiveCardCallbackPayload,
    x_teams_webhook_secret: str | None = Header(default=None),
) -> dict[str, Any]:
    if state.teams_config.bot_shared_secret:
        if x_teams_webhook_secret != state.teams_config.bot_shared_secret:
            raise HTTPException(
                status_code=401,
                detail="Invalid X-Teams-Webhook-Secret header for Teams Adaptive Card callback.",
            )

    if payload.action_type == "submit_pulse":
        if not payload.meeting_id or payload.usefulness_score is None:
            raise HTTPException(
                status_code=400,
                detail="submit_pulse requires meeting_id and usefulness_score.",
            )
        state.pulses.append(
            MicroPulseSubmission(
                meeting_id=payload.meeting_id,
                usefulness_score=payload.usefulness_score,
                tags=payload.tags,
            )
        )
        rec = state.teams_delivery.record_inbound_callback(
            action_type="submit_pulse",
            target_summary=f"Meeting {payload.meeting_id} ({payload.usefulness_score}★)",
            payload_dict=payload.model_dump(),
        )
        return {
            "status": "pulse_recorded_from_teams_card",
            "delivery_id": rec.delivery_id,
            "total_pulses": len(state.pulses),
        }

    if payload.action_type == "submit_loop_me_in":
        if not payload.squad or not payload.topic_area:
            raise HTTPException(
                status_code=400,
                detail="submit_loop_me_in requires squad and topic_area.",
            )
        state.loop_me_in_signals.append(
            LoopMeInSignal(
                squad=payload.squad,
                topic_area=payload.topic_area,
                preferred_remedy=payload.preferred_remedy,
                feeling_note=payload.feeling_note,
            )
        )
        rec = state.teams_delivery.record_inbound_callback(
            action_type="submit_loop_me_in",
            target_summary=f"Squad {payload.squad}: {payload.topic_area}",
            payload_dict=payload.model_dump(),
        )
        return {
            "status": "loop_me_in_recorded_from_teams_card",
            "delivery_id": rec.delivery_id,
            "total_signals": len(state.loop_me_in_signals),
        }

    if payload.action_type == "acknowledge_nudge":
        nudge_id = payload.nudge_id or "unknown-nudge"
        if nudge_id not in state.teams_delivery.acknowledged_nudges:
            state.teams_delivery.acknowledged_nudges.append(nudge_id)
        rec = state.teams_delivery.record_inbound_callback(
            action_type="acknowledge_nudge",
            target_summary=f"Organizer acknowledged {nudge_id}",
            payload_dict=payload.model_dump(),
        )
        return {
            "status": "nudge_acknowledged_by_organizer",
            "delivery_id": rec.delivery_id,
            "acknowledged_nudges": state.teams_delivery.acknowledged_nudges,
        }

    raise HTTPException(
        status_code=400,
        detail=f"Unsupported Teams Adaptive Card action_type: {payload.action_type}",
    )
