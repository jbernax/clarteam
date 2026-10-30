from __future__ import annotations

from collections import defaultdict
import networkx as nx

from app.models.domain import (
    DepartmentWellbeingSummary,
    Employee,
    LoopMeInSignal,
    MeetingDiagnostic,
    MeetingEvent,
    MicroPulseSubmission,
    OnaGraphEdge,
    OnaGraphNode,
    OnaInsightsResponse,
    OrganizationHealthOverview,
    PeerExclusionAlert,
)


def detect_peer_exclusions(
    employees: list[Employee],
    meetings: list[MeetingEvent],
) -> list[PeerExclusionAlert]:
    """
    Detects 'Torn Apart' squad patterns where >=60% of a peer squad (>=3 members)
    are included in a recurring meeting while 1-2 squad peers are systematically omitted.
    """
    emp_by_id = {e.id: e for e in employees}
    squad_members: dict[str, list[Employee]] = defaultdict(list)
    for emp in employees:
        squad_members[emp.squad].append(emp)

    alerts: list[PeerExclusionAlert] = []

    for mtg in meetings:
        if not mtg.is_recurring and mtg.frequency_per_month < 2:
            continue

        attendee_set = set(mtg.all_attendees)
        organizer = emp_by_id.get(mtg.organizer_id)
        organizer_name = organizer.name if organizer else mtg.organizer_id

        for squad_name, peers in squad_members.items():
            squad_size = len(peers)
            if squad_size < 4:
                continue

            included_peers = [p for p in peers if p.id in attendee_set]
            excluded_peers = [p for p in peers if p.id not in attendee_set]
            included_count = len(included_peers)
            excluded_count = len(excluded_peers)

            inclusion_ratio = included_count / squad_size
            # Flag when majority (>=60% and >=3) of squad is in the sync, but 1 or 2 members are left out
            if included_count >= 3 and 0 < excluded_count <= 2 and inclusion_ratio >= 0.60:
                severity = "high" if (mtg.frequency_per_month >= 6 or not mtg.has_doc_link) else "medium"
                tip = (
                    f"{included_count} of {squad_size} members of '{squad_name}' are in "
                    f"'{mtg.title_category}', leaving {excluded_count} squad peer(s) outside the loop. "
                    f"Even when unintentional, partial-squad syncs without shared notes often make "
                    f"omitted teammates feel sidelined."
                )
                action = (
                    "Publish a 3-bullet async decision note or add omitted squad peers as Optional"
                )
                alerts.append(
                    PeerExclusionAlert(
                        alert_id=f"excl-{mtg.id}-{squad_name.lower().replace(' ', '-')}",
                        squad=squad_name,
                        department=peers[0].department,
                        meeting_id=mtg.id,
                        meeting_category=mtg.title_category,
                        organizer_id=mtg.organizer_id,
                        organizer_name=organizer_name,
                        squad_size=squad_size,
                        included_peer_count=included_count,
                        excluded_peer_count=excluded_count,
                        inclusion_ratio=round(inclusion_ratio, 2),
                        severity=severity,
                        private_organizer_tip=tip,
                        recommended_action=action,
                    )
                )

    return alerts


def calculate_employee_weekly_meeting_hours(
    employees: list[Employee],
    meetings: list[MeetingEvent],
) -> dict[str, float]:
    """Calculates estimated weekly meeting hours per employee from monthly meeting metadata."""
    monthly_mins: dict[str, int] = {e.id: 0 for e in employees}
    for mtg in meetings:
        total_mtg_mins = mtg.duration_mins * mtg.frequency_per_month
        for emp_id in mtg.all_attendees:
            if emp_id in monthly_mins:
                monthly_mins[emp_id] += total_mtg_mins

    # Base collaboration load + tracked recurring series (4.33 weeks/month)
    weekly_hours: dict[str, float] = {}
    for emp in employees:
        tracked_weekly_hrs = (monthly_mins.get(emp.id, 0) / 60.0) / 4.0
        # Incorporate structural back-to-back & focus fragmentation baseline
        baseline_hrs = max(2.0, emp.back_to_back_chains * 3.2)
        weekly_hours[emp.id] = round(tracked_weekly_hrs + baseline_hrs, 1)
    return weekly_hours


