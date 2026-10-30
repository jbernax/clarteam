from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
from app.models.domain import Employee, MeetingEvent


class CalendarIngestProvider(ABC):
    """Pluggable interface for ingesting privacy-stripped organizational and calendar metadata."""

    provider_id: str
    display_name: str
    requires_enterprise_admin: bool = False

    @abstractmethod
    def load_organization_data(self) -> tuple[list[Employee], list[MeetingEvent]]:
        """Return normalized (employees, meetings) without any raw confidential body text."""


class NotificationChannelAdapter(ABC):
    """Pluggable interface for delivering private coaching nudges and anonymous micro-pulses."""

    channel_id: str
    display_name: str

    @abstractmethod
    def format_nudge(
        self,
        headline: str,
        body_text: str,
        action_label: str,
        metadata: dict[str, Any],
    ) -> dict[str, Any]:
        """Format a constructive coaching nudge or pulse card for the target channel."""


def extract_agenda_hygiene_from_text(raw_description: str | None) -> tuple[bool, bool]:
    """
    Privacy-boundary helper: inspects raw calendar description in memory and returns ONLY
    (has_agenda, has_doc_link) booleans so raw text is never persisted.
    """
    if not raw_description:
        return False, False
    cleaned = raw_description.strip().lower()
    has_doc_link = any(
        token in cleaned
        for token in ("http://", "https://", "notion.so", "docs.google", "sharepoint", "confluence")
    )
    agenda_markers = ("agenda", "objective", "goals", "1.", "- ", "* ", "topics:", "outcomes")
    has_agenda = len(cleaned) >= 40 and any(marker in cleaned for marker in agenda_markers)
    return has_agenda, has_doc_link
