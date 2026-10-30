from __future__ import annotations

import os
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse
import httpx

from app.models.domain import (
    ChannelNudgeBundle,
    Employee,
    MeetingEvent,
    SourceProviderType,
    TeamsConnectorSettingsInput,
    TeamsConnectorStatusResponse,
    TeamsDeliveryRecord,
    TeamsSyncReport,
)
from app.providers.base import CalendarIngestProvider, extract_agenda_hygiene_from_text

ALLOWED_TEAMS_WEBHOOK_SUFFIXES = (
    ".webhook.office.com",
    ".office.com",
    ".logic.azure.com",
    ".api.powerplatform.com",
    ".teams.microsoft.com",
)


def validate_teams_webhook_url(url: str | None) -> str | None:
    """
    Validates a Microsoft Teams Incoming Webhook / Workflows URL to prevent SSRF attacks.
    Requires HTTPS and a trusted Microsoft Teams / Office 365 / Power Platform domain.
    """
    if not url or not url.strip():
        return None
    cleaned = url.strip()
    if cleaned == "<REDACTED>":
        return None

    parsed = urlparse(cleaned)
    if parsed.scheme.lower() != "https":
        raise ValueError("Microsoft Teams webhook URL must use https:// scheme.")

    host = (parsed.hostname or "").lower()
    if not host or host in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        raise ValueError("Webhook hostname cannot be localhost or a loopback address.")

    if not any(host.endswith(suffix) for suffix in ALLOWED_TEAMS_WEBHOOK_SUFFIXES):
        raise ValueError(
            f"Untrusted webhook host '{host}'. Must end with one of: {', '.join(ALLOWED_TEAMS_WEBHOOK_SUFFIXES)}"
        )

    return cleaned


def mask_sensitive_value(value: str | None) -> str:
    """Redacts any secret, token, or webhook URL with <REDACTED> per security rules."""
    if not value or not value.strip():
        return "not_configured"
    return "<REDACTED>"


class TeamsConnectorConfig:
    """Holds Microsoft Graph & Teams Connector settings in memory, initialized from env vars."""

    def __init__(self) -> None:
        self.tenant_id: str = os.getenv("MS_TENANT_ID", "").strip()
        self.client_id: str = os.getenv("MS_CLIENT_ID", "").strip()
        self.client_secret: str = os.getenv("MS_CLIENT_SECRET", "").strip()
        raw_webhook = os.getenv("MS_TEAMS_WEBHOOK_URL", "").strip()
        self.teams_webhook_url: str | None = (
            validate_teams_webhook_url(raw_webhook) if raw_webhook else None
        )
        self.bot_shared_secret: str = os.getenv("MS_BOT_SHARED_SECRET", "").strip()
        self.lookback_days: int = 30
        self.dry_run_mode: bool = (
            os.getenv("MS_GRAPH_DRY_RUN", "true").strip().lower() != "false"
        )

    def update_from_input(self, settings: TeamsConnectorSettingsInput) -> None:
        self.tenant_id = settings.tenant_id.strip()
        self.client_id = settings.client_id.strip()
        if settings.client_secret and settings.client_secret != "<REDACTED>":
            self.client_secret = settings.client_secret.strip()
        if settings.teams_webhook_url is not None:
            if settings.teams_webhook_url == "<REDACTED>":
                pass
            elif settings.teams_webhook_url.strip() == "":
                self.teams_webhook_url = None
            else:
                self.teams_webhook_url = validate_teams_webhook_url(settings.teams_webhook_url)
        if settings.bot_shared_secret and settings.bot_shared_secret != "<REDACTED>":
            self.bot_shared_secret = settings.bot_shared_secret.strip()
        self.lookback_days = settings.lookback_days
        self.dry_run_mode = settings.dry_run_mode

    @property
    def has_live_graph_credentials(self) -> bool:
        return bool(self.tenant_id and self.client_id and self.client_secret)

    def to_status_response(
        self,
        acknowledged_nudges: list[str],
        last_sync_report: TeamsSyncReport | None,
        activity_ledger: list[TeamsDeliveryRecord],
    ) -> TeamsConnectorStatusResponse:
        return TeamsConnectorStatusResponse(
            provider_id="microsoft_graph",
            configured=self.has_live_graph_credentials or self.dry_run_mode,
            dry_run_mode=self.dry_run_mode,
            tenant_id=self.tenant_id or "sandbox-tenant-001",
            client_id=self.client_id or "sandbox-client-app",
            client_secret_masked=mask_sensitive_value(self.client_secret),
            teams_webhook_url_masked=mask_sensitive_value(self.teams_webhook_url),
            bot_shared_secret_masked=mask_sensitive_value(self.bot_shared_secret),
            lookback_days=self.lookback_days,
            required_graph_permissions=[
                "User.Read.All (Application)",
                "Calendars.Read (Application)",
            ],
            acknowledged_nudges=acknowledged_nudges,
            last_sync_report=last_sync_report,
            activity_ledger=activity_ledger,
        )


