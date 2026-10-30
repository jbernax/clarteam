import React, { useEffect, useState } from 'react';
import { OnaNetworkGraph } from './components/OnaNetworkGraph.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { TopBar } from './components/TopBar.tsx';
import {
  Users,
  Plug,
  Shield,
  Check,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  Lock,
  Calendar,
  FileText,
  CheckCircle2,
  Code2,
  Upload,
  Layers,
  SlidersHorizontal,
  Zap,
  EyeOff,
  Terminal,
  MessageSquare,
  Globe,
} from 'lucide-react';
import type {
  OrganizationHealthOverview,
  OnaInsightsResponse,
  MeetingDiagnostic,
  ChannelNudgeBundle,
  TeamsConnectorStatusResponse,
} from './types';

const SAMPLE_EMPLOYEES_CSV = `id,name,role,department,squad,manager_id,weekly_focus_blocks,back_to_back_chains
e1,Sofia Martinez,Tech Lead,Engineering,Payments Squad,m1,3,2
e2,Lukas Meyer,Backend Dev,Engineering,Payments Squad,m1,3,2
e3,Aisha Khan,Backend Dev,Engineering,Payments Squad,m1,3,2
e4,Kenji Sato,Frontend Dev,Engineering,Payments Squad,m1,3,2
e5,Tomasz Nowak,Systems Dev,Engineering,Payments Squad,m1,5,1`;

