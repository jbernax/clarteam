from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class SourceProviderType(str, Enum):
    SIMULATOR = "simulator"
    CSV_ICS = "csv_ics"
    GOOGLE_WORKSPACE = "google_workspace"
    MICROSOFT_GRAPH = "microsoft_graph"
    CALDAV = "caldav"


class DeliveryChannelType(str, Enum):
    WEB_PORTAL = "web_portal"
    SLACK = "slack"
    MS_TEAMS = "ms_teams"
    GENERIC_WEBHOOK = "generic_webhook"


class Employee(BaseModel):
    id: str
    name: str
    role: str
    department: str
    squad: str
    manager_id: str | None = None
    weekly_focus_blocks: int = Field(
        default=4,
        description="Number of uninterrupted >=2-hour deep work blocks per week",
    )
    back_to_back_chains: int = Field(
        default=1,
        description="Number of >=3 consecutive meeting chains per week",
    )


class MeetingEvent(BaseModel):
    id: str
    title_category: str = Field(
        description="Anonymized category or structural label (e.g., 'Architecture Sync')"
    )
    organizer_id: str
    required_attendees: list[str]
    optional_attendees: list[str] = Field(default_factory=list)
    duration_mins: int
    frequency_per_month: int = Field(
        default=4,
        description="How many times per 30-day window this meeting occurs",
    )
    is_recurring: bool = True
    series_age_days: int = 30
    has_agenda: bool = True
    has_doc_link: bool = False
    source_provider: SourceProviderType = SourceProviderType.SIMULATOR

    @property
    def all_attendees(self) -> list[str]:
        seen = set()
        combined = []
        for emp_id in [self.organizer_id, *self.required_attendees, *self.optional_attendees]:
            if emp_id not in seen:
                seen.add(emp_id)
                combined.append(emp_id)
        return combined


class PulseTag(str, Enum):
    COULD_BE_ASYNC = "could_be_async"
    TOO_MANY_PEOPLE = "too_many_people"
    MISSING_KEY_PEOPLE = "missing_key_people"
    NO_CLEAR_AGENDA = "no_clear_agenda"
    GREAT_DECISIONS = "great_decisions"
    ENERGIZING_INCLUSIVE = "energizing_inclusive"


class MicroPulseSubmission(BaseModel):
    meeting_id: str
    usefulness_score: int = Field(ge=1, le=5)
    tags: list[PulseTag] = Field(default_factory=list)


class LoopMeInRemedy(str, Enum):
    SHARED_ASYNC_NOTES = "shared_async_notes"
    OPTIONAL_INVITE = "optional_invite"
    DECISION_LOG = "decision_log"


class LoopMeInSignal(BaseModel):
    squad: str
    topic_area: str = Field(min_length=2, max_length=120)
    preferred_remedy: LoopMeInRemedy = LoopMeInRemedy.SHARED_ASYNC_NOTES
    feeling_note: str | None = Field(default=None, max_length=280)


class PeerExclusionAlert(BaseModel):
    alert_id: str
    squad: str
    department: str
    meeting_id: str
    meeting_category: str
    organizer_id: str
    organizer_name: str
    squad_size: int
    included_peer_count: int
    excluded_peer_count: int
    inclusion_ratio: float
    severity: str
    private_organizer_tip: str
    recommended_action: str


class MeetingDiagnostic(BaseModel):
    meeting_id: str
    title_category: str
    organizer_name: str
    department: str
    attendee_count: int
    duration_mins: int
    is_recurring: bool
    series_age_days: int
    has_agenda: bool
    has_doc_link: bool
    monthly_person_hours: float
    issue_types: list[str]
    wellbeing_impact: str
    suggested_fix: str
    avg_pulse_score: float | None = None
    pulse_count: int = 0


