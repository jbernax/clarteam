# ClarTeam

**Team Clarity & Cohesion Without Meeting Overload** • Open-Source, Privacy-First Meeting Health Platform

Organizations frequently suffer from structural meeting issues that drain employee energy and hurt psychological safety:
- **Calendar Overload & Fragmentation**: Back-to-back chains and scattered 30-minute syncs that destroy uninterrupted focus blocks ("Maker Time").
- **Poor Scoping & Spectator Bloat**: 15+ person recurring meetings without clear agendas where most attendees could have read a 3-bullet async summary.
- **Structural Exclusion ("Torn Apart" Teams)**: Inadvertently leaving 1–2 members of a squad or peer group outside recurring syncs, creating information silos and feelings of isolation.

Instead of recording audio/video (which violates privacy and erodes trust), **ClarTeam** uses **Organizational Network Analysis (ONA)** on privacy-stripped calendar metadata alongside **anonymous 1-click employee micro-pulses** and **"Loop-Me-In" inclusion signals**.

---

##  Provider-Agnostic & Open Source

Every organization uses different tools—and many teams want to improve their culture **without waiting months for Enterprise IT API approvals**. ClarTeam decouples its core analytical engine from any single vendor:

###  Pluggable Ingestion Providers (`backend/app/providers/ingest.py`)
1. **Universal CSV / ICS Import (Zero IT Setup)**: Upload a standard org chart CSV and calendar export—works with Nextcloud, Fastmail, Google Calendar, Outlook, or Zimbra.
2. **Google Workspace Adapter**: Normalizes Google Calendar + Directory API events.
3. **Microsoft Graph Adapter**: Normalizes Microsoft 365 / Teams calendar metadata.
4. **Built-in Organization Simulator**: Test 3 realistic organizational scenarios out-of-the-box.

###  Pluggable Coaching & Pulse Channels (`backend/app/providers/channels.py`)
1. **Standalone Web Portal**: Works in any browser via privacy-safe links (zero chat bot required).
2. **Slack Block Kit**: Native interactive blocks for Slack workspaces.
3. **Microsoft Teams Adaptive Cards**: Native JSON cards for Teams environments.
4. **Generic Webhook / Markdown**: Compatible with Mattermost, Discord, Matrix, or email bridges.

---

##  Privacy & Employee Protection Guarantees

Read our full [Employee Privacy & Wellbeing Manifesto](PRIVACY_MANIFESTO.md):
- **Zero Audio/Video/Transcripts**: Never records or reads private conversations.
- **Strict $k$-Anonymity ($k \ge 5$)**: Cohorts with fewer than 5 employees are automatically suppressed from leadership views.
- **Private Organizer Coaching**: When peer exclusion or meeting bloat is detected, constructive nudges go *privately* to the organizer—never onto a public leaderboard.

---

##  Quickstart

### 1. Run Backend (FastAPI + NetworkX)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Run Automated Tests
```bash
cd backend
pytest -v
```

### 3. Run Frontend (React + TypeScript + Vite)
```bash
cd frontend
npm install
npm run dev
```

---

##  Writing a Custom Provider Plugin

Adding a new calendar or HR directory source takes less than 25 lines of Python by implementing `CalendarIngestProvider` in `backend/app/providers/base.py`:

```python
from app.providers.base import CalendarIngestProvider
from app.models.domain import Employee, MeetingEvent

class MyCalDavProvider(CalendarIngestProvider):
    provider_id = "caldav"
    display_name = "CalDAV / Nextcloud"

    def load_organization_data(self) -> tuple[list[Employee], list[MeetingEvent]]:
        # Fetch and normalize into privacy-safe Employee and MeetingEvent objects
        ...
```

##  License
MIT License — see [LICENSE](LICENSE).