def build_ona_insights(
    employees: list[Employee],
    meetings: list[MeetingEvent],
    loop_me_in_signals: list[LoopMeInSignal],
) -> OnaInsightsResponse:
    exclusion_alerts = detect_peer_exclusions(employees, meetings)
    weekly_hours = calculate_employee_weekly_meeting_hours(employees, meetings)
    emp_by_id = {e.id: e for e in employees}

    # Track which employees are omitted in any PeerExclusionAlert
    excluded_emp_ids: set[str] = set()
    for alert in exclusion_alerts:
        mtg = next((m for m in meetings if m.id == alert.meeting_id), None)
        if not mtg:
            continue
        attendee_set = set(mtg.all_attendees)
        for emp in employees:
            if emp.squad == alert.squad and emp.id not in attendee_set:
                excluded_emp_ids.add(emp.id)

    graph = nx.Graph()
    for emp in employees:
        graph.add_node(emp.id, squad=emp.squad, department=emp.department)

    for mtg in meetings:
        attendees = [a for a in mtg.all_attendees if a in emp_by_id]
        for i in range(len(attendees)):
            for j in range(i + 1, len(attendees)):
                u, v = attendees[i], attendees[j]
                if graph.has_edge(u, v):
                    graph[u][v]["weight"] += mtg.frequency_per_month
                else:
                    graph.add_edge(
                        u,
                        v,
                        weight=mtg.frequency_per_month,
                        same_squad=(emp_by_id[u].squad == emp_by_id[v].squad),
                    )

    nodes = [
        OnaGraphNode(
            id=emp.id,
            label=emp.name,
            squad=emp.squad,
            department=emp.department,
            role=emp.role,
            meeting_load_hrs=weekly_hours.get(emp.id, 4.0),
            is_isolated_risk=(emp.id in excluded_emp_ids or graph.degree(emp.id) <= 2),
        )
        for emp in employees
    ]

    edges = [
        OnaGraphEdge(
            source=u,
            target=v,
            shared_meetings_per_month=int(data["weight"]),
            same_squad=bool(data["same_squad"]),
        )
        for u, v, data in graph.edges(data=True)
    ]

    density = nx.density(graph) if len(employees) > 1 else 1.0
    cohesion_score = round(min(100.0, max(25.0, density * 140.0 - len(exclusion_alerts) * 8.0)), 1)

    if exclusion_alerts:
        affected_squads = sorted({a.squad for a in exclusion_alerts})
        silo_summary = (
            f"Detected {len(exclusion_alerts)} partial-squad exclusion pattern(s) across "
            f"{', '.join(affected_squads)} where 1–2 peers are omitted from recurring team syncs."
        )
    else:
        silo_summary = "All squads show full peer inclusion in recurring syncs."

    return OnaInsightsResponse(
        nodes=nodes,
        edges=edges,
        peer_exclusion_alerts=exclusion_alerts,
        loop_me_in_signals=loop_me_in_signals,
        network_cohesion_score=cohesion_score,
        silo_risk_summary=silo_summary,
    )


def analyze_meeting_diagnostics(
    employees: list[Employee],
    meetings: list[MeetingEvent],
    pulses: list[MicroPulseSubmission],
) -> list[MeetingDiagnostic]:
    emp_by_id = {e.id: e for e in employees}
    pulses_by_mtg: dict[str, list[MicroPulseSubmission]] = defaultdict(list)
    for p in pulses:
        pulses_by_mtg[p.meeting_id].append(p)

    diagnostics: list[MeetingDiagnostic] = []

    for mtg in meetings:
        organizer = emp_by_id.get(mtg.organizer_id)
        organizer_name = organizer.name if organizer else mtg.organizer_id
        dept = organizer.department if organizer else "Cross-Functional"
        attendee_count = len(mtg.all_attendees)
        monthly_person_hours = round(
            (attendee_count * mtg.duration_mins * mtg.frequency_per_month) / 60.0, 1
        )

        issues: list[str] = []
        fixes: list[str] = []

        if attendee_count > 8:
            issues.append("Spectator Bloat (>8 attendees)")
            fixes.append("Move passive listeners to Optional + shared async summary")
        if not mtg.has_agenda:
            issues.append("Missing Agenda / Objective")
            fixes.append("Add a 3-point agenda or cancel if no decisions are queued")
        if mtg.is_recurring and mtg.series_age_days >= 90 and not mtg.has_doc_link:
            issues.append(f"Zombie Recurrence ({mtg.series_age_days}d old, no shared doc)")
            fixes.append("Run a Recurring Reset: convert to async check-in or shorten to 25m")

        mtg_pulses = pulses_by_mtg.get(mtg.id, [])
        avg_pulse: float | None = None
        if mtg_pulses:
            avg_pulse = round(
                sum(p.usefulness_score for p in mtg_pulses) / len(mtg_pulses), 2
            )
            if avg_pulse < 3.0:
                issues.append(f"Low Employee Usefulness Pulse ({avg_pulse}/5)")

        if issues:
            impact = (
                f"Drains {monthly_person_hours} person-hours/month and fragments deep-work blocks "
                f"across {attendee_count} people."
            )
            suggested_fix = " • ".join(fixes) if fixes else "Review cadence with attendees"
        else:
            impact = "Healthy, well-scoped sync with clear agenda hygiene."
            suggested_fix = "Keep current async-friendly hygiene"

        diagnostics.append(
            MeetingDiagnostic(
                meeting_id=mtg.id,
                title_category=mtg.title_category,
                organizer_name=organizer_name,
                department=dept,
                attendee_count=attendee_count,
                duration_mins=mtg.duration_mins,
                is_recurring=mtg.is_recurring,
                series_age_days=mtg.series_age_days,
                has_agenda=mtg.has_agenda,
                has_doc_link=mtg.has_doc_link,
                monthly_person_hours=monthly_person_hours,
                issue_types=issues,
                wellbeing_impact=impact,
                suggested_fix=suggested_fix,
                avg_pulse_score=avg_pulse,
                pulse_count=len(mtg_pulses),
            )
        )

    diagnostics.sort(key=lambda d: (len(d.issue_types), d.monthly_person_hours), reverse=True)
    return diagnostics


