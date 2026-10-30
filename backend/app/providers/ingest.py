from __future__ import annotations

import csv
import io
import re
from typing import Any
from app.models.domain import Employee, MeetingEvent, SourceProviderType
from app.providers.base import CalendarIngestProvider, extract_agenda_hygiene_from_text


class SimulatorIngestProvider(CalendarIngestProvider):
    provider_id = "simulator"
    display_name = "Built-in Organization Simulator (Zero-Setup Demo)"
    requires_enterprise_admin = False

    def __init__(self, scenario: str = "default_mixed") -> None:
        self.scenario = scenario

    def load_organization_data(self) -> tuple[list[Employee], list[MeetingEvent]]:
        employees = self._build_employees()
        meetings = self._build_meetings()
        return employees, meetings

    def _build_employees(self) -> list[Employee]:
        is_overload = self.scenario == "overload_crisis"
        eng_focus = 1 if is_overload else 2
        eng_b2b = 5 if is_overload else 3

        return [
            # Engineering - Core Platform Squad (6 members — 2 will be excluded in recurring syncs)
            Employee(id="eng-1", name="Elena Rostova", role="Staff Engineer", department="Engineering", squad="Core Platform", manager_id="mgr-eng", weekly_focus_blocks=eng_focus, back_to_back_chains=eng_b2b),
            Employee(id="eng-2", name="Marcus Vance", role="Senior Engineer", department="Engineering", squad="Core Platform", manager_id="mgr-eng", weekly_focus_blocks=eng_focus, back_to_back_chains=eng_b2b),
            Employee(id="eng-3", name="Tariq Al-Mansoor", role="Backend Engineer", department="Engineering", squad="Core Platform", manager_id="mgr-eng", weekly_focus_blocks=eng_focus + 1, back_to_back_chains=eng_b2b),
            Employee(id="eng-4", name="Hannah Abbott", role="Backend Engineer", department="Engineering", squad="Core Platform", manager_id="mgr-eng", weekly_focus_blocks=eng_focus, back_to_back_chains=eng_b2b),
            Employee(id="eng-5", name="Mateo Silva", role="Backend Engineer", department="Engineering", squad="Core Platform", manager_id="mgr-eng", weekly_focus_blocks=4, back_to_back_chains=1),
            Employee(id="eng-6", name="Chloe Zhao", role="Systems Engineer", department="Engineering", squad="Core Platform", manager_id="mgr-eng", weekly_focus_blocks=4, back_to_back_chains=1),

            # Engineering - Growth & Mobile Squad (5 members)
            Employee(id="eng-7", name="Devon Brooks", role="Tech Lead", department="Engineering", squad="Growth Squad", manager_id="mgr-eng", weekly_focus_blocks=eng_focus, back_to_back_chains=4),
            Employee(id="eng-8", name="Sora Takahashi", role="Frontend Engineer", department="Engineering", squad="Growth Squad", manager_id="mgr-eng", weekly_focus_blocks=3, back_to_back_chains=2),
            Employee(id="eng-9", name="Liam O'Connor", role="Mobile Engineer", department="Engineering", squad="Growth Squad", manager_id="mgr-eng", weekly_focus_blocks=3, back_to_back_chains=2),
            Employee(id="eng-10", name="Priya Patel", role="Fullstack Engineer", department="Engineering", squad="Growth Squad", manager_id="mgr-eng", weekly_focus_blocks=3, back_to_back_chains=2),
            Employee(id="eng-11", name="Noah Kim", role="QA Automation", department="Engineering", squad="Growth Squad", manager_id="mgr-eng", weekly_focus_blocks=4, back_to_back_chains=1),

            # Product & Design - Experience Squad (6 members — 1 excluded in exclusion_heavy)
            Employee(id="prd-1", name="Clara Mendoza", role="Group PM", department="Product & Design", squad="Experience Squad", manager_id="mgr-prd", weekly_focus_blocks=1, back_to_back_chains=6),
            Employee(id="prd-2", name="Julian Vance", role="Product Manager", department="Product & Design", squad="Experience Squad", manager_id="mgr-prd", weekly_focus_blocks=1, back_to_back_chains=5),
            Employee(id="prd-3", name="Amara Okafor", role="Lead Product Designer", department="Product & Design", squad="Experience Squad", manager_id="mgr-prd", weekly_focus_blocks=2, back_to_back_chains=4),
            Employee(id="prd-4", name="Lucas Weber", role="UX Researcher", department="Product & Design", squad="Experience Squad", manager_id="mgr-prd", weekly_focus_blocks=3, back_to_back_chains=2),
            Employee(id="prd-5", name="Freya Lindqvist", role="Product Designer", department="Product & Design", squad="Experience Squad", manager_id="mgr-prd", weekly_focus_blocks=3, back_to_back_chains=2),
            Employee(id="prd-6", name="Gabriel Costa", role="Design Systems", department="Product & Design", squad="Experience Squad", manager_id="mgr-prd", weekly_focus_blocks=4, back_to_back_chains=1),

            # Customer Success & Ops (5 members — healthy async culture benchmark)
            Employee(id="ops-1", name="Nadia Darwish", role="CS Lead", department="Customer Success", squad="Enterprise CS", manager_id="mgr-ops", weekly_focus_blocks=5, back_to_back_chains=1),
            Employee(id="ops-2", name="Samir Bose", role="Solutions Architect", department="Customer Success", squad="Enterprise CS", manager_id="mgr-ops", weekly_focus_blocks=5, back_to_back_chains=1),
            Employee(id="ops-3", name="Klara Novak", role="Onboarding Specialist", department="Customer Success", squad="Enterprise CS", manager_id="mgr-ops", weekly_focus_blocks=4, back_to_back_chains=1),
            Employee(id="ops-4", name="Victor Hugo", role="Account Manager", department="Customer Success", squad="Enterprise CS", manager_id="mgr-ops", weekly_focus_blocks=4, back_to_back_chains=2),
            Employee(id="ops-5", name="Zoe Chen", role="Support Ops", department="Customer Success", squad="Enterprise CS", manager_id="mgr-ops", weekly_focus_blocks=5, back_to_back_chains=1),

            # Legal & Security (3 members — deliberately <5 to demonstrate strict k-anonymity protection!)
            Employee(id="leg-1", name="Arthur Pendelton", role="General Counsel", department="Legal & Security", squad="Governance", manager_id="ceo", weekly_focus_blocks=6, back_to_back_chains=0),
            Employee(id="leg-2", name="Mei Lin", role="Security Engineer", department="Legal & Security", squad="Governance", manager_id="leg-1", weekly_focus_blocks=6, back_to_back_chains=0),
            Employee(id="leg-3", name="Oscar Diaz", role="Privacy Analyst", department="Legal & Security", squad="Governance", manager_id="leg-1", weekly_focus_blocks=6, back_to_back_chains=0),
        ]

    def _build_meetings(self) -> list[MeetingEvent]:
        meetings = [
            # 1. Structural Exclusion Case #1: Core Platform Architecture Sync
            # Includes 4 of 6 members of 'Core Platform' (eng-1..eng-4), systematically omitting Mateo (eng-5) & Chloe (eng-6)
            MeetingEvent(
                id="mtg-core-arch",
                title_category="Core Platform Architecture Decisions",
                organizer_id="eng-1",
                required_attendees=["eng-1", "eng-2", "eng-3", "eng-4", "prd-1"],
                optional_attendees=[],
                duration_mins=60,
                frequency_per_month=8,
                is_recurring=True,
                series_age_days=120,
                has_agenda=False,
                has_doc_link=False,
            ),
            # 2. Structural Exclusion Case #2: Roadmap Inner-Circle Sync
            # Includes 5 of 6 members of 'Experience Squad', omitting Gabriel Costa (prd-6)
            MeetingEvent(
                id="mtg-exp-roadmap",
                title_category="Product Experience Weekly Alignment",
                organizer_id="prd-1",
                required_attendees=["prd-1", "prd-2", "prd-3", "prd-4", "prd-5"],
                optional_attendees=[],
                duration_mins=45,
                frequency_per_month=4,
                is_recurring=True,
                series_age_days=95,
                has_agenda=True,
                has_doc_link=False,
            ),
            # 3. Bloated & Zombie Meeting Case: Cross-Org Status Sync (16 attendees, no agenda, 240 days old)
            MeetingEvent(
                id="mtg-bloated-status",
                title_category="Cross-Department Weekly Status Rollup",
                organizer_id="prd-1",
                required_attendees=[
                    "prd-1", "prd-2", "prd-3", "prd-4", "prd-5", "prd-6",
                    "eng-1", "eng-2", "eng-3", "eng-4", "eng-5", "eng-6",
                    "eng-7", "eng-8", "ops-1", "ops-2",
                ],
                optional_attendees=[],
                duration_mins=60,
                frequency_per_month=4,
                is_recurring=True,
                series_age_days=240,
                has_agenda=False,
                has_doc_link=False,
            ),
            # 4. Healthy Inclusive Squad Sync (Growth Squad - all 5 peers included, short 30m, has agenda & shared doc)
            MeetingEvent(
                id="mtg-growth-sprint",
                title_category="Growth Squad Async-First Standup",
                organizer_id="eng-7",
                required_attendees=["eng-7", "eng-8", "eng-9", "eng-10", "eng-11"],
                optional_attendees=["prd-2"],
                duration_mins=25,
                frequency_per_month=8,
                is_recurring=True,
                series_age_days=60,
                has_agenda=True,
                has_doc_link=True,
            ),
            # 5. Healthy Customer Success Sync (All 5 peers, clear agenda & doc link)
            MeetingEvent(
                id="mtg-cs-playbooks",
                title_category="Customer Triage & Shared Playbook Review",
                organizer_id="ops-1",
                required_attendees=["ops-1", "ops-2", "ops-3", "ops-4", "ops-5"],
                optional_attendees=[],
                duration_mins=30,
                frequency_per_month=4,
                is_recurring=True,
                series_age_days=45,
                has_agenda=True,
                has_doc_link=True,
            ),
        ]

        if self.scenario == "exclusion_heavy":
            # Add another clique sync in Growth Squad that leaves out Noah Kim (eng-11)
            meetings.append(
                MeetingEvent(
                    id="mtg-growth-secret",
                    title_category="Growth Feature Spec Huddle",
                    organizer_id="eng-7",
                    required_attendees=["eng-7", "eng-8", "eng-9", "eng-10"],
                    optional_attendees=[],
                    duration_mins=45,
                    frequency_per_month=6,
                    is_recurring=True,
                    series_age_days=75,
                    has_agenda=False,
                    has_doc_link=False,
                )
            )
        elif self.scenario == "overload_crisis":
            # Add high-frequency zombie syncs without agendas
            meetings.append(
                MeetingEvent(
                    id="mtg-daily-escalation",
                    title_category="Daily Multi-Team War Room Sync",
                    organizer_id="prd-2",
                    required_attendees=[
                        "prd-1", "prd-2", "prd-3", "eng-1", "eng-2", "eng-3",
                        "eng-7", "eng-8", "eng-9", "ops-1", "ops-2",
                    ],
                    optional_attendees=[],
                    duration_mins=60,
                    frequency_per_month=20,
                    is_recurring=True,
                    series_age_days=180,
                    has_agenda=False,
                    has_doc_link=False,
                )
            )

        return meetings


