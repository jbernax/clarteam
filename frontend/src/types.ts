export interface DepartmentWellbeingSummary {
  department: string;
  headcount: number;
  is_redacted: boolean;
  redaction_reason?: string | null;
  avg_meeting_hours_per_week?: number | null;
  avg_focus_blocks_per_week?: number | null;
  avg_back_to_back_chains?: number | null;
  agenda_hygiene_pct?: number | null;
  inclusion_index_pct?: number | null;
  burnout_risk_level?: string | null;
}

export interface OrganizationHealthOverview {
  active_provider: string;
  scenario_id: string;
  total_employees: number;
  total_meetings_analyzed: number;
  k_anonymity_threshold: number;
  company_wellbeing_score: number;
  company_inclusion_score: number;
  avg_weekly_focus_blocks: number;
  avg_weekly_meeting_hours: number;
  bloated_meeting_count: number;
  zombie_recurring_count: number;
  peer_exclusion_count: number;
  loop_me_in_count: number;
  departments: DepartmentWellbeingSummary[];
}

export interface PeerExclusionAlert {
  alert_id: string;
  squad: string;
  department: string;
  meeting_id: string;
  meeting_category: string;
  organizer_id: string;
  organizer_name: string;
  squad_size: number;
  included_peer_count: number;
  excluded_peer_count: number;
  inclusion_ratio: number;
  severity: string;
  private_organizer_tip: string;
  recommended_action: string;
}

export interface LoopMeInSignal {
  squad: string;
  topic_area: string;
  preferred_remedy: string;
  feeling_note?: string | null;
}

export interface OnaGraphNode {
  id: string;
  label: string;
  squad: string;
  department: string;
  role: string;
  meeting_load_hrs: number;
  is_isolated_risk: boolean;
}

export interface OnaGraphEdge {
  source: string;
  target: string;
  shared_meetings_per_month: number;
  same_squad: boolean;
}

export interface OnaInsightsResponse {
  nodes: OnaGraphNode[];
  edges: OnaGraphEdge[];
  peer_exclusion_alerts: PeerExclusionAlert[];
  loop_me_in_signals: LoopMeInSignal[];
  network_cohesion_score: number;
  silo_risk_summary: string;
}

export interface MeetingDiagnostic {
  meeting_id: string;
  title_category: string;
  organizer_name: string;
  department: string;
  attendee_count: number;
  duration_mins: number;
  is_recurring: boolean;
  series_age_days: number;
  has_agenda: boolean;
  has_doc_link: boolean;
  monthly_person_hours: number;
  issue_types: string[];
  wellbeing_impact: string;
  suggested_fix: string;
  avg_pulse_score?: number | null;
  pulse_count: number;
}

export interface ChannelNudgeBundle {
  nudge_id: string;
  nudge_type: string;
  target_audience: string;
  headline: string;
  body_text: string;
  action_label: string;
  web_portal_payload: Record<string, unknown>;
  slack_block_kit: Record<string, unknown>;
  teams_adaptive_card: Record<string, unknown>;
  generic_webhook_payload: Record<string, unknown>;
}

export interface TeamsSyncReport {
  synced_at: string;
  mode: string;
  users_fetched: number;
  raw_calendar_events_scanned: number;
  deduplicated_series_count: number;
  descriptions_stripped_count: number;
  focus_blocks_computed: boolean;
}

export interface TeamsDeliveryRecord {
  delivery_id: string;
  timestamp: string;
  direction: string;
  mode: string;
  card_type: string;
  target_summary: string;
  status: string;
  envelope_preview: Record<string, unknown>;
}

export interface TeamsConnectorStatusResponse {
  provider_id: string;
  configured: boolean;
  dry_run_mode: boolean;
  tenant_id: string;
  client_id: string;
  client_secret_masked: string;
  teams_webhook_url_masked: string;
  bot_shared_secret_masked: string;
  lookback_days: number;
  required_graph_permissions: string[];
  acknowledged_nudges: string[];
  last_sync_report?: TeamsSyncReport | null;
  activity_ledger: TeamsDeliveryRecord[];
}