def compute_organization_health_overview(
    active_provider: str,
    scenario_id: str,
    employees: list[Employee],
    meetings: list[MeetingEvent],
    pulses: list[MicroPulseSubmission],
    loop_me_in_signals: list[LoopMeInSignal],
    k_anonymity_threshold: int = 5,
) -> OrganizationHealthOverview:
    exclusion_alerts = detect_peer_exclusions(employees, meetings)
    diagnostics = analyze_meeting_diagnostics(employees, meetings, pulses)
    weekly_hours = calculate_employee_weekly_meeting_hours(employees, meetings)

    dept_emps: dict[str, list[Employee]] = defaultdict(list)
    for emp in employees:
        dept_emps[emp.department].append(emp)

    dept_summaries: list[DepartmentWellbeingSummary] = []
    for dept_name, members in sorted(dept_emps.items()):
        headcount = len(members)
        if headcount < k_anonymity_threshold:
            dept_summaries.append(
                DepartmentWellbeingSummary(
                    department=dept_name,
                    headcount=headcount,
                    is_redacted=True,
                    redaction_reason=(
                        f"Protected by k-anonymity (headcount {headcount} < {k_anonymity_threshold})"
                    ),
                )
            )
            continue

        avg_hrs = round(
            sum(weekly_hours.get(m.id, 0.0) for m in members) / headcount, 1
        )
        avg_focus = round(
            sum(m.weekly_focus_blocks for m in members) / headcount, 1
        )
        avg_b2b = round(
            sum(m.back_to_back_chains for m in members) / headcount, 1
        )

        member_ids = {m.id for m in members}
        dept_mtgs = [
            mtg for mtg in meetings if any(a in member_ids for a in mtg.all_attendees)
        ]
        if dept_mtgs:
            agenda_pct = round(
                (sum(1 for m in dept_mtgs if m.has_agenda) / len(dept_mtgs)) * 100.0, 1
            )
        else:
            agenda_pct = 100.0

        dept_exclusions = [a for a in exclusion_alerts if a.department == dept_name]
        inclusion_idx = max(40.0, round(100.0 - len(dept_exclusions) * 18.0, 1))

        if avg_focus < 2.0 or avg_b2b >= 4.0:
            burnout_risk = "High (Fragmented Calendar)"
        elif avg_focus < 3.5 or avg_b2b >= 2.5:
            burnout_risk = "Moderate"
        else:
            burnout_risk = "Low (Healthy Focus Blocks)"

        dept_summaries.append(
            DepartmentWellbeingSummary(
                department=dept_name,
                headcount=headcount,
                is_redacted=False,
                avg_meeting_hours_per_week=avg_hrs,
                avg_focus_blocks_per_week=avg_focus,
                avg_back_to_back_chains=avg_b2b,
                agenda_hygiene_pct=agenda_pct,
                inclusion_index_pct=inclusion_idx,
                burnout_risk_level=burnout_risk,
            )
        )

    total_emp = len(employees) or 1
    avg_company_focus = round(
        sum(e.weekly_focus_blocks for e in employees) / total_emp, 1
    )
    avg_company_hrs = round(
        sum(weekly_hours.values()) / total_emp, 1
    )
    bloated_count = sum(1 for m in meetings if len(m.all_attendees) > 8)
    zombie_count = sum(
        1 for m in meetings if m.is_recurring and m.series_age_days >= 90 and not m.has_doc_link
    )

    company_inclusion = max(
        35.0,
        round(100.0 - (len(exclusion_alerts) * 12.0) - (len(loop_me_in_signals) * 4.0), 1),
    )
    agenda_ratio = (
        sum(1 for m in meetings if m.has_agenda) / len(meetings) if meetings else 1.0
    )
    wellbeing_score = round(
        min(
            100.0,
            max(
                20.0,
                (avg_company_focus * 12.0)
                + (agenda_ratio * 30.0)
                + (company_inclusion * 0.35)
                - (bloated_count * 5.0),
            ),
        ),
        1,
    )

    return OrganizationHealthOverview(
        active_provider=active_provider,
        scenario_id=scenario_id,
        total_employees=len(employees),
        total_meetings_analyzed=len(meetings),
        k_anonymity_threshold=k_anonymity_threshold,
        company_wellbeing_score=wellbeing_score,
        company_inclusion_score=company_inclusion,
        avg_weekly_focus_blocks=avg_company_focus,
        avg_weekly_meeting_hours=avg_company_hrs,
        bloated_meeting_count=bloated_count,
        zombie_recurring_count=zombie_count,
        peer_exclusion_count=len(exclusion_alerts),
        loop_me_in_count=len(loop_me_in_signals),
        departments=dept_summaries,
    )
