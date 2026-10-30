from __future__ import annotations

from typing import Any
from app.models.domain import ChannelNudgeBundle, PeerExclusionAlert, MeetingDiagnostic


def build_multi_channel_nudge(
    nudge_id: str,
    nudge_type: str,
    target_audience: str,
    headline: str,
    body_text: str,
    action_label: str,
    context_meta: dict[str, Any],
) -> ChannelNudgeBundle:
    """
    Generates an open, multi-channel coaching payload so organizations can use
    Web/Email, Slack, Microsoft Teams, or any generic Webhook (Mattermost, Discord, Matrix).
    """
    web_portal_payload = {
        "type": "culture_feedback_web_card",
        "version": "1.0",
        "nudge_id": nudge_id,
        "badge": nudge_type.replace("_", " ").upper(),
        "recipient_scope": target_audience,
        "headline": headline,
        "body": body_text,
        "primary_action": {
            "label": action_label,
            "url": f"/portal/action/{nudge_id}",
        },
        "privacy_guarantee": "Private coaching tip — never visible to management or public dashboards.",
        "metadata": context_meta,
    }

    slack_block_kit = {
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"🌱 {headline}", "emoji": True},
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": body_text},
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"🔒 *Privacy-First Coaching* • Target: `{target_audience}` • k-Anonymity Protected",
                    }
                ],
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": action_label, "emoji": True},
                        "style": "primary",
                        "value": nudge_id,
                        "action_id": f"act_{nudge_id}",
                    }
                ],
            },
        ]
    }

    teams_adaptive_card = {
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.5",
        "body": [
            {
                "type": "TextBlock",
                "text": f"🌱 Culture Feedback • {nudge_type.replace('_', ' ').title()}",
                "weight": "Bolder",
                "color": "Accent",
                "size": "Small",
            },
            {
                "type": "TextBlock",
                "text": headline,
                "weight": "Bolder",
                "size": "Medium",
                "wrap": True,
            },
            {
                "type": "TextBlock",
                "text": body_text,
                "wrap": True,
                "spacing": "Small",
            },
            {
                "type": "TextBlock",
                "text": "🔒 Private to you as organizer. Never tracked on performance dashboards.",
                "isSubtle": True,
                "size": "Small",
                "wrap": True,
            },
        ],
        "actions": [
            {
                "type": "Action.Submit",
                "title": action_label,
                "data": {"nudge_id": nudge_id, **context_meta},
            }
        ],
    }

    generic_webhook_payload = {
        "event": "culture_feedback.coaching_nudge",
        "nudge_id": nudge_id,
        "nudge_type": nudge_type,
        "target_audience": target_audience,
        "markdown": (
            f"### 🌱 {headline}\n\n"
            f"{body_text}\n\n"
            f"- **Recommended Action**: {action_label}\n"
            f"- **Privacy Guarantee**: Visible only to `{target_audience}` (k-anonymity enforced)."
        ),
        "metadata": context_meta,
    }

    return ChannelNudgeBundle(
        nudge_id=nudge_id,
        nudge_type=nudge_type,
        target_audience=target_audience,
        headline=headline,
        body_text=body_text,
        action_label=action_label,
        web_portal_payload=web_portal_payload,
        slack_block_kit=slack_block_kit,
        teams_adaptive_card=teams_adaptive_card,
        generic_webhook_payload=generic_webhook_payload,
    )


def generate_nudges_from_diagnostics(
    exclusion_alerts: list[PeerExclusionAlert],
    meeting_diagnostics: list[MeetingDiagnostic],
) -> list[ChannelNudgeBundle]:
    bundles: list[ChannelNudgeBundle] = []

    for alert in exclusion_alerts:
        bundles.append(
            build_multi_channel_nudge(
                nudge_id=f"nudge-{alert.alert_id}",
                nudge_type="inclusion_bridge",
                target_audience=f"Organizer only ({alert.organizer_name})",
                headline=f"Keep '{alert.squad}' in the loop on '{alert.meeting_category}'",
                body_text=alert.private_organizer_tip,
                action_label=alert.recommended_action,
                context_meta={
                    "meeting_id": alert.meeting_id,
                    "squad": alert.squad,
                    "inclusion_ratio": alert.inclusion_ratio,
                },
            )
        )

    for diag in meeting_diagnostics:
        if not diag.issue_types:
            continue
        bundles.append(
            build_multi_channel_nudge(
                nudge_id=f"nudge-scope-{diag.meeting_id}",
                nudge_type="wellbeing_and_scoping",
                target_audience=f"Organizer only ({diag.organizer_name})",
                headline=f"Reclaim team focus time in '{diag.title_category}'",
                body_text=(
                    f"This {diag.duration_mins}-min meeting with {diag.attendee_count} attendees "
                    f"consumes {diag.monthly_person_hours:.1f} person-hours/month "
                    f"({', '.join(diag.issue_types)}). {diag.wellbeing_impact}"
                ),
                action_label=diag.suggested_fix,
                context_meta={
                    "meeting_id": diag.meeting_id,
                    "monthly_person_hours": diag.monthly_person_hours,
                    "issues": diag.issue_types,
                },
            )
        )

    return bundles
