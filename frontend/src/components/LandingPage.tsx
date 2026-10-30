import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Sparkles,
  Shield,
  Clock,
  Users,
  MessageSquareHeart,
  Plug,
  Lock,
  CheckCircle2,
  Network,
  Zap,
  EyeOff,
  Layers,
  Terminal,
} from 'lucide-react';
import { CohereLogo } from './CohereLogo.tsx';
import type {
  OrganizationHealthOverview,
  OnaInsightsResponse,
  MeetingDiagnostic,
} from '../types';

interface LandingPageProps {
  overview: OrganizationHealthOverview;
  ona: OnaInsightsResponse;
  diagnostics: MeetingDiagnostic[];
  onEnterWorkspace: (tab?: 'overview' | 'inclusion' | 'checkin' | 'connections') => void;
  onSelectScenario: (scenario: string) => void;
}

const TYPED_PHRASES = [
  'uninterrupted maker focus.',
  'inclusive squad rituals.',
  'async team clarity.',
  'calmer engineering weeks.',
];

export function LandingPage({
  overview,
  ona,
  diagnostics,
  onEnterWorkspace,
  onSelectScenario,
}: LandingPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeFeature, setActiveFeature] = useState<'focus' | 'ona' | 'coaching'>('ona');

  // Antigravity-style kinetic typing effect
  useEffect(() => {
    const currentPhrase = TYPED_PHRASES[phraseIdx];
    const typingSpeed = isDeleting ? 32 : 62;

    const timer = window.setTimeout(() => {
      if (!isDeleting && displayedText.length < currentPhrase.length) {
        setDisplayedText(currentPhrase.slice(0, displayedText.length + 1));
      } else if (!isDeleting && displayedText.length === currentPhrase.length) {
        window.setTimeout(() => setIsDeleting(true), 1800);
      } else if (isDeleting && displayedText.length > 0) {
        setDisplayedText(currentPhrase.slice(0, displayedText.length - 1));
      } else if (isDeleting && displayedText.length === 0) {
        setIsDeleting(false);
        setPhraseIdx((prev) => (prev + 1) % TYPED_PHRASES.length);
      }
    }, typingSpeed);

    return () => window.clearTimeout(timer);
  }, [displayedText, isDeleting, phraseIdx]);

  // Antigravity-inspired interactive floating particle constellation canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio);
    let height = (canvas.height = canvas.offsetHeight * window.devicePixelRatio);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const logicalW = () => canvas.offsetWidth;
    const logicalH = () => canvas.offsetHeight;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    window.addEventListener('resize', handleResize);

    const palette = ['#10B981', '#059669', '#FF6B4A', '#4F46E5', '#141517'];
    const particles = Array.from({ length: 38 }, (_, i) => ({
      x: Math.random() * (canvas.offsetWidth || 1000),
      y: Math.random() * (canvas.offsetHeight || 600),
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: i % 6 === 0 ? 3.5 : 2,
      color: palette[i % palette.length],
    }));

    const render = () => {
      const w = logicalW();
      const h = logicalH();
      ctx.clearRect(0, 0, w, h);

      // Update positions
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      // Draw subtle orbital links
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 135) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(20, 21, 23, ${0.08 * (1 - dist / 135)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animationFrameId = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="space-y-20 pb-12 animate-fade-in">
      {/* =====================================================================
          HERO SECTION (Antigravity.google Weightless Liftoff + Particle Canvas)
         ===================================================================== */}
      <section className="relative overflow-hidden rounded-[36px] border border-alabaster-200 bg-white/75 backdrop-blur-md px-6 sm:px-12 pt-14 pb-16 shadow-bento">
        {/* Interactive Particle Constellation Background */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        />

        {/* Ambient Radial Glows */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] h-[340px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(16, 185, 129, 0.11) 0%, rgba(255, 107, 74, 0.06) 45%, transparent 75%)',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          {/* Antigravity Announcement Pill */}
          <div className="inline-flex items-center gap-2.5 pl-2.5 pr-4 py-1.5 rounded-full bg-alabaster-100/90 border border-alabaster-200 shadow-sm">
            <span className="px-2 py-0.5 rounded-full bg-volcanic-900 text-white font-mono text-[10px] uppercase tracking-wider font-semibold">
              ClarTeam 2.0
            </span>
            <span className="text-xs font-medium text-volcanic-900">
              Experience liftoff from meeting overload with Privacy-First ONA
            </span>
            <button
              type="button"
              onClick={() => onEnterWorkspace('inclusion')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
            >
              <span>Explore Graph</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Monumental Display Headline + Typed Kinetic Accent */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl font-semibold text-volcanic-900 tracking-[-0.03em] leading-[1.06]">
              Team cohesion without
              <br />
              meeting overload — built for{' '}
              <span className="font-serif italic font-normal text-emerald-800 inline-block min-h-[1.15em]">
                {displayedText}
                <span className="inline-block w-[2px] h-[0.85em] bg-coral-500 ml-1 align-middle animate-pulse" />
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-normal">
              ClarTeam uses <strong className="text-volcanic-900 font-medium">Organizational Network Analysis (ONA)</strong> on privacy-stripped calendar metadata alongside 10-second anonymous micro-pulses to protect deep work and keep every squadmate in the loop.
            </p>
          </div>

          {/* Antigravity Pill CTA Bar */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <button
              type="button"
              onClick={() => onEnterWorkspace('overview')}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-volcanic-900 hover:bg-volcanic-800 text-white text-sm font-medium shadow-obsidian transition-all hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Launch Live Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onEnterWorkspace('inclusion')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/90 hover:bg-alabaster-100 text-volcanic-900 border border-alabaster-300 text-sm font-medium backdrop-blur-md transition-all"
            >
              <Network className="w-4 h-4 text-coral-500" />
              <span>Inspect Split-Squad ONA ({overview.peer_exclusion_count} alerts)</span>
            </button>

            <button
              type="button"
              onClick={() => onEnterWorkspace('connections')}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full bg-alabaster-100/80 hover:bg-alabaster-200 text-slate-700 text-xs font-mono uppercase tracking-wider transition"
            >
              <Plug className="w-3.5 h-3.5 text-indigo-600" />
              <span>MS Teams & CSV Sync</span>
            </button>
          </div>

          {/* Live Telemetry Preview Dock */}
          <div className="pt-6">
            <div className="obsidian-surface rounded-3xl p-5 sm:p-7 text-left text-white shadow-obsidian border border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-coral-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="font-mono text-xs text-slate-300">
                    clarteam://telemetry/{overview.scenario_id}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-400">Try live scenario:</span>
                  {[
                    { id: 'default_mixed', label: 'Balanced Org' },
                    { id: 'exclusion_heavy', label: 'Siloed Teams' },
                    { id: 'overload_crisis', label: 'Meeting Overload' },
                  ].map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => onSelectScenario(sc.id)}
                      className={`px-2.5 py-1 rounded-full font-mono text-[11px] transition ${
                        overview.scenario_id === sc.id && overview.active_provider !== 'microsoft_graph'
                          ? 'bg-emerald-400 text-slate-950 text-volcanic-950 font-semibold'
                          : 'bg-white/10 text-slate-300 hover:bg-white/20'
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4-Column Live Readout inside the Obsidian Dock */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                    Culture Health
                  </span>
                  <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
                    <span className="text-3xl font-bold text-emerald-400">
                      {overview.company_wellbeing_score}
                    </span>
                    <span className="text-xs font-mono text-slate-400">/ 100</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Across {overview.total_employees} people
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                    Maker Focus Blocks
                  </span>
                  <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
                    <span className="text-3xl font-bold text-white">
                      {overview.avg_weekly_focus_blocks}
                    </span>
                    <span className="text-xs font-mono text-slate-400">blocks/wk</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    ≥2h uninterrupted windows
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                    Squad Inclusion
                  </span>
                  <div className="mt-2 flex items-baseline gap-1.5 tabular-nums">
                    <span className="text-3xl font-bold text-coral-500">
                      {overview.company_inclusion_score}%
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    {overview.peer_exclusion_count} split-squad syncs flagged
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                      Privacy Shield
                    </span>
                    <p className="text-sm font-semibold text-white mt-2">
                      Strict k ≥ {overview.k_anonymity_threshold} Anonymity
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('overview')}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                  >
                    <span>Open Full Telemetry</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          INTERACTIVE PRODUCT JOURNEY (Antigravity 3-Pillar Architecture)
         ===================================================================== */}
      <section className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-emerald-800">
              How ClarTeam Works
            </span>
            <h2 className="text-3xl font-semibold text-volcanic-900 tracking-tight mt-1">
              Three structural engines for{' '}
              <span className="font-serif italic font-normal text-emerald-800">
                calmer, connected teams
              </span>
            </h2>
          </div>

          <div className="flex bg-alabaster-100 p-1.5 rounded-full border border-alabaster-200">
            {[
              { id: 'ona', label: '01 • Anti-Silo ONA' },
              { id: 'focus', label: '02 • Maker Time' },
              { id: 'coaching', label: '03 • Private Nudges' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFeature(tab.id as typeof activeFeature)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition ${
                  activeFeature === tab.id
                    ? 'bg-volcanic-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-volcanic-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bento-card rounded-3xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {activeFeature === 'ona' && (
            <>
              <div className="lg:col-span-6 space-y-5">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-coral-700 bg-coral-50 px-3 py-1 rounded-full border border-coral-500/30">
                  <Users className="w-3.5 h-3.5 text-coral-500" />
                  Solving "Torn Apart" Teams
                </span>
                <h3 className="text-2xl font-semibold text-volcanic-900 tracking-tight">
                  Catch accidental peer exclusion before it erodes trust.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  When 4 out of 5 members of a squad attend a recurring architecture sync and 1 peer is inadvertently omitted, information silos form silently. ClarTeam computes squad overlap graphs and privately nudges the organizer to share 3-bullet async notes or add omitted teammates as Optional.
                </p>
                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('inclusion')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-volcanic-900 text-white text-xs font-medium hover:bg-volcanic-800 transition"
                  >
                    <span>Open Interactive ONA Constellation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 bg-alabaster-50 rounded-2xl p-6 border border-alabaster-200 space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                  <span>LIVE ONA EXCLUSION SIGNAL</span>
                  <span className="text-coral-600 font-semibold">
                    {ona.peer_exclusion_alerts.length} Active Alert(s)
                  </span>
                </div>
                {ona.peer_exclusion_alerts.slice(0, 2).map((alert) => (
                  <div
                    key={alert.alert_id}
                    className="bg-white rounded-2xl p-4 border border-alabaster-200 shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-volcanic-900">
                        {alert.squad} • {alert.meeting_category}
                      </span>
                      <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-coral-50 text-coral-700 border border-coral-500/30">
                        {alert.included_peer_count}/{alert.squad_size} peers invited
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      <strong className="text-volcanic-900">Private Tip:</strong> "{alert.recommended_action}"
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeFeature === 'focus' && (
            <>
              <div className="lg:col-span-6 space-y-5">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  Maker Time Protection
                </span>
                <h3 className="text-2xl font-semibold text-volcanic-900 tracking-tight">
                  Replace fragmented status bloat with uninterrupted deep work.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Scattered 30-minute syncs and 15-person recurring meetings without written agendas fracture engineering and product focus. ClarTeam flags high person-hour series so teams can convert routine status readouts into async documents.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('overview')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-volcanic-900 text-white text-xs font-medium hover:bg-volcanic-800 transition"
                  >
                    <span>Review Flagged Meeting Series</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 bg-alabaster-50 rounded-2xl p-6 border border-alabaster-200 space-y-3">
                <span className="font-mono text-xs text-slate-500 block">
                  HIGHEST PERSON-HOUR RECURRING SERIES
                </span>
                {diagnostics.slice(0, 2).map((d) => (
                  <div
                    key={d.meeting_id}
                    className="bg-white rounded-2xl p-4 border border-alabaster-200 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-volcanic-900">{d.title_category}</p>
                      <p className="text-xs text-slate-500">
                        {d.attendee_count} attendees • {d.duration_mins}m •{' '}
                        {d.has_agenda ? 'Has agenda' : 'No written agenda'}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold px-3 py-1 rounded-full bg-coral-50 text-coral-700 border border-coral-500/30 shrink-0">
                      {d.monthly_person_hours} hrs/mo
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeFeature === 'coaching' && (
            <>
              <div className="lg:col-span-6 space-y-5">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Two-Way Microsoft Teams & Slack Coaching
                </span>
                <h3 className="text-2xl font-semibold text-volcanic-900 tracking-tight">
                  Gentle, private coaching cards — zero vendor lock-in.
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Deliver actionable nudges directly via Microsoft Teams Adaptive Cards, Slack Block Kit, or standalone web links. Want to start today with zero IT permissions? Upload a standard `.ics` calendar export and `.csv` team roster in 10 seconds.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onEnterWorkspace('connections')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-volcanic-900 text-white text-xs font-medium hover:bg-volcanic-800 transition"
                  >
                    <span>Open Connections & Coaching Studio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 bg-alabaster-50 rounded-2xl p-6 border border-alabaster-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                  <span>PLUGGABLE DELIVERY CHANNELS</span>
                  <span className="text-emerald-700">Open Standard</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { title: 'Microsoft Teams', desc: 'Two-Way Adaptive Cards & Graph Sync' },
                    { title: 'Slack Block Kit', desc: 'Interactive 1-Click Pulse & Tips' },
                    { title: 'Universal CSV / .ICS', desc: 'Zero-IT Local Calendar Upload' },
                    { title: 'Generic Webhooks', desc: 'Mattermost, Matrix & Email Bridges' },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="bg-white rounded-xl p-3.5 border border-alabaster-200"
                    >
                      <p className="text-xs font-semibold text-volcanic-900">{item.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* =====================================================================
          PRIVACY MANIFESTO BENTO GRID
         ===================================================================== */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bento-card rounded-3xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-700">
            <EyeOff className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-volcanic-900">
            Zero Audio, Video, or Transcripts
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            ClarTeam never records conversations or reads private chat messages. Raw calendar descriptions are stripped on ingestion into boolean hygiene flags.
          </p>
        </div>

        <div className="bento-card rounded-3xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-volcanic-900 text-white flex items-center justify-center">
            <Lock className="w-5 h-5 text-emerald-400" />
          </div>
          <h3 className="text-base font-semibold text-volcanic-900">
            Strict k ≥ {overview.k_anonymity_threshold} Cohort Redaction
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Any department or team with fewer than {overview.k_anonymity_threshold} members is automatically redacted from leadership dashboards to prevent individual singling-out.
          </p>
        </div>

        <div className="bento-card rounded-3xl p-6 space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-coral-50 border border-coral-500/25 flex items-center justify-center text-coral-600">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-volcanic-900">
            Psychological Safety First
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Coaching tips go privately to the meeting organizer — never onto a public leaderboard. Teammates can request async notes anonymously via "Loop Me In".
          </p>
        </div>
      </section>

      {/* =====================================================================
          ANTIGRAVITY DARK OBSIDIAN LIFTOFF CTA BANNER
         ===================================================================== */}
      <section className="obsidian-surface rounded-[36px] px-8 py-14 sm:px-14 sm:py-16 text-white relative overflow-hidden">
        <div
          className="absolute -right-20 -bottom-20 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(16, 185, 129, 0.24) 0%, rgba(79, 70, 229, 0.12) 50%, transparent 75%)',
          }}
        />
        <div className="relative z-10 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 font-mono text-xs text-emerald-400">
            <CohereLogo className="w-6 h-6" size={24} />
            <span>OPEN SOURCE • SELF-HOSTABLE • PRIVACY-FIRST</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.1]">
            Ready to bring{' '}
            <span className="font-serif italic font-normal text-emerald-300">
              clarity & cohesion
            </span>{' '}
            to your team?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Explore the interactive workspace with realistic organizational datasets, submit an anonymous 10-second check-in, or test the two-way Microsoft Teams connector.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onEnterWorkspace('overview')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-slate-950 text-volcanic-950 hover:bg-slate-100 text-sm font-semibold transition shadow-sm"
            >
              <span>Open ClarTeam Workspace</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>
            <button
              type="button"
              onClick={() => onEnterWorkspace('checkin')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white border border-white/15 text-sm font-medium transition"
            >
              <MessageSquareHeart className="w-4 h-4 text-emerald-400" />
              <span>Try 10s Anonymous Check-in</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
