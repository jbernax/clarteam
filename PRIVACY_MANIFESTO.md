# Employee Privacy & Wellbeing Manifesto

**ClarTeam** exists for one purpose: **to make employees' daily work lives healthier, more inclusive, and less fragmented.**

To earn and keep employee trust, this open-source software enforces four hard architectural rules in code:

## 1. Zero Audio, Video, or Transcript Recording
We never record calls, read chat messages, or transcribe voices. Healthy meeting culture does not require surveillance.

## 2. Structural Metadata Only (Zero Raw Text Storage)
When calendar events are ingested (via CSV/ICS, Google Workspace, CalDAV, or Microsoft Graph), raw meeting descriptions are stripped at the boundary into boolean hygiene indicators:
- `has_agenda` (`true` / `false`)
- `has_shared_doc_link` (`true` / `false`)
- `duration_mins` and `attendee_count`

## 3. Strict $k$-Anonymity ($k \ge 5$)
No team or department metric is ever displayed on a dashboard unless the cohort has at least **5 members** ($k \ge 5$). Individual employee metrics are never exposed to management or HR for performance evaluation.

## 4. Private, Constructive Coaching — Not Public Blame
When our Organizational Network Analysis (ONA) engine detects a structural issue—such as **1–2 squad members being inadvertently left out of recurring peer syncs**, or a 16-person recurring meeting without an agenda—it sends a **private, supportive coaching nudge** only to the meeting organizer (or surfaces an anonymized team-level recommendation to share asynchronous notes).