class DepartmentWellbeingSummary(BaseModel):
    department: str
    headcount: int
    is_redacted: bool
    redaction_reason: str | None = None
    avg_meeting_hours_per_week: float | None = None
    avg_focus_blocks_per_week: float | None = None
    avg_back_to_back_chains: float | None = None
    agenda_hygiene_pct: float | None = None
    inclusion_index_pct: float | None = None
    burnout_risk_level: str | None = None


class OnaGraphNode(BaseModel):
    id: str
    label: str
    squad: str
    department: str
    role: str
    meeting_load_hrs: float
    is_isolated_risk: bool


class OnaGraphEdge(BaseModel):
    source: str
    target: str
    shared_meetings_per_month: int
    same_squad: bool


class OnaInsightsResponse(BaseModel):
    nodes: list[OnaGraphNode]
    edges: list[OnaGraphEdge]
    peer_exclusion_alerts: list[PeerExclusionAlert]
    loop_me_in_signals: list[LoopMeInSignal]
    network_cohesion_score: float
    silo_risk_summary: str


class ChannelNudgeBundle(BaseModel):
    nudge_id: str
    nudge_type: str
    target_audience: str
    headline: str
    body_text: str
    action_label: str
    web_portal_payload: dict[str, Any]
    slack_block_kit: dict[str, Any]
    teams_adaptive_card: dict[str, Any]
    generic_webhook_payload: dict[str, Any]


class OrganizationHealthOverview(BaseModel):
    active_provider: str
    scenario_id: str
    total_employees: int
    total_meetings_analyzed: int
    k_anonymity_threshold: int
    company_wellbeing_score: float
    company_inclusion_score: float
    avg_weekly_focus_blocks: float
    avg_weekly_meeting_hours: float
    bloated_meeting_count: int
    zombie_recurring_count: int
    peer_exclusion_count: int
    loop_me_in_count: int
    departments: list[DepartmentWellbeingSummary]


class TeamsConnectorSettingsInput(BaseModel):
    tenant_id: str = ""
    client_id: str = ""
    client_secret: str | None = None
    teams_webhook_url: str | None = None
    bot_shared_secret: str | None = None
    lookback_days: int = Field(default=30, ge=7, le=90)
    dry_run_mode: bool = True


class TeamsSyncReport(BaseModel):
    synced_at: str
    mode: str
    users_fetched: int
    raw_calendar_events_scanned: int
    deduplicated_series_count: int
    descriptions_stripped_count: int
    focus_blocks_computed: bool


class TeamsDeliveryRecord(BaseModel):
    delivery_id: str
    timestamp: str
    direction: str  # "outbound_nudge" | "inbound_callback"
    mode: str  # "live_webhook" | "dry_run_sandbox" | "inbound_adaptive_card"
    card_type: str
    target_summary: str
    status: str
    envelope_preview: dict[str, Any]


class TeamsAdaptiveCardCallbackPayload(BaseModel):
    action_type: str = Field(
        description="submit_pulse | submit_loop_me_in | acknowledge_nudge"
    )
    nudge_id: str | None = None
    meeting_id: str | None = None
    usefulness_score: int | None = Field(default=None, ge=1, le=5)
    tags: list[PulseTag] = Field(default_factory=list)
    squad: str | None = None
    topic_area: str | None = None
    preferred_remedy: LoopMeInRemedy = LoopMeInRemedy.SHARED_ASYNC_NOTES
    feeling_note: str | None = None
    organizer_resolution: str | None = None


class TeamsConnectorStatusResponse(BaseModel):
    provider_id: str = "microsoft_graph"
    configured: bool
    dry_run_mode: bool
    tenant_id: str
    client_id: str
    client_secret_masked: str
    teams_webhook_url_masked: str
    bot_shared_secret_masked: str
    lookback_days: int
    required_graph_permissions: list[str]
    acknowledged_nudges: list[str]
    last_sync_report: TeamsSyncReport | None = None
    activity_ledger: list[TeamsDeliveryRecord] = Field(default_factory=list)