class UniversalCsvIcsProvider(CalendarIngestProvider):
    """
    Zero-lock-in provider: accepts CSV employee directory and CSV or ICS calendar files.
    Enables any organization (Nextcloud, Google, Outlook, Fastmail) to run an instant audit.
    """

    provider_id = "csv_ics"
    display_name = "Universal CSV / ICS Import (Zero Vendor Lock-in)"
    requires_enterprise_admin = False

    def __init__(self, employees_csv: str, meetings_csv_or_ics: str) -> None:
        self.employees_csv = employees_csv
        self.meetings_raw = meetings_csv_or_ics

    def load_organization_data(self) -> tuple[list[Employee], list[MeetingEvent]]:
        employees = self.parse_employees_csv(self.employees_csv)
        if "BEGIN:VCALENDAR" in self.meetings_raw:
            meetings = self.parse_ics_calendar(self.meetings_raw)
        else:
            meetings = self.parse_meetings_csv(self.meetings_raw)
        return employees, meetings

    @staticmethod
    def parse_employees_csv(csv_text: str) -> list[Employee]:
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        employees: list[Employee] = []
        for idx, row in enumerate(reader, start=1):
            employees.append(
                Employee(
                    id=row.get("id", f"emp-{idx}").strip(),
                    name=row.get("name", f"Employee {idx}").strip(),
                    role=row.get("role", "Member").strip(),
                    department=row.get("department", "General").strip(),
                    squad=row.get("squad", "Core").strip(),
                    manager_id=row.get("manager_id", "").strip() or None,
                    weekly_focus_blocks=int(row.get("weekly_focus_blocks", 3) or 3),
                    back_to_back_chains=int(row.get("back_to_back_chains", 2) or 2),
                )
            )
        return employees

    @staticmethod
    def parse_meetings_csv(csv_text: str) -> list[MeetingEvent]:
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        meetings: list[MeetingEvent] = []
        for idx, row in enumerate(reader, start=1):
            req = [x.strip() for x in row.get("required_attendees", "").split(";") if x.strip()]
            opt = [x.strip() for x in row.get("optional_attendees", "").split(";") if x.strip()]
            raw_desc = row.get("description", "")
            has_agenda_col = row.get("has_agenda", "").strip().lower()
            if has_agenda_col in ("true", "false"):
                has_agenda = has_agenda_col == "true"
                has_doc = row.get("has_doc_link", "false").strip().lower() == "true"
            else:
                has_agenda, has_doc = extract_agenda_hygiene_from_text(raw_desc)

            meetings.append(
                MeetingEvent(
                    id=row.get("id", f"csv-mtg-{idx}").strip(),
                    title_category=row.get("title_category", f"Imported Sync #{idx}").strip(),
                    organizer_id=row.get("organizer_id", req[0] if req else "emp-1").strip(),
                    required_attendees=req,
                    optional_attendees=opt,
                    duration_mins=int(row.get("duration_mins", 45) or 45),
                    frequency_per_month=int(row.get("frequency_per_month", 4) or 4),
                    is_recurring=row.get("is_recurring", "true").strip().lower() != "false",
                    series_age_days=int(row.get("series_age_days", 60) or 60),
                    has_agenda=has_agenda,
                    has_doc_link=has_doc,
                    source_provider=SourceProviderType.CSV_ICS,
                )
            )
        return meetings

    @staticmethod
    def parse_ics_calendar(ics_text: str) -> list[MeetingEvent]:
        blocks = re.findall(r"BEGIN:VEVENT(.*?)END:VEVENT", ics_text, flags=re.DOTALL)
        meetings: list[MeetingEvent] = []
        for idx, block in enumerate(blocks, start=1):
            uid_match = re.search(r"UID:(.+)", block)
            summary_match = re.search(r"SUMMARY:(.+)", block)
            org_match = re.search(r"ORGANIZER[^:]*:(?:mailto:)?(.+)", block, flags=re.IGNORECASE)
            attendees = re.findall(r"ATTENDEE[^:]*:(?:mailto:)?([^\r\n]+)", block, flags=re.IGNORECASE)
            desc_match = re.search(r"DESCRIPTION:(.+)", block)
            rrule_match = re.search(r"RRULE:(.+)", block)

            has_agenda, has_doc = extract_agenda_hygiene_from_text(
                desc_match.group(1) if desc_match else None
            )
            clean_attendees = [a.strip() for a in attendees if a.strip()]
            organizer = org_match.group(1).strip() if org_match else (clean_attendees[0] if clean_attendees else "emp-1")

            meetings.append(
                MeetingEvent(
                    id=uid_match.group(1).strip() if uid_match else f"ics-mtg-{idx}",
                    title_category=summary_match.group(1).strip() if summary_match else f"Calendar Event #{idx}",
                    organizer_id=organizer,
                    required_attendees=clean_attendees,
                    optional_attendees=[],
                    duration_mins=45,
                    frequency_per_month=4 if rrule_match else 1,
                    is_recurring=bool(rrule_match),
                    series_age_days=90 if rrule_match else 1,
                    has_agenda=has_agenda,
                    has_doc_link=has_doc,
                    source_provider=SourceProviderType.CSV_ICS,
                )
            )
        return meetings