const SAMPLE_CALENDAR_ICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:ics-payments-arch
SUMMARY:Payments Architecture Weekly Sync
ORGANIZER:mailto:e1
ATTENDEE:mailto:e1
ATTENDEE:mailto:e2
ATTENDEE:mailto:e3
ATTENDEE:mailto:e4
RRULE:FREQ=WEEKLY
DESCRIPTION:Agenda: 1. Ledger API 2. Notes at https://docs.google.com/payments
END:VEVENT
END:VCALENDAR`;

export default function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'workspace'>('landing');
  const [activeTab, setActiveTab] = useState<'overview' | 'inclusion' | 'checkin' | 'connections'>('overview');
  const [checkinMode, setCheckinMode] = useState<'rate' | 'loop'>('rate');
  const [overview, setOverview] = useState<OrganizationHealthOverview | null>(null);
  const [ona, setOna] = useState<OnaInsightsResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<MeetingDiagnostic[]>([]);
  const [nudges, setNudges] = useState<ChannelNudgeBundle[]>([]);
  const [teamsStatus, setTeamsStatus] = useState<TeamsConnectorStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Progressive disclosure & filter toggles
  const [showTeamsSettings, setShowTeamsSettings] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showAllDirectory, setShowAllDirectory] = useState(false);
  const [meetingFilter, setMeetingFilter] = useState<'all' | 'flagged' | 'no_agenda'>('all');
  const [selectedChannel, setSelectedChannel] = useState<'ms_teams' | 'slack' | 'web_portal' | 'generic_webhook'>('ms_teams');

  // Check-in Form State
  const [pulseMeetingId, setPulseMeetingId] = useState('mtg-bloated-status');
  const [pulseScore, setPulseScore] = useState(3);
  const [pulseTags, setPulseTags] = useState<string[]>(['could_be_async']);
  const [loopSquad, setLoopSquad] = useState('Core Platform');
  const [loopTopic, setLoopTopic] = useState('');
  const [loopRemedy, setLoopRemedy] = useState('shared_async_notes');
  const [loopNote, setLoopNote] = useState('');

  // Teams Settings Form State
  const [tenantIdInput, setTenantIdInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [dryRunInput, setDryRunInput] = useState(true);

  // CSV Import State
  const [empCsvInput, setEmpCsvInput] = useState(SAMPLE_EMPLOYEES_CSV);
  const [calIcsInput, setCalIcsInput] = useState(SAMPLE_CALENDAR_ICS);

  const loadAllData = async () => {
    try {
      const [ovRes, onaRes, diagRes, nudgeRes, teamsRes] = await Promise.all([
        fetch('/api/health/overview'),
        fetch('/api/ona/insights'),
        fetch('/api/meetings/diagnostics'),
        fetch('/api/nudges/channels'),
        fetch('/api/connectors/teams/status'),
      ]);
      const [ovData, onaData, diagData, nudgeData, teamsData] = await Promise.all([
        ovRes.json(),
        onaRes.json(),
        diagRes.json(),
        nudgeRes.json(),
        teamsRes.json(),
      ]);

      setOverview(ovData);
      setOna(onaData);
      setDiagnostics(diagData);
      setNudges(nudgeData);
      setTeamsStatus(teamsData);
      setTenantIdInput(teamsData.tenant_id);
      setClientIdInput(teamsData.client_id);
      setDryRunInput(teamsData.dry_run_mode);

      if (diagData.length > 0 && !diagData.some((d: MeetingDiagnostic) => d.meeting_id === pulseMeetingId)) {
        setPulseMeetingId(diagData[0].meeting_id);
      }
    } catch (err) {
      console.error('Failed to load ClarTeam API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3800);
  };

  const handleDataSourceChange = async (value: string) => {
    if (value === 'ms_graph') {
      const res = await fetch('/api/connectors/teams/sync', { method: 'POST' });
      if (res.ok) {
        await loadAllData();
        notify('Synced with Microsoft Teams & Graph calendar metadata.');
      }
      return;
    }
    await fetch('/api/simulator/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: value }),
    });
    await loadAllData();
    notify('Updated organization dataset.');
  };

  const handleDispatchTeamsNudge = async (nudgeId?: string) => {
    const res = await fetch('/api/connectors/teams/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nudge_id: nudgeId || null }),
    });
    if (res.ok) {
      await loadAllData();
      notify('Private coaching card sent via Microsoft Teams.');
    }
  };

  const handleSimulateTeamsCallback = async (actionType: 'acknowledge_nudge' | 'submit_pulse') => {
    const firstNudge = nudges[0];
    const firstDiag = diagnostics[0];
    const payload =
      actionType === 'acknowledge_nudge'
        ? {
            action_type: 'acknowledge_nudge',
            nudge_id: firstNudge ? firstNudge.nudge_id : 'nudge-teams-1',
            organizer_resolution: 'Shared async notes & added omitted teammates as optional',
          }
        : {
            action_type: 'submit_pulse',
            meeting_id: firstDiag ? firstDiag.meeting_id : 'ms-series-weekly-status',
            usefulness_score: 4,
            tags: ['great_decisions'],
          };

    const res = await fetch('/api/connectors/teams/webhook/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await loadAllData();
      notify(
        actionType === 'acknowledge_nudge'
          ? 'Organizer acknowledged the coaching tip in Teams!'
          : 'Received 1-click rating from Teams Adaptive Card!'
      );
    }
  };

  const handleSaveTeamsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/connectors/teams/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenantIdInput,
        client_id: clientIdInput,
        client_secret: clientSecretInput || null,
        teams_webhook_url: webhookUrlInput || null,
        lookback_days: 30,
        dry_run_mode: dryRunInput,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      notify(`Could not save: ${err.detail}`);
      return;
    }
    setClientSecretInput('');
    setWebhookUrlInput('');
    setShowTeamsSettings(false);
    await loadAllData();
    notify('Microsoft Teams connection settings saved.');
  };

  const handleSubmitPulse = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/pulse/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_id: pulseMeetingId,
        usefulness_score: pulseScore,
        tags: pulseTags,
      }),
    });
    await loadAllData();
    notify('Thank you! Your anonymous feedback was recorded.');
  };

  const handleSubmitLoopMeIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loopTopic.trim()) return;
    await fetch('/api/inclusion/loop-me-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        squad: loopSquad,
        topic_area: loopTopic,
        preferred_remedy: loopRemedy,
        feeling_note: loopNote || null,
      }),
    });
    setLoopTopic('');
    setLoopNote('');
    await loadAllData();
    notify('Anonymous request sent. Organizers will be nudged to share async notes.');
  };

  const handleImportCsvIcs = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/import/csv-ics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employees_csv: empCsvInput,
        meetings_csv_or_ics: calIcsInput,
      }),
    });
    if (res.ok) {
      await loadAllData();
      setShowCsvModal(false);
      setViewMode('workspace');
      setActiveTab('inclusion');
      notify('Calendar data imported! Found 1 split-squad meeting in Payments Squad.');
    }
  };

  const toggleTag = (tag: string) => {
    setPulseTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  if (loading || !overview || !ona) {
    return (
      <div className="min-h-screen bg-architectural-grid flex items-center justify-center">
        <div className="bento-card px-6 py-4 rounded-full flex items-center gap-3 text-volcanic-900 text-sm font-medium">
          <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
          <span>Initializing ClarTeam ONA Telemetry...</span>
        </div>
      </div>
    );
  }

  const currentSourceValue =
    overview.active_provider === 'microsoft_graph' ? 'ms_graph' : overview.scenario_id;

  const filteredDiagnostics = diagnostics.filter((diag) => {
    if (meetingFilter === 'flagged') return diag.issue_types.length > 0;
    if (meetingFilter === 'no_agenda') return !diag.has_agenda;
    return true;
  });

  // SVG Gauge math for Wellbeing Score
  const gaugeRadius = 38;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset =
    gaugeCircumference - (Math.min(100, Math.max(0, overview.company_wellbeing_score)) / 100) * gaugeCircumference;

  return (
    <div className="min-h-screen bg-architectural-grid text-volcanic-900 flex flex-col font-sans">
      <TopBar
        viewMode={viewMode}
        activeTab={activeTab}
        peerExclusionCount={overview.peer_exclusion_count}
        kAnonymityThreshold={overview.k_anonymity_threshold}
        currentSourceValue={currentSourceValue}
        onSelectViewMode={setViewMode}
        onSelectTab={setActiveTab}
        onDataSourceChange={handleDataSourceChange}
      />

      {/* Subtle Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 obsidian-surface text-white px-4 py-3 rounded-2xl shadow-obsidian flex items-center gap-2.5 text-xs font-medium animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto w-full px-6 py-8 flex-1 space-y-10">
        {viewMode === 'landing' ? (
          <LandingPage
            overview={overview}
            ona={ona}
            diagnostics={diagnostics}
            onEnterWorkspace={(targetTab) => {
              if (targetTab) setActiveTab(targetTab);
              setViewMode('workspace');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectScenario={handleDataSourceChange}
          />
        ) : (
          <>
        {/* =========================================================
            TAB 1: OVERVIEW (Architectural Bento Grid & Diagnostics)
           ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-9 animate-fade-in">
            {/* Editorial Hero Section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2 border-b border-alabaster-200">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-emerald-800">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Organizational Network & Calendar Telemetry</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-semibold text-volcanic-900 tracking-tight leading-[1.12]">
                  Meeting Culture &{' '}
                  <span className="font-serif italic font-normal text-emerald-800">
                    Collective Wellbeing
                  </span>
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Structural insights across <strong className="text-volcanic-900 font-semibold">{overview.total_employees} people</strong> and{' '}
                  <strong className="text-volcanic-900 font-semibold">{overview.total_meetings_analyzed} recurring series</strong> — designed to protect deep maker time and keep every teammate in the loop.
                </p>
              </div>

              {/* Privacy & Quick Action Cluster */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 text-xs text-volcanic-900 bg-white px-3.5 py-2 rounded-full border border-alabaster-200 shadow-sm">
                  <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Teams under <strong>{overview.k_anonymity_threshold} people</strong> are automatically hidden
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('checkin')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full bg-volcanic-900 hover:bg-volcanic-800 text-white transition shadow-sm"
                >
                  <span>10s Pulse Check-in</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3-Column Architectural Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Bento Card 1: Radial Culture Health Gauge */}
              <div className="bento-card rounded-3xl p-6 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400 block">
                      01 / Culture Index
                    </span>
                    <h2 className="text-sm font-semibold text-volcanic-900 mt-1">
                      Overall Culture Health
                    </h2>
                    <div className="mt-3 flex items-baseline gap-2 tabular-nums">
                      <span className="text-4xl font-bold text-volcanic-900 tracking-tight">
                        {overview.company_wellbeing_score}
                      </span>
                      <span className="text-xs font-mono text-slate-400">/ 100</span>
                    </div>
                  </div>

                  {/* SVG Radial Gauge */}
                  <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 96 96">
                      <circle
                        cx="48"
                        cy="48"
                        r={gaugeRadius}
                        stroke="#F3F1EA"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r={gaugeRadius}
                        stroke={
                          overview.company_wellbeing_score >= 70
                            ? '#10B981'
                            : overview.company_wellbeing_score >= 50
                            ? '#F59E0B'
                            : '#FF6B4A'
                        }
                        strokeWidth="8"
                        strokeDasharray={gaugeCircumference}
                        strokeDashoffset={gaugeOffset}
                        strokeLinecap="round"
                        fill="none"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <span className="absolute font-mono text-[11px] font-semibold text-volcanic-900 tabular-nums">
                      {overview.company_wellbeing_score}%
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-alabaster-200 space-y-2.5">
                  <div className="w-full h-2 bg-alabaster-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, overview.company_wellbeing_score)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Synthesizes maker focus blocks, agenda clarity, and squad-wide inclusion.
                  </p>
                </div>
              </div>

              {/* Bento Card 2: Uninterrupted Maker Time */}
              <div className="bento-card rounded-3xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                      02 / Deep Work Rhythm
                    </span>
                    <span className="font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                      ≥2h windows
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-volcanic-900 mt-1">
                    Uninterrupted Focus Blocks
                  </h2>
                  <div className="mt-3 flex items-baseline gap-2 tabular-nums">
                    <span className="text-4xl font-bold text-volcanic-900 tracking-tight">
                      {overview.avg_weekly_focus_blocks}
                    </span>
                    <span className="text-xs font-mono text-slate-500">blocks / week</span>
                  </div>

                  {/* Visual Weekly Rhythm Strip */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>Maker Focus</span>
                      <span>{overview.avg_weekly_meeting_hours}h in syncs/wk</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 pt-0.5">
                      {[0, 1, 2, 3, 4].map((dayIdx) => {
                        const filled = dayIdx < Math.round(overview.avg_weekly_focus_blocks);
                        return (
                          <div
                            key={dayIdx}
                            className={`h-2.5 rounded-sm transition-colors ${
                              filled
                                ? 'bg-emerald-500'
                                : 'bg-coral-500/35'
                            }`}
                            title={filled ? 'Protected ≥2h focus block' : 'Fragmented by back-to-back syncs'}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-alabaster-200 flex items-center justify-between text-xs text-slate-500">
                  <span>Bloated / Zombie series</span>
                  <span className="font-mono font-semibold text-volcanic-900 tabular-nums">
                    {overview.bloated_meeting_count} bloated • {overview.zombie_recurring_count} stale
                  </span>
                </div>
              </div>

              {/* Bento Card 3: Volcanic Obsidian Squad Inclusion Highlight */}
              <div className="obsidian-surface text-white rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden">
                <div
                  className="absolute -right-8 -top-8 w-36 h-36 rounded-full pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(255,107,74,0.22) 0%, rgba(16,185,129,0) 70%)',
                  }}
                />
                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                      03 / ONA Cohesion
                    </span>
                    {overview.peer_exclusion_count > 0 ? (
                      <span className="font-mono text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-coral-500/20 text-coral-100 border border-coral-500/40">
                        {overview.peer_exclusion_count} split syncs
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        All squads aligned
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-semibold text-white mt-1">
                    Squad Inclusion Score
                  </h2>
                  <div className="mt-3 flex items-baseline gap-2 tabular-nums">
                    <span className="text-4xl font-bold text-white tracking-tight">
                      {overview.company_inclusion_score}%
                    </span>
                    <span className="text-xs font-mono text-slate-400">peer alignment</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                    Detects when 1–2 squad peers are inadvertently left out of recurring team syncs.
                  </p>
                </div>

                <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono">
                    {overview.loop_me_in_count} "Loop Me In" signals
                  </span>
                  <button
                    onClick={() => setActiveTab('inclusion')}
                    className="text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 transition"
                  >
                    Explore ONA Graph <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Department Breakdown Matrix */}
            <div className="bento-card rounded-3xl overflow-hidden">
              <div className="px-6 py-5 border-b border-alabaster-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/60">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                    Cohort Telemetry
                  </span>
                  <h2 className="text-base font-semibold text-volcanic-900">
                    Teams & Departments Wellbeing Matrix
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Aggregated weekly load, deep focus availability, and agenda hygiene per department.
                  </p>
                </div>
                <span className="font-mono text-[11px] text-slate-500 bg-alabaster-100 px-3 py-1 rounded-full border border-alabaster-200">
                  Privacy threshold: k ≥ {overview.k_anonymity_threshold}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-alabaster-100/70 font-mono text-[11px] uppercase tracking-wider text-slate-500 border-b border-alabaster-200">
                    <tr>
                      <th className="px-6 py-3.5">Department</th>
                      <th className="px-6 py-3.5">Team Size</th>
                      <th className="px-6 py-3.5">Meeting Load</th>
                      <th className="px-6 py-3.5">Focus Blocks (≥2h)</th>
                      <th className="px-6 py-3.5">Clear Agenda</th>
                      <th className="px-6 py-3.5">Wellbeing Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-alabaster-200">
                    {overview.departments.map((dept) => {
                      const loadPct = dept.avg_meeting_hours_per_week
                        ? Math.min(100, Math.round((dept.avg_meeting_hours_per_week / 30) * 100))
                        : 0;
                      return (
                        <tr
                          key={dept.department}
                          className="hover:bg-alabaster-50/80 transition-colors"
                        >
                          <td className="px-6 py-4 font-semibold text-volcanic-900">
                            {dept.department}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-500 tabular-nums">
                            {dept.headcount} people
                          </td>
                          {dept.is_redacted ? (
                            <td colSpan={4} className="px-6 py-4">
                              <span className="inline-flex items-center gap-2 text-xs text-slate-600 bg-alabaster-100 px-3.5 py-1.5 rounded-full border border-alabaster-200">
                                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                                Hidden to protect individual privacy (fewer than{' '}
                                {overview.k_anonymity_threshold} people)
                              </span>
                            </td>
                          ) : (
                            <>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2.5 tabular-nums">
                                  <div className="w-20 h-1.5 bg-alabaster-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        (dept.avg_meeting_hours_per_week || 0) > 20
                                          ? 'bg-coral-500'
                                          : 'bg-volcanic-900'
                                      }`}
                                      style={{ width: `${loadPct}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-xs text-volcanic-900">
                                    {dept.avg_meeting_hours_per_week} hrs/wk
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-volcanic-900 font-semibold tabular-nums">
                                {dept.avg_focus_blocks_per_week} blocks/wk
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-slate-700 tabular-nums">
                                {dept.agenda_hygiene_pct}%
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    dept.burnout_risk_level?.startsWith('High')
                                      ? 'bg-coral-50 text-coral-700 border border-coral-500/30'
                                      : dept.burnout_risk_level?.startsWith('Moderate')
                                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  }`}
                                >
                                  {dept.burnout_risk_level}
                                </span>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Meetings to Review (Interactive Diagnostic Cards) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                    Series Diagnostics
                  </span>
                  <h2 className="text-lg font-semibold text-volcanic-900">
                    Meetings to Review
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Recurring series flagged for spectator bloat, missing agendas, or low usefulness ratings.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-alabaster-100 p-1 rounded-full border border-alabaster-200 text-xs">
                  {[
                    { id: 'all', label: `All Series (${diagnostics.length})` },
                    {
                      id: 'flagged',
                      label: `Needs Review (${diagnostics.filter((d) => d.issue_types.length > 0).length})`,
                    },
                    {
                      id: 'no_agenda',
                      label: `No Agenda (${diagnostics.filter((d) => !d.has_agenda).length})`,
                    },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setMeetingFilter(f.id as typeof meetingFilter)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                        meetingFilter === f.id
                          ? 'bg-volcanic-900 text-white shadow-sm'
                          : 'text-slate-600 hover:text-volcanic-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredDiagnostics.map((diag) => {
                  const hasIssues = diag.issue_types.length > 0;
                  return (
                    <div
                      key={diag.meeting_id}
                      className="bento-card rounded-3xl p-6 flex flex-col justify-between space-y-5"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                              {diag.department} • Org: {diag.organizer_name}
                            </span>
                            <h3 className="text-base font-semibold text-volcanic-900 mt-0.5">
                              {diag.title_category}
                            </h3>
                          </div>
                          <span
                            className={`font-mono text-[11px] font-semibold px-3 py-1 rounded-full shrink-0 tabular-nums ${
                              hasIssues
                                ? 'bg-coral-50 text-coral-700 border border-coral-500/30'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {hasIssues ? `${diag.monthly_person_hours} hrs/mo` : 'Healthy Ritual'}
                          </span>
                        </div>

                        {/* Metadata Pills */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-alabaster-100 border border-alabaster-200 font-mono text-[11px]">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {diag.attendee_count} people
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-alabaster-100 border border-alabaster-200 font-mono text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {diag.duration_mins}m
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] ${
                              diag.has_agenda
                                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                                : 'bg-amber-50/80 border-amber-200 text-amber-800'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {diag.has_agenda ? 'Has agenda' : 'No written agenda'}
                          </span>
                          {diag.avg_pulse_score && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-volcanic-900 text-white font-mono text-[11px]">
                              ★ {diag.avg_pulse_score}/5 ({diag.pulse_count})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pt-3.5 border-t border-alabaster-200 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-600 leading-relaxed">
                          <strong className="font-semibold text-volcanic-900">Coaching Tip:</strong>{' '}
                          {diag.suggested_fix}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setPulseMeetingId(diag.meeting_id);
                            setCheckinMode('rate');
                            setActiveTab('checkin');
                          }}
                          className="shrink-0 text-xs font-medium text-emerald-700 hover:text-emerald-900 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/70 transition"
                        >
                          Rate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: INCLUSION (ONA Topology Graph & Split-Squad Alerts)
           ========================================================= */}
        {activeTab === 'inclusion' && (
          <div className="space-y-9 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-alabaster-200">
              <div>
                <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-coral-600">
                  <Users className="w-3.5 h-3.5" />
                  <span>Structural Inclusion & Anti-Silo Engine</span>
                </div>
                <h1 className="text-3xl font-semibold text-volcanic-900 tracking-tight mt-1">
                  Team Inclusion &{' '}
                  <span className="font-serif italic font-normal text-emerald-800">
                    Shared Context
                  </span>
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Detects when most of a squad meets regularly while 1–2 peers are accidentally left out of the loop.
                </p>
              </div>
            </div>

            {/* Interactive SVG ONA Squad Constellation */}
            <OnaNetworkGraph ona={ona} />

            {/* Split-Squad Exclusion Alerts */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-volcanic-900">
                    Active Split-Squad Exclusion Alerts ({ona.peer_exclusion_alerts.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Constructive nudges are delivered privately to the meeting organizer — never on a public blame board.
                  </p>
                </div>
              </div>

              {ona.peer_exclusion_alerts.length === 0 ? (
                <div className="bento-card rounded-3xl p-8 text-center space-y-2">
                  <Check className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h3 className="text-base font-semibold text-volcanic-900">
                    All squads are fully included
                  </h3>
                  <p className="text-xs text-slate-500">
                    No partial-squad exclusion patterns were found in recurring meetings.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {ona.peer_exclusion_alerts.map((alert) => {
                    const dots = Array.from(
                      { length: alert.squad_size },
                      (_, idx) => idx < alert.included_peer_count
                    );
                    return (
                      <div
                        key={alert.alert_id}
                        className="bento-card rounded-3xl p-6 flex flex-col justify-between space-y-5"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold text-coral-700 bg-coral-50 border border-coral-500/30 px-3 py-0.5 rounded-full">
                              {alert.squad}
                            </span>
                            {/* Visual Squad Inclusion Dots */}
                            <div
                              className="flex items-center gap-1.5"
                              title={`${alert.included_peer_count} included, ${alert.excluded_peer_count} omitted`}
                            >
                              {dots.map((included, i) => (
                                <span
                                  key={i}
                                  className={`w-2.5 h-2.5 rounded-full ${
                                    included
                                      ? 'bg-emerald-500'
                                      : 'bg-coral-500 ring-2 ring-coral-100'
                                  }`}
                                />
                              ))}
                              <span className="ml-1.5 font-mono text-xs text-slate-500 tabular-nums">
                                {alert.included_peer_count}/{alert.squad_size} peers
                              </span>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-base font-semibold text-volcanic-900">
                              {alert.meeting_category}
                            </h3>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                              {alert.included_peer_count} of {alert.squad_size} teammates in{' '}
                              <strong>{alert.squad}</strong> attend this recurring sync, leaving{' '}
                              {alert.excluded_peer_count} teammate(s) without direct visibility.
                            </p>
                          </div>
                        </div>

                        <div className="bg-alabaster-50 rounded-2xl p-4 border border-alabaster-200 space-y-3">
                          <p className="text-xs text-slate-700 leading-relaxed">
                            <strong className="text-volcanic-900">
                              Gentle nudge to {alert.organizer_name}:
                            </strong>{' '}
                            "{alert.recommended_action}"
                          </p>
                          <button
                            onClick={() => handleDispatchTeamsNudge(`nudge-${alert.alert_id}`)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-500/10 hover:bg-emerald-500/20 px-3.5 py-2 rounded-full transition"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Send private tip to organizer in Teams
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Anonymous "Loop-Me-In" Requests from Employees */}
            <div className="bento-card rounded-3xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                    Bottom-Up Inclusion Signals
                  </span>
                  <h2 className="text-base font-semibold text-volcanic-900">
                    "Loop Me In" Requests from Teammates
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Topics where teammates anonymously asked for written summaries instead of being left out.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setCheckinMode('loop');
                    setActiveTab('checkin');
                  }}
                  className="text-xs font-medium px-4 py-2 rounded-full bg-volcanic-900 hover:bg-volcanic-800 text-white transition shadow-sm"
                >
                  + Request notes on a topic
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ona.loop_me_in_signals.map((sig, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-alabaster-50 border border-alabaster-200 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                        {sig.squad}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        Remedy: {sig.preferred_remedy.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-volcanic-900">{sig.topic_area}</p>
                    {sig.feeling_note && (
                      <p className="text-xs text-slate-600 italic">"{sig.feeling_note}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Collapsible Squad Directory */}
            <div className="bento-card rounded-3xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAllDirectory(!showAllDirectory)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-alabaster-50/60 transition"
              >
                <div>
                  <h3 className="text-sm font-semibold text-volcanic-900">
                    View Full Squad Directory ({ona.nodes.length} members)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tabular roster of squad roles and weekly sync load.
                  </p>
                </div>
                {showAllDirectory ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showAllDirectory && (
                <div className="px-6 pb-6 pt-3 border-t border-alabaster-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {ona.nodes.map((node) => (
                    <div
                      key={node.id}
                      className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
                        node.is_isolated_risk
                          ? 'bg-coral-50/60 border-coral-500/30'
                          : 'bg-alabaster-50 border-alabaster-200'
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-volcanic-900">{node.label}</p>
                        <p className="text-slate-500">
                          {node.role} • {node.squad}
                        </p>
                      </div>
                      {node.is_isolated_risk ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-coral-100 text-coral-700 font-mono text-[10px] font-semibold">
                          Missed sync
                        </span>
                      ) : (
                        <span className="font-mono text-slate-500 tabular-nums">
                          {node.meeting_load_hrs}h/wk
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3: EMPLOYEE CHECK-IN (Zero-Surveillance Sanctuary)
           ========================================================= */}
        {activeTab === 'checkin' && (
          <div className="max-w-xl mx-auto py-4 space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 font-mono text-[11px] uppercase tracking-wider">
                <EyeOff className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero Identity Logging</span>
              </div>
              <h1 className="text-3xl font-semibold text-volcanic-900 tracking-tight">
                Anonymous Employee{' '}
                <span className="font-serif italic font-normal text-emerald-800">Check-in</span>
              </h1>
              <p className="text-sm text-slate-600">
                Your identity is never recorded. Help make meetings calmer, shorter, and more inclusive.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 bg-alabaster-100 p-1.5 rounded-full border border-alabaster-200">
              <button
                type="button"
                onClick={() => setCheckinMode('rate')}
                className={`py-2 rounded-full text-xs font-medium transition ${
                  checkinMode === 'rate'
                    ? 'bg-volcanic-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-volcanic-900'
                }`}
              >
                Rate a Meeting (10 sec)
              </button>
              <button
                type="button"
                onClick={() => setCheckinMode('loop')}
                className={`py-2 rounded-full text-xs font-medium transition ${
                  checkinMode === 'loop'
                    ? 'bg-volcanic-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-volcanic-900'
                }`}
              >
                Ask to Be Looped In
              </button>
            </div>

            {checkinMode === 'rate' ? (
              <form
                onSubmit={handleSubmitPulse}
                className="bento-card rounded-3xl p-6 sm:p-8 space-y-6"
              >
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-volcanic-900">
                    Which meeting did you attend?
                  </label>
                  <select
                    value={pulseMeetingId}
                    onChange={(e) => setPulseMeetingId(e.target.value)}
                    className="w-full bg-alabaster-50 border border-alabaster-200 rounded-2xl px-4 py-3 text-sm text-volcanic-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  >
                    {diagnostics.map((d) => (
                      <option key={d.meeting_id} value={d.meeting_id}>
                        {d.title_category} ({d.attendee_count} people)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-volcanic-900">
                    Was it a good use of your time?
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { val: 1, label: '1 • Drain' },
                      { val: 2, label: '2 • Low' },
                      { val: 3, label: '3 • Okay' },
                      { val: 4, label: '4 • Good' },
                      { val: 5, label: '5 • Great' },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.val}
                        onClick={() => setPulseScore(item.val)}
                        className={`py-3 rounded-2xl text-xs font-medium border transition ${
                          pulseScore === item.val
                            ? 'bg-volcanic-900 border-volcanic-900 text-white shadow-sm'
                            : 'bg-alabaster-50 border-alabaster-200 text-slate-600 hover:bg-alabaster-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-volcanic-900">
                    What would make it better? (Optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'could_be_async', label: 'Could have been an async update' },
                      { id: 'too_many_people', label: 'Too many people invited' },
                      { id: 'missing_key_people', label: 'Missing key teammates' },
                      { id: 'no_clear_agenda', label: 'Needed a clearer agenda' },
                      { id: 'great_decisions', label: 'Clear & inclusive decisions' },
                    ].map((tag) => {
                      const selected = pulseTags.includes(tag.id);
                      return (
                        <button
                          type="button"
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          className={`text-xs px-3.5 py-1.5 rounded-full border transition ${
                            selected
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-medium'
                              : 'bg-white border-alabaster-200 text-slate-600 hover:bg-alabaster-50'
                          }`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-full bg-volcanic-900 hover:bg-volcanic-800 text-white text-sm font-medium transition shadow-sm"
                >
                  Send Anonymous Rating
                </button>
              </form>
            ) : (
              <form
                onSubmit={handleSubmitLoopMeIn}
                className="bento-card rounded-3xl p-6 sm:p-8 space-y-5"
              >
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-volcanic-900">
                    Your Team or Squad
                  </label>
                  <select
                    value={loopSquad}
                    onChange={(e) => setLoopSquad(e.target.value)}
                    className="w-full bg-alabaster-50 border border-alabaster-200 rounded-2xl px-4 py-3 text-sm text-volcanic-900"
                  >
                    <option value="Core Platform">Core Platform</option>
                    <option value="Cloud Core Squad">Cloud Core Squad</option>
                    <option value="Checkout Squad">Checkout Squad</option>
                    <option value="Experience Squad">Experience Squad</option>
                    <option value="Growth Squad">Growth Squad</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-volcanic-900">
                    Which topic or decision do you feel out of the loop on?
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Architecture changes, Q4 roadmap priorities..."
                    value={loopTopic}
                    onChange={(e) => setLoopTopic(e.target.value)}
                    className="w-full bg-alabaster-50 border border-alabaster-200 rounded-2xl px-4 py-3 text-sm text-volcanic-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-volcanic-900">
                    How can the team include you without adding meeting overload?
                  </label>
                  <select
                    value={loopRemedy}
                    onChange={(e) => setLoopRemedy(e.target.value)}
                    className="w-full bg-alabaster-50 border border-alabaster-200 rounded-2xl px-4 py-3 text-sm text-volcanic-900"
                  >
                    <option value="shared_async_notes">
                      Share a 3-bullet written summary after meetings
                    </option>
                    <option value="decision_log">Post key decisions in the team channel</option>
                    <option value="optional_invite">Add me as an Optional attendee</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-volcanic-900">
                    Additional context (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Any helpful note for your team..."
                    value={loopNote}
                    onChange={(e) => setLoopNote(e.target.value)}
                    className="w-full bg-alabaster-50 border border-alabaster-200 rounded-2xl px-4 py-2.5 text-sm text-volcanic-900"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium transition shadow-sm"
                >
                  Request Shared Context Anonymously
                </button>
              </form>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 4: CONNECTIONS (Teams Pipeline, Channel Studio & CSV)
           ========================================================= */}
        {activeTab === 'connections' && (
          <div className="space-y-9 animate-fade-in">
            <div className="pb-2 border-b border-alabaster-200">
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-indigo-600">
                <Plug className="w-3.5 h-3.5" />
                <span>Pluggable Ingestion & Coaching Adapters</span>
              </div>
              <h1 className="text-3xl font-semibold text-volcanic-900 tracking-tight mt-1">
                Connections &{' '}
                <span className="font-serif italic font-normal text-emerald-800">
                  Coaching Delivery
                </span>
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Connect Microsoft Teams, Slack, or upload a simple calendar file — zero vendor lock-in.
              </p>
            </div>

            {/* Primary Microsoft Teams & Graph Connector Studio */}
            {teamsStatus && (
              <div className="bento-card rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 font-mono font-bold text-base shadow-sm">
                      T
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-volcanic-900">
                          Microsoft Teams & Graph Connector
                        </h2>
                        <span className="font-mono text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {teamsStatus.dry_run_mode ? 'Sandbox Mode' : 'Live Connected'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Two-way integration: syncs calendar metadata via Microsoft Graph and dispatches private Adaptive Card coaching nudges.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleDataSourceChange('ms_graph')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sync Calendar Data
                    </button>
                    <button
                      onClick={() => handleDispatchTeamsNudge()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-volcanic-900 hover:bg-volcanic-800 text-white text-xs font-medium transition shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Test Card
                    </button>
                    <button
                      onClick={() => setShowTeamsSettings(!showTeamsSettings)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-alabaster-100 hover:bg-alabaster-200 text-volcanic-900 text-xs font-medium border border-alabaster-200 transition"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      {showTeamsSettings ? 'Close Settings' : 'Configure'}
                    </button>
                  </div>
                </div>

                {/* 4-Stage Privacy & Telemetry Pipeline Strip */}
                {teamsStatus.last_sync_report && (
                  <div className="bg-alabaster-50 rounded-2xl p-4 border border-alabaster-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-6 flex-wrap">
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                          01 / Directory
                        </span>
                        <strong className="text-volcanic-900 font-mono">
                          {teamsStatus.last_sync_report.users_fetched} members
                        </strong>
                      </div>
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                          02 / Deduplication
                        </span>
                        <strong className="text-volcanic-900 font-mono">
                          {teamsStatus.last_sync_report.deduplicated_series_count} recurring series
                        </strong>
                      </div>
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                          03 / Privacy Filter
                        </span>
                        <strong className="text-emerald-700 font-mono">
                          {teamsStatus.last_sync_report.descriptions_stripped_count} descriptions stripped
                        </strong>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSimulateTeamsCallback('acknowledge_nudge')}
                      className="text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-4"
                    >
                      Simulate organizer clicking "Accept" in Teams
                    </button>
                  </div>
                )}

                {/* Collapsible Credentials Drawer */}
                {showTeamsSettings && (
                  <form
                    onSubmit={handleSaveTeamsConfig}
                    className="pt-4 border-t border-alabaster-200 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Azure Tenant ID
                        </label>
                        <input
                          type="text"
                          value={tenantIdInput}
                          onChange={(e) => setTenantIdInput(e.target.value)}
                          className="w-full bg-alabaster-50 border border-alabaster-200 rounded-xl px-3.5 py-2 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          App Client ID
                        </label>
                        <input
                          type="text"
                          value={clientIdInput}
                          onChange={(e) => setClientIdInput(e.target.value)}
                          className="w-full bg-alabaster-50 border border-alabaster-200 rounded-xl px-3.5 py-2 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Client Secret ({teamsStatus.client_secret_masked})
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••••••"
                          value={clientSecretInput}
                          onChange={(e) => setClientSecretInput(e.target.value)}
                          className="w-full bg-alabaster-50 border border-alabaster-200 rounded-xl px-3.5 py-2 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Teams Webhook URL ({teamsStatus.teams_webhook_url_masked})
                        </label>
                        <input
                          type="password"
                          placeholder="https://company.webhook.office.com/..."
                          value={webhookUrlInput}
                          onChange={(e) => setWebhookUrlInput(e.target.value)}
                          className="w-full bg-alabaster-50 border border-alabaster-200 rounded-xl px-3.5 py-2 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dryRunInput}
                          onChange={(e) => setDryRunInput(e.target.checked)}
                          className="rounded border-slate-300"
                        />
                        Use built-in Sandbox mode (test without live Azure credentials)
                      </label>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition"
                      >
                        Save Connection
                      </button>
                    </div>
                  </form>
                )}

                {/* Recent Activity Log */}
                {teamsStatus.activity_ledger.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                      Recent Teams Activity Ledger
                    </span>
                    <div className="space-y-1.5">
                      {teamsStatus.activity_ledger.slice(0, 3).map((rec) => (
                        <div
                          key={rec.delivery_id}
                          className="flex items-center justify-between text-xs py-2.5 px-3.5 rounded-xl bg-alabaster-50 border border-alabaster-200"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                rec.direction === 'outbound_nudge'
                                  ? 'bg-indigo-500'
                                  : 'bg-emerald-500'
                              }`}
                            />
                            <span className="font-medium text-volcanic-900">
                              {rec.target_summary}
                            </span>
                          </div>
                          <span className="text-slate-500 font-mono text-[11px]">
                            {rec.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Visual Coaching Card Preview + Multi-Channel Switcher */}
            <div className="bento-card rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                    Adaptive Coaching Studio
                  </span>
                  <h2 className="text-lg font-semibold text-volcanic-900">
                    How Organizer Nudges Look
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supportive, private tips delivered across your preferred workplace tool.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex bg-alabaster-100 p-1 rounded-full border border-alabaster-200 text-xs">
                    {[
                      { id: 'ms_teams', label: 'MS Teams', icon: Layers },
                      { id: 'slack', label: 'Slack', icon: MessageSquare },
                      { id: 'web_portal', label: 'Web / Email', icon: Globe },
                      { id: 'generic_webhook', label: 'Webhook', icon: Terminal },
                    ].map((ch) => {
                      const ChIcon = ch.icon;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => setSelectedChannel(ch.id as typeof selectedChannel)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full transition ${
                            selectedChannel === ch.id
                              ? 'bg-volcanic-900 text-white shadow-sm font-medium'
                              : 'text-slate-600 hover:text-volcanic-900'
                          }`}
                        >
                          <ChIcon className="w-3 h-3" />
                          <span>{ch.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-alabaster-200 bg-white text-xs font-mono text-volcanic-900 hover:bg-alabaster-50"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    {showRawJson ? 'Hide JSON' : 'JSON'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {nudges.slice(0, 2).map((nudge) => {
                  const payload =
                    selectedChannel === 'ms_teams'
                      ? nudge.teams_adaptive_card
                      : selectedChannel === 'slack'
                      ? nudge.slack_block_kit
                      : selectedChannel === 'web_portal'
                      ? nudge.web_portal_payload
                      : nudge.generic_webhook_payload;

                  return (
                    <div
                      key={nudge.nudge_id}
                      className="rounded-2xl bg-alabaster-50 border border-alabaster-200 p-5 flex flex-col justify-between space-y-4 border-l-4 border-l-emerald-600"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            Private Coaching Tip • {selectedChannel.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {nudge.target_audience}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-volcanic-900">
                          {nudge.headline}
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {nudge.body_text}
                        </p>
                      </div>

                      <div className="pt-2 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleDispatchTeamsNudge(nudge.nudge_id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-volcanic-900 hover:bg-volcanic-800 text-white text-xs font-medium shadow-sm transition"
                        >
                          <Zap className="w-3 h-3 text-emerald-400" />
                          <span>✓ {nudge.action_label}</span>
                        </button>
                      </div>

                      {showRawJson && (
                        <pre className="bg-volcanic-950 text-emerald-300 p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-44 border border-white/10">
                          {JSON.stringify(payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Universal CSV / ICS Importer */}
            <div className="bento-card rounded-3xl overflow-hidden">
              <div className="p-6 sm:p-8 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                    Zero-IT Open Standard
                  </span>
                  <h2 className="text-lg font-semibold text-volcanic-900">
                    Universal CSV & Calendar (.ics) Import
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    No API keys required — upload exported calendars from Google Workspace, Nextcloud, or Outlook.
                  </p>
                </div>
                <button
                  onClick={() => setShowCsvModal(!showCsvModal)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-alabaster-100 hover:bg-alabaster-200 text-volcanic-900 border border-alabaster-200 text-xs font-medium transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {showCsvModal ? 'Hide Importer' : 'Import CSV / ICS'}
                </button>
              </div>

              {showCsvModal && (
                <form
                  onSubmit={handleImportCsvIcs}
                  className="px-6 sm:px-8 pb-8 pt-4 border-t border-alabaster-200 space-y-4 bg-alabaster-50/50"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-volcanic-900 mb-1.5">
                        Team Directory (CSV)
                      </label>
                      <textarea
                        rows={6}
                        value={empCsvInput}
                        onChange={(e) => setEmpCsvInput(e.target.value)}
                        className="w-full bg-white border border-alabaster-200 rounded-2xl p-3.5 text-xs font-mono text-volcanic-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-volcanic-900 mb-1.5">
                        Calendar Events (.ICS or CSV)
                      </label>
                      <textarea
                        rows={6}
                        value={calIcsInput}
                        onChange={(e) => setCalIcsInput(e.target.value)}
                        className="w-full bg-white border border-alabaster-200 rounded-2xl p-3.5 text-xs font-mono text-volcanic-900"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition shadow-sm"
                    >
                      Run Analysis on Imported Files
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Subtle Editorial Footer */}
      <footer className="border-t border-alabaster-200 bg-white/60 py-5 px-6 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-volcanic-900">ClarTeam</span>
            <span>•</span>
            <span>Privacy-First Meeting Culture & ONA Cohesion Platform</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            MIT Open Source • Zero Audio/Video • Strict k ≥ {overview.k_anonymity_threshold} Anonymity
          </div>
        </div>
      </footer>
    </div>
  );
}