def compute_focus_and_b2b_from_timestamps(
    intervals: list[tuple[datetime, datetime]],
) -> tuple[int, int]:
    """
    Analyzes calendar event (start, end) timestamps across a 5-day workweek (09:00 - 17:30)
    to compute:
      1. weekly_focus_blocks: number of uninterrupted >= 120-minute windows
      2. back_to_back_chains: number of chains of >= 3 consecutive meetings (gap <= 5 mins)
    """
    if not intervals:
        return 5, 0

    by_date: dict[str, list[tuple[datetime, datetime]]] = defaultdict(list)
    for start_dt, end_dt in intervals:
        if end_dt > start_dt:
            by_date[start_dt.strftime("%Y-%m-%d")].append((start_dt, end_dt))

    total_focus_blocks = 0
    total_b2b_chains = 0

    # Evaluate up to 5 active workdays
    sorted_days = sorted(by_date.keys())[:5]
    for day_str in sorted_days:
        day_events = sorted(by_date[day_str], key=lambda pair: pair[0])

        # 1. Count back-to-back chains (>=3 consecutive meetings with <=5 min break)
        chain_len = 1
        for i in range(1, len(day_events)):
            prev_end = day_events[i - 1][1]
            curr_start = day_events[i][0]
            gap_mins = (curr_start - prev_end).total_seconds() / 60.0
            if -15.0 <= gap_mins <= 5.0:
                chain_len += 1
            else:
                if chain_len >= 3:
                    total_b2b_chains += 1
                chain_len = 1
        if chain_len >= 3:
            total_b2b_chains += 1

        # 2. Merge overlapping intervals and count >= 120m gaps between 09:00 and 17:30
        merged: list[tuple[datetime, datetime]] = []
        for s, e in day_events:
            if not merged or s > merged[-1][1]:
                merged.append((s, e))
            else:
                merged[-1] = (merged[-1][0], max(merged[-1][1], e))

        sample_dt = merged[0][0]
        work_start = sample_dt.replace(hour=9, minute=0, second=0, microsecond=0)
        work_end = sample_dt.replace(hour=17, minute=30, second=0, microsecond=0)

        cursor = work_start
        for s, e in merged:
            if s > cursor:
                free_mins = (min(s, work_end) - cursor).total_seconds() / 60.0
                if free_mins >= 120.0:
                    total_focus_blocks += int(free_mins // 120.0)
            cursor = max(cursor, e)

        if cursor < work_end:
            tail_mins = (work_end - cursor).total_seconds() / 60.0
            if tail_mins >= 120.0:
                total_focus_blocks += int(tail_mins // 120.0)

    # Add remaining open days in a 5-day workweek if fewer than 5 days had meetings
    empty_days = max(0, 5 - len(sorted_days))
    total_focus_blocks += empty_days * 2

    return min(10, total_focus_blocks), total_b2b_chains


class MicrosoftGraphIngestProvider(CalendarIngestProvider):
    """
    Production-ready Microsoft Graph API connector supporting:
    - Live OAuth2 Client Credentials + paginated /v1.0/users and /v1.0/users/{id}/calendarView
    - Built-in Graph Sandbox mode for zero-credential local testing and verification
    """

    provider_id = "microsoft_graph"
    display_name = "Microsoft 365 / Teams (Graph API Connector)"
    requires_enterprise_admin = True

    def __init__(self, config: TeamsConnectorConfig) -> None:
        self.config = config
        self.last_sync_report: TeamsSyncReport | None = None

    def load_organization_data(self) -> tuple[list[Employee], list[MeetingEvent]]:
        if self.config.dry_run_mode or not self.config.has_live_graph_credentials:
            raw_users, raw_cal_by_user = self._load_sandbox_graph_payloads()
            mode_label = "graph_sandbox_dry_run"
        else:
            raw_users, raw_cal_by_user = self._fetch_live_graph_payloads()
            mode_label = "live_microsoft_graph"

        return self._normalize_graph_directory_and_calendars(
            raw_users=raw_users,
            raw_cal_by_user=raw_cal_by_user,
            mode_label=mode_label,
        )

    def _acquire_oauth_token(self, client: httpx.Client) -> str:
        token_url = f"https://login.microsoftonline.com/{self.config.tenant_id}/oauth2/v2.0/token"
        resp = client.post(
            token_url,
            data={
                "client_id": self.config.client_id,
                "client_secret": self.config.client_secret,
                "scope": "https://graph.microsoft.com/.default",
                "grant_type": "client_credentials",
            },
            timeout=15.0,
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"Microsoft Entra ID OAuth2 token acquisition failed with HTTP {resp.status_code}."
            )
        token = resp.json().get("access_token")
        if not token:
            raise RuntimeError("Microsoft Entra ID response did not contain an access_token.")
        return str(token)

    def _fetch_live_graph_payloads(
        self,
    ) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
        now = datetime.now(timezone.utc)
        start_iso = (now - timedelta(days=self.config.lookback_days)).isoformat()
        end_iso = now.isoformat()

        with httpx.Client(timeout=20.0) as client:
            token = self._acquire_oauth_token(client)
            headers = {
                "Authorization": f"Bearer {token}",
                "Prefer": 'outlook.timezone="UTC"',
            }

            users: list[dict[str, Any]] = []
            next_url: str | None = (
                "https://graph.microsoft.com/v1.0/users"
                "?$select=id,displayName,jobTitle,department,mail,userPrincipalName"
                "&$expand=manager($select=id,displayName)&$top=100"
            )
            while next_url:
                u_resp = client.get(next_url, headers=headers)
                if u_resp.status_code != 200:
                    raise RuntimeError(
                        f"Graph /v1.0/users request failed with HTTP {u_resp.status_code}."
                    )
                payload = u_resp.json()
                users.extend(payload.get("value", []))
                next_url = payload.get("@odata.nextLink")

            cal_by_user: dict[str, list[dict[str, Any]]] = {}
            for u in users:
                uid = u.get("mail") or u.get("userPrincipalName") or u.get("id")
                if not uid:
                    continue
                c_url: str | None = (
                    f"https://graph.microsoft.com/v1.0/users/{uid}/calendarView"
                    f"?startDateTime={start_iso}&endDateTime={end_iso}"
                    "&$select=id,iCalUId,seriesMasterId,subject,type,start,end,organizer,attendees,bodyPreview,body"
                    "&$top=100"
                )
                user_events: list[dict[str, Any]] = []
                while c_url:
                    c_resp = client.get(c_url, headers=headers)
                    if c_resp.status_code != 200:
                        break
                    c_data = c_resp.json()
                    user_events.extend(c_data.get("value", []))
                    c_url = c_data.get("@odata.nextLink")
                cal_by_user[str(uid).lower()] = user_events

            return users, cal_by_user

    def _normalize_graph_directory_and_calendars(
        self,
        raw_users: list[dict[str, Any]],
        raw_cal_by_user: dict[str, list[dict[str, Any]]],
        mode_label: str,
    ) -> tuple[list[Employee], list[MeetingEvent]]:
        employees: list[Employee] = []
        email_to_emp_id: dict[str, str] = {}
        raw_events_scanned = 0
        descriptions_stripped = 0
        dedup_meetings: dict[str, MeetingEvent] = {}

        for idx, u in enumerate(raw_users, start=1):
            emp_id = str(u.get("id") or f"ms-user-{idx}")
            email = str(u.get("mail") or u.get("userPrincipalName") or emp_id).lower()
            email_to_emp_id[email] = emp_id
            email_to_emp_id[emp_id.lower()] = emp_id

            user_raw_events = raw_cal_by_user.get(email, []) or raw_cal_by_user.get(emp_id, [])
            intervals: list[tuple[datetime, datetime]] = []
            for ev in user_raw_events:
                s_str = ev.get("start", {}).get("dateTime")
                e_str = ev.get("end", {}).get("dateTime")
                if s_str and e_str:
                    try:
                        s_dt = datetime.fromisoformat(s_str.replace("Z", "+00:00"))
                        e_dt = datetime.fromisoformat(e_str.replace("Z", "+00:00"))
                        intervals.append((s_dt, e_dt))
                    except ValueError:
                        pass

            focus_blocks, b2b_chains = compute_focus_and_b2b_from_timestamps(intervals)
            mgr_obj = u.get("manager") or {}
            mgr_id = mgr_obj.get("id")
            squad_name = u.get("officeLocation") or u.get("squad") or f"{u.get('department', 'Core')} Squad"

            employees.append(
                Employee(
                    id=emp_id,
                    name=str(u.get("displayName") or f"User {idx}"),
                    role=str(u.get("jobTitle") or "Team Member"),
                    department=str(u.get("department") or "Engineering"),
                    squad=str(squad_name),
                    manager_id=str(mgr_id) if mgr_id else None,
                    weekly_focus_blocks=focus_blocks,
                    back_to_back_chains=b2b_chains,
                )
            )

        # Deduplicate and normalize calendar events across all users
        for user_key, user_events in raw_cal_by_user.items():
            for ev in user_events:
                raw_events_scanned += 1
                series_key = str(
                    ev.get("seriesMasterId") or ev.get("iCalUId") or ev.get("id") or uuid.uuid4()
                )
                body_text = (
                    (ev.get("body") or {}).get("content")
                    or ev.get("bodyPreview")
                    or ""
                )
                if body_text:
                    descriptions_stripped += 1

                if series_key in dedup_meetings:
                    continue

                has_agenda, has_doc_link = extract_agenda_hygiene_from_text(body_text)

                s_str = ev.get("start", {}).get("dateTime", "")
                e_str = ev.get("end", {}).get("dateTime", "")
                duration_mins = 45
                if s_str and e_str:
                    try:
                        s_dt = datetime.fromisoformat(s_str.replace("Z", "+00:00"))
                        e_dt = datetime.fromisoformat(e_str.replace("Z", "+00:00"))
                        duration_mins = max(15, int((e_dt - s_dt).total_seconds() // 60))
                    except ValueError:
                        duration_mins = 45

                org_addr = (
                    ev.get("organizer", {}).get("emailAddress", {}).get("address", "")
                ).lower()
                organizer_id = email_to_emp_id.get(org_addr, org_addr or "ms-eng-1")

                req_ids: list[str] = []
                opt_ids: list[str] = []
                for att in ev.get("attendees", []):
                    addr = (att.get("emailAddress", {}).get("address") or "").lower()
                    mapped_id = email_to_emp_id.get(addr, addr)
                    if not mapped_id:
                        continue
                    att_type = (att.get("type") or "required").lower()
                    if att_type == "optional":
                        opt_ids.append(mapped_id)
                    else:
                        req_ids.append(mapped_id)

                is_rec = ev.get("type") in ("occurrence", "seriesMaster") or bool(
                    ev.get("seriesMasterId")
                )
                dedup_meetings[series_key] = MeetingEvent(
                    id=series_key,
                    title_category=str(ev.get("subject") or "Teams Sync"),
                    organizer_id=organizer_id,
                    required_attendees=req_ids,
                    optional_attendees=opt_ids,
                    duration_mins=duration_mins,
                    frequency_per_month=int(ev.get("frequency_per_month", 4 if is_rec else 1)),
                    is_recurring=is_rec,
                    series_age_days=int(ev.get("series_age_days", 110 if is_rec else 15)),
                    has_agenda=has_agenda,
                    has_doc_link=has_doc_link,
                    source_provider=SourceProviderType.MICROSOFT_GRAPH,
                )

        self.last_sync_report = TeamsSyncReport(
            synced_at=datetime.now(timezone.utc).isoformat(),
            mode=mode_label,
            users_fetched=len(employees),
            raw_calendar_events_scanned=raw_events_scanned,
            deduplicated_series_count=len(dedup_meetings),
            descriptions_stripped_count=descriptions_stripped,
            focus_blocks_computed=True,
        )
        return employees, list(dedup_meetings.values())

    @staticmethod
    def _load_sandbox_graph_payloads() -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
        """
        Realistic Microsoft Graph v1.0 /users and /calendarView dataset representing
        an organization on Microsoft Teams with:
        - Partial-squad peer exclusions in 'Cloud Core Squad' and 'Checkout Squad'
        - Back-to-back meeting chains on Monday/Tuesday timestamps
        - Bloated Teams recurring meetings without agendas
        - A 3-person 'Security & Compliance' department to verify k-anonymity (k >= 5)
        """
        raw_users = [
            # Engineering - Cloud Core Squad (6 members: 4 invited to Teams Architecture Sync, 2 omitted)
            {"id": "ms-eng-1", "displayName": "Amina Patel", "jobTitle": "Principal Engineer", "department": "Engineering", "officeLocation": "Cloud Core Squad", "mail": "amina@contoso.com", "manager": {"id": "vp-eng"}},
            {"id": "ms-eng-2", "displayName": "Henrik Lind", "jobTitle": "Senior Backend Engineer", "department": "Engineering", "officeLocation": "Cloud Core Squad", "mail": "henrik@contoso.com", "manager": {"id": "vp-eng"}},
            {"id": "ms-eng-3", "displayName": "Diego Morales", "jobTitle": "Distributed Systems Eng", "department": "Engineering", "officeLocation": "Cloud Core Squad", "mail": "diego@contoso.com", "manager": {"id": "vp-eng"}},
            {"id": "ms-eng-4", "displayName": "Claire Dubois", "jobTitle": "Platform Engineer", "department": "Engineering", "officeLocation": "Cloud Core Squad", "mail": "claire@contoso.com", "manager": {"id": "vp-eng"}},
            {"id": "ms-eng-5", "displayName": "Kenji Takahashi", "jobTitle": "Platform Engineer", "department": "Engineering", "officeLocation": "Cloud Core Squad", "mail": "kenji@contoso.com", "manager": {"id": "vp-eng"}},
            {"id": "ms-eng-6", "displayName": "Fatima Al-Zahra", "jobTitle": "Site Reliability Engineer", "department": "Engineering", "officeLocation": "Cloud Core Squad", "mail": "fatima@contoso.com", "manager": {"id": "vp-eng"}},

            # Product & Design - Checkout Squad (5 members: 4 in Teams Roadmap Huddle, 1 omitted)
            {"id": "ms-prd-1", "displayName": "Rachel Green", "jobTitle": "Lead Product Manager", "department": "Product & Design", "officeLocation": "Checkout Squad", "mail": "rachel@contoso.com", "manager": {"id": "vp-prd"}},
            {"id": "ms-prd-2", "displayName": "Jonas Weber", "jobTitle": "Staff Product Designer", "department": "Product & Design", "officeLocation": "Checkout Squad", "mail": "jonas@contoso.com", "manager": {"id": "vp-prd"}},
            {"id": "ms-prd-3", "displayName": "Maya Lin", "jobTitle": "UX Researcher", "department": "Product & Design", "officeLocation": "Checkout Squad", "mail": "maya@contoso.com", "manager": {"id": "vp-prd"}},
            {"id": "ms-prd-4", "displayName": "Carlos Mendez", "jobTitle": "Product Analyst", "department": "Product & Design", "officeLocation": "Checkout Squad", "mail": "carlos@contoso.com", "manager": {"id": "vp-prd"}},
            {"id": "ms-prd-5", "displayName": "Sonia Verma", "jobTitle": "Design Systems Eng", "department": "Product & Design", "officeLocation": "Checkout Squad", "mail": "sonia@contoso.com", "manager": {"id": "vp-prd"}},

            # Customer Operations - Global Support Squad (5 members: healthy inclusive async culture)
            {"id": "ms-ops-1", "displayName": "David Kim", "jobTitle": "Operations Lead", "department": "Customer Operations", "officeLocation": "Global Support Squad", "mail": "david@contoso.com", "manager": {"id": "vp-ops"}},
            {"id": "ms-ops-2", "displayName": "Elena Popova", "jobTitle": "Enterprise CSM", "department": "Customer Operations", "officeLocation": "Global Support Squad", "mail": "elena@contoso.com", "manager": {"id": "vp-ops"}},
            {"id": "ms-ops-3", "displayName": "Omar Farooq", "jobTitle": "Solutions Specialist", "department": "Customer Operations", "officeLocation": "Global Support Squad", "mail": "omar@contoso.com", "manager": {"id": "vp-ops"}},
            {"id": "ms-ops-4", "displayName": "ia Rossi", "jobTitle": "Implementation Lead", "department": "Customer Operations", "officeLocation": "Global Support Squad", "mail": "sofia@contoso.com", "manager": {"id": "vp-ops"}},
            {"id": "ms-ops-5", "displayName": "Ben Carter", "jobTitle": "Support Engineer", "department": "Customer Operations", "officeLocation": "Global Support Squad", "mail": "ben@contoso.com", "manager": {"id": "vp-ops"}},

            # Security & Compliance (3 members -> <5 headcount, automatically k-anonymity redacted)
            {"id": "ms-sec-1", "displayName": "Grace Hopper", "jobTitle": "CISO", "department": "Security & Compliance", "officeLocation": "SecOps", "mail": "grace@contoso.com", "manager": {"id": "ceo"}},
            {"id": "ms-sec-2", "displayName": "Victor Trent", "jobTitle": "AppSec Engineer", "department": "Security & Compliance", "officeLocation": "SecOps", "mail": "victor@contoso.com", "manager": {"id": "ms-sec-1"}},
            {"id": "ms-sec-3", "displayName": "Nora Lindholm", "jobTitle": "Compliance Counsel", "department": "Security & Compliance", "officeLocation": "SecOps", "mail": "nora@contoso.com", "manager": {"id": "ms-sec-1"}},
        ]

        # Raw MS Graph CalendarView events
        ev_cloud_arch = {
            "id": "graph-evt-1",
            "seriesMasterId": "ms-series-cloud-arch",
            "subject": "Teams Channel Sync: Cloud Core Architecture Decisions",
            "type": "occurrence",
            "start": {"dateTime": "2026-10-26T09:00:00Z"},
            "end": {"dateTime": "2026-10-26T10:00:00Z"},
            "frequency_per_month": 8,
            "series_age_days": 140,
            "organizer": {"emailAddress": {"address": "amina@contoso.com"}},
            "attendees": [
                {"type": "required", "emailAddress": {"address": "amina@contoso.com"}},
                {"type": "required", "emailAddress": {"address": "henrik@contoso.com"}},
                {"type": "required", "emailAddress": {"address": "diego@contoso.com"}},
                {"type": "required", "emailAddress": {"address": "claire@contoso.com"}},
            ],
            "body": {"content": "<html><body>Join Microsoft Teams Meeting. Quick sync.</body></html>"},
        }

        ev_checkout_roadmap = {
            "id": "graph-evt-2",
            "seriesMasterId": "ms-series-checkout-roadmap",
            "subject": "Teams Huddle: Checkout Squad Weekly Prioritization",
            "type": "occurrence",
            "start": {"dateTime": "2026-10-26T10:00:00Z"},
            "end": {"dateTime": "2026-10-26T10:45:00Z"},
            "frequency_per_month": 4,
            "series_age_days": 95,
            "organizer": {"emailAddress": {"address": "rachel@contoso.com"}},
            "attendees": [
                {"type": "required", "emailAddress": {"address": "rachel@contoso.com"}},
                {"type": "required", "emailAddress": {"address": "jonas@contoso.com"}},
                {"type": "required", "emailAddress": {"address": "maya@contoso.com"}},
                {"type": "required", "emailAddress": {"address": "carlos@contoso.com"}},
            ],
            "body": {
                "content": "<html><body>Agenda: 1. Funnel metrics 2. Q4 scope. Notes in https://contoso.sharepoint.com/checkout</body></html>"
            },
        }

        ev_all_hands_bloat = {
            "id": "graph-evt-3",
            "seriesMasterId": "ms-series-weekly-status",
            "subject": "Teams Weekly Cross-Squad Status Rollup",
            "type": "occurrence",
            "start": {"dateTime": "2026-10-26T10:45:00Z"},
            "end": {"dateTime": "2026-10-26T11:45:00Z"},
            "frequency_per_month": 4,
            "series_age_days": 210,
            "organizer": {"emailAddress": {"address": "rachel@contoso.com"}},
            "attendees": [
                {"type": "required", "emailAddress": {"address": u["mail"]}}
                for u in raw_users[:14]
            ],
            "body": {"content": "<html><body>Weekly status sync on Teams.</body></html>"},
        }

        ev_support_healthy = {
            "id": "graph-evt-4",
            "seriesMasterId": "ms-series-support-playbook",
            "subject": "Global Support Squad Async-First Triage",
            "type": "occurrence",
            "start": {"dateTime": "2026-10-27T14:00:00Z"},
            "end": {"dateTime": "2026-10-27T14:25:00Z"},
            "frequency_per_month": 4,
            "series_age_days": 45,
            "organizer": {"emailAddress": {"address": "david@contoso.com"}},
            "attendees": [
                {"type": "required", "emailAddress": {"address": "david@contoso.com"}},
                {"type": "required", "emailAddress": {"address": "elena@contoso.com"}},
                {"type": "required", "emailAddress": {"address": "omar@contoso.com"}},
                {"type": "required", "emailAddress": {"address": "sofia@contoso.com"}},
                {"type": "required", "emailAddress": {"address": "ben@contoso.com"}},
            ],
            "body": {
                "content": "Agenda: 1. Escalations 2. Shared doc at https://contoso.sharepoint.com/support-playbook"
            },
        }

        raw_cal_by_user: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for ev in (ev_cloud_arch, ev_checkout_roadmap, ev_all_hands_bloat, ev_support_healthy):
            for att in ev["attendees"]:
                addr = att["emailAddress"]["address"].lower()
                raw_cal_by_user[addr].append(ev)

        return raw_users, dict(raw_cal_by_user)


class MicrosoftTeamsDeliveryClient:
    """
    Handles outbound Microsoft Teams Adaptive Card v1.5 delivery (via Incoming Webhook / Workflows)
    and records an inspectable delivery ledger for both live and dry-run modes.
    """

    def __init__(self, config: TeamsConnectorConfig) -> None:
        self.config = config
        self.activity_ledger: list[TeamsDeliveryRecord] = []
        self.acknowledged_nudges: list[str] = []

    def build_teams_webhook_envelope(self, nudge: ChannelNudgeBundle) -> dict[str, Any]:
        """
        Wraps an Adaptive Card v1.5 payload in the official Microsoft Teams
        Incoming Webhook / Workflows attachment structure with interactive Action.Submit buttons.
        """
        card_copy = dict(nudge.teams_adaptive_card)
        card_copy["actions"] = [
            {
                "type": "Action.Submit",
                "title": f"✅ {nudge.action_label}",
                "data": {
                    "action_type": "acknowledge_nudge",
                    "nudge_id": nudge.nudge_id,
                    "organizer_resolution": nudge.action_label,
                },
            },
            {
                "type": "Action.Submit",
                "title": "📊 Send 1-Click Anonymous Pulse (4★)",
                "data": {
                    "action_type": "submit_pulse",
                    "meeting_id": nudge.web_portal_payload.get("metadata", {}).get(
                        "meeting_id", "ms-series-weekly-status"
                    ),
                    "usefulness_score": 4,
                    "tags": ["great_decisions"],
                },
            },
        ]
        return {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "contentUrl": None,
                    "content": card_copy,
                }
            ],
        }

    def dispatch_adaptive_card(self, nudge: ChannelNudgeBundle) -> TeamsDeliveryRecord:
        envelope = self.build_teams_webhook_envelope(nudge)
        now_iso = datetime.now(timezone.utc).isoformat()
        delivery_id = f"teams-msg-{len(self.activity_ledger) + 1:03d}"

        if not self.config.dry_run_mode and self.config.teams_webhook_url:
            validated_url = validate_teams_webhook_url(self.config.teams_webhook_url)
            if not validated_url:
                raise ValueError("Invalid Microsoft Teams webhook URL.")
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(validated_url, json=envelope)
                status_str = f"delivered_http_{resp.status_code}"
            mode_str = "live_webhook"
        else:
            status_str = "delivered_sandbox_dry_run"
            mode_str = "dry_run_sandbox"

        record = TeamsDeliveryRecord(
            delivery_id=delivery_id,
            timestamp=now_iso,
            direction="outbound_nudge",
            mode=mode_str,
            card_type=nudge.nudge_type,
            target_summary=nudge.target_audience,
            status=status_str,
            envelope_preview=envelope,
        )
        self.activity_ledger.insert(0, record)
        return record

    def record_inbound_callback(
        self,
        action_type: str,
        target_summary: str,
        payload_dict: dict[str, Any],
    ) -> TeamsDeliveryRecord:
        record = TeamsDeliveryRecord(
            delivery_id=f"teams-cb-{len(self.activity_ledger) + 1:03d}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            direction="inbound_callback",
            mode="inbound_adaptive_card",
            card_type=action_type,
            target_summary=target_summary,
            status="processed_ok",
            envelope_preview=payload_dict,
        )
        self.activity_ledger.insert(0, record)
        return record