def normalize_external_api_event(
    provider: SourceProviderType,
    raw_event: dict[str, Any],
) -> MeetingEvent:
    """
    Universal adapter function normalizing either Google Workspace Calendar JSON
    or Microsoft Graph CalendarView JSON into a privacy-safe MeetingEvent.
    """
    if provider == SourceProviderType.GOOGLE_WORKSPACE:
        desc = raw_event.get("description", "")
        has_agenda, has_doc = extract_agenda_hygiene_from_text(desc)
        attendees = raw_event.get("attendees", [])
        req = [a["email"] for a in attendees if not a.get("optional", False)]
        opt = [a["email"] for a in attendees if a.get("optional", False)]
        organizer = raw_event.get("organizer", {}).get("email", req[0] if req else "unknown")
        return MeetingEvent(
            id=raw_event.get("id", "gcal-1"),
            title_category=raw_event.get("summary", "Team Sync"),
            organizer_id=organizer,
            required_attendees=req,
            optional_attendees=opt,
            duration_mins=int(raw_event.get("duration_mins", 45)),
            frequency_per_month=4 if raw_event.get("recurringEventId") else 1,
            is_recurring=bool(raw_event.get("recurringEventId")),
            series_age_days=int(raw_event.get("series_age_days", 60)),
            has_agenda=has_agenda,
            has_doc_link=has_doc,
            source_provider=SourceProviderType.GOOGLE_WORKSPACE,
        )

    # Microsoft Graph format
    body_content = raw_event.get("body", {}).get("content", "") or raw_event.get("bodyPreview", "")
    has_agenda, has_doc = extract_agenda_hygiene_from_text(body_content)
    attendees = raw_event.get("attendees", [])
    req = [
        a.get("emailAddress", {}).get("address", "")
        for a in attendees
        if a.get("type", "required").lower() == "required"
    ]
    opt = [
        a.get("emailAddress", {}).get("address", "")
        for a in attendees
        if a.get("type", "").lower() == "optional"
    ]
    organizer = (
        raw_event.get("organizer", {}).get("emailAddress", {}).get("address")
        or (req[0] if req else "unknown")
    )
    return MeetingEvent(
        id=raw_event.get("id", "msgraph-1"),
        title_category=raw_event.get("subject", "Team Sync"),
        organizer_id=organizer,
        required_attendees=[r for r in req if r],
        optional_attendees=[o for o in opt if o],
        duration_mins=int(raw_event.get("duration_mins", 45)),
        frequency_per_month=4 if raw_event.get("type") == "occurrence" else 1,
        is_recurring=raw_event.get("type") in ("occurrence", "seriesMaster"),
        series_age_days=int(raw_event.get("series_age_days", 60)),
        has_agenda=has_agenda,
        has_doc_link=has_doc,
        source_provider=SourceProviderType.MICROSOFT_GRAPH,
    )
