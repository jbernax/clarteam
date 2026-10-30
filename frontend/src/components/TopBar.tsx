import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  X,
  Network,
  Clock,
  MessageSquareHeart,
  Plug,
  Shield,
  Sparkles,
} from 'lucide-react';
import { CohereLogo } from './CohereLogo.tsx';

type WorkspaceTab = 'overview' | 'inclusion' | 'checkin' | 'connections';

interface TopBarProps {
  viewMode: 'landing' | 'workspace';
  activeTab: WorkspaceTab;
  peerExclusionCount: number;
  kAnonymityThreshold: number;
  currentSourceValue: string;
  onSelectViewMode: (mode: 'landing' | 'workspace') => void;
  onSelectTab: (tab: WorkspaceTab) => void;
  onDataSourceChange: (value: string) => void;
}

/**
 * Clean top navigation bar modeled directly after https://cohere.com/:
 * 1. Dismissible pure-black announcement bar with underlined link & 90° rotating close button
 * 2. Crisp 60px pure-white bar with left-aligned logo + kinetic vertical text-slide links
 * 3. Smooth expandable Platform Mega-Drawer with Cohere-style "NEW" cell badges & Featured card
 * 4. Right-aligned gradient-underline control + solid dark volcanic pill CTA button
 */
export function TopBar({
  viewMode,
  activeTab,
  peerExclusionCount,
  kAnonymityThreshold,
  currentSourceValue,
  onSelectViewMode,
  onSelectTab,
  onDataSourceChange,
}: TopBarProps) {
  const [showBanner, setShowBanner] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navigateToTab = (tab: WorkspaceTab) => {
    onSelectTab(tab);
    onSelectViewMode('workspace');
    setDrawerOpen(false);
  };

  return (
    <div
      className="sticky top-0 z-40"
      onMouseLeave={() => setDrawerOpen(false)}
    >
      {/* 1. Cohere.com Dismissible Pure-Black Top Announcement Banner */}
      {showBanner && (
        <div className="relative z-50 flex items-center justify-between overflow-hidden px-4 py-2.5 bg-[#0B0C0E] text-white text-xs">
          <div className="flex flex-1 flex-row flex-wrap items-center justify-center gap-2.5 px-3 text-center">
            <p className="text-[13px] font-normal text-white/95">
              ClarTeam 2.0 is here: split-squad ONA detection & two-way Microsoft Teams coaching — zero surveillance.
            </p>
            <button
              type="button"
              onClick={() => navigateToTab('inclusion')}
              className="border-b border-white text-[13px] font-medium text-white hover:opacity-80 transition-opacity"
            >
              Learn more
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowBanner(false)}
            aria-label="Close banner"
            className="p-1 text-white/80 hover:text-white transition-transform duration-300 hover:rotate-90"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Cohere.com 60px Pure-White Main Navigation Bar */}
      <nav
        role="navigation"
        aria-label="Primary Views"
        className="relative z-40 w-full bg-white border-b border-[#E5E3DC] transition-colors duration-300"
      >
        <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center">
          {/* Left: Brand Lockup (mr-10 shrink-0) */}
          <div className="relative mr-8 lg:mr-10 flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => {
                onSelectViewMode('landing');
                setDrawerOpen(false);
              }}
              className="flex items-center gap-2.5 group focus:outline-none"
            >
              <CohereLogo className="w-7 h-7 shrink-0 transition-transform duration-200 group-hover:scale-105" size={28} />
              <span className="font-semibold text-[18px] tracking-[-0.02em] text-[#141517]">
                clarteam
              </span>
            </button>
          </div>

          {/* Center-Left: Kinetic Slide-Up Navigation Items (Cohere.com signature) */}
          <ul className="flex list-none items-center gap-x-1 overflow-x-auto">
            {/* Platform Mega-Drawer Trigger */}
            <li className="hidden md:flex items-center">
              <button
                type="button"
                onMouseEnter={() => setDrawerOpen(true)}
                onClick={() => setDrawerOpen((prev) => !prev)}
                className={`group/listItem inline-flex items-center gap-x-1 rounded-full px-3.5 py-1.5 text-[14px] transition-colors duration-200 ${
                  drawerOpen || viewMode === 'landing'
                    ? 'text-[#141517] font-medium bg-[#F4F2EE]/70'
                    : 'text-[#141517]/80 hover:text-[#141517]'
                }`}
              >
                <span className="relative block overflow-hidden leading-[1.3]">
                  <span className="block transition-transform duration-300 ease-out group-hover/listItem:-translate-y-full">
                    Platform
                  </span>
                  <span
                    className="absolute inset-x-0 top-0 block transition-transform duration-300 ease-out translate-y-[110%] group-hover/listItem:translate-y-0"
                    aria-hidden="true"
                  >
                    Platform
                  </span>
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${
                    drawerOpen ? 'rotate-180 text-[#141517]' : ''
                  }`}
                />
              </button>
            </li>

            {/* Direct Workspace Tabs with Kinetic Vertical Text Roll */}
            {[
              { id: 'overview' as const, label: 'Overview' },
              {
                id: 'inclusion' as const,
                label: 'Inclusion',
                badge: peerExclusionCount,
              },
              { id: 'checkin' as const, label: 'Check-in' },
              { id: 'connections' as const, label: 'Connections' },
            ].map((item) => {
              const active = viewMode === 'workspace' && activeTab === item.id;
              return (
                <li key={item.id} className="flex items-center">
                  <button
                    type="button"
                    onMouseEnter={() => setDrawerOpen(false)}
                    onClick={() => navigateToTab(item.id)}
                    className={`group/listItem inline-flex items-center gap-x-1.5 rounded-full px-3.5 py-1.5 text-[14px] transition-colors duration-200 ${
                      active
                        ? 'bg-[#141517] text-white font-medium'
                        : 'text-[#141517]/85 hover:bg-[#F4F2EE]/80 hover:text-[#141517]'
                    }`}
                  >
                    <span className="relative block overflow-hidden leading-[1.3]">
                      <span className="block transition-transform duration-300 ease-out group-hover/listItem:-translate-y-full">
                        {item.label}
                      </span>
                      <span
                        className="absolute inset-x-0 top-0 block transition-transform duration-300 ease-out translate-y-[110%] group-hover/listItem:translate-y-0"
                        aria-hidden="true"
                      >
                        {item.label}
                      </span>
                    </span>

                    {item.badge ? (
                      <span
                        className={`px-1.5 py-0.2 rounded font-mono text-[10px] uppercase tracking-wider font-semibold tabular-nums ${
                          active
                            ? 'bg-[#FF6B4A] text-white'
                            : 'bg-[#141517] text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Right: Cohere Gradient-Underline Selector + Solid Dark Pill CTA */}
          <div className="ml-auto flex items-center gap-x-5 shrink-0">
            {/* Scenario Selector with Cohere's signature coral-violet-blue bottom gradient line on hover */}
            <div className="group relative inline-flex flex-col items-start">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                <select
                  aria-label="Data Source"
                  value={currentSourceValue}
                  onChange={(e) => onDataSourceChange(e.target.value)}
                  className="bg-transparent text-[13px] font-medium text-[#141517] py-1 pr-1 cursor-pointer focus:outline-none"
                >
                  <option value="default_mixed">Sample: Balanced Org</option>
                  <option value="exclusion_heavy">Sample: Siloed Teams</option>
                  <option value="overload_crisis">Sample: Meeting Overload</option>
                  <option value="ms_graph">Microsoft Teams Sync</option>
                </select>
              </div>
              <div className="relative w-full h-px overflow-hidden">
                <div
                  aria-hidden="true"
                  className="h-px w-0 group-hover:w-full transition-all duration-300 bg-gradient-to-r from-[#FF6B4A] via-[#8B5CF6] to-[#3B82F6]"
                />
              </div>
            </div>

            {/* Primary Solid Pill CTA (web3-primary-solid-btn from cohere.com) */}
            <button
              type="button"
              onClick={() => {
                if (viewMode === 'landing') {
                  onSelectViewMode('workspace');
                } else {
                  onSelectViewMode('landing');
                }
              }}
              className="whitespace-nowrap relative inline-flex items-center justify-center gap-1.5 bg-[#141517] hover:bg-[#26282C] text-white rounded-full h-9 px-4 text-[13px] font-medium transition-all duration-200"
            >
              <span>{viewMode === 'landing' ? 'Launch workspace' : 'Product overview'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3. Cohere.com Expandable Mega-Drawer */}
        <div
          className={`grid transition-[grid-template-rows] ease-in-out duration-300 ${
            drawerOpen ? 'grid-rows-[1fr] border-t border-[#E5E3DC]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden bg-white">
            <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row">
              {/* Column 1: Core Platform */}
              <div className="w-full lg:w-[270px] shrink-0 py-6 pr-6">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-4">
                  Platform
                </p>
                <ul className="space-y-4">
                  <li>
                    <button
                      type="button"
                      onClick={() => navigateToTab('overview')}
                      className="group/nav block text-left w-full"
                    >
                      <p className="text-[18px] font-medium text-[#141517] group-hover/nav:opacity-55 transition-opacity">
                        Culture Compass
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Wellbeing index, maker focus blocks & department matrix
                      </p>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => navigateToTab('inclusion')}
                      className="group/nav block text-left w-full"
                    >
                      <p className="text-[18px] font-medium text-[#141517] group-hover/nav:opacity-55 transition-opacity">
                        ONA Constellation
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Interactive graph detecting split-squad sync exclusion
                      </p>
                    </button>
                  </li>
                </ul>
              </div>

              {/* Column 2: Modules (with Cohere's signature "NEW" cell badge) */}
              <div className="w-full lg:w-[290px] shrink-0 py-6 px-0 lg:px-6 border-t lg:border-t-0 lg:border-l border-[#E5E3DC]">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-4">
                  Modules
                </p>
                <ul className="space-y-3.5">
                  <li>
                    <button
                      type="button"
                      onClick={() => navigateToTab('checkin')}
                      className="group/nav block text-left w-full"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-[#141517] group-hover/nav:opacity-55 transition-opacity">
                          10-Second Micro-Pulse
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Anonymous meeting usefulness ratings
                      </p>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => navigateToTab('inclusion')}
                      className="group/nav block text-left w-full"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-[#141517] group-hover/nav:opacity-55 transition-opacity">
                          Loop-Me-In Signals
                        </span>
                        <span className="bg-[#141517] text-white font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]">
                          New
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Request async notes without joining more meetings
                      </p>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => navigateToTab('connections')}
                      className="group/nav block text-left w-full"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-[#141517] group-hover/nav:opacity-55 transition-opacity">
                          Microsoft Teams & Graph
                        </span>
                        <span className="bg-[#141517] text-white font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]">
                          New
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Two-way Adaptive Cards & zero-IT CSV/.ICS import
                      </p>
                    </button>
                  </li>
                </ul>
              </div>

              {/* Column 3: Privacy Architecture */}
              <div className="w-full lg:w-[240px] shrink-0 py-6 px-0 lg:px-6 border-t lg:border-t-0 lg:border-l border-[#E5E3DC] flex flex-col justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-4">
                    Trust & Privacy
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-600">
                    <li className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Strict k ≥ {kAnonymityThreshold} cohort redaction</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Zero audio, video, or transcripts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Plug className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>MIT Open Source & self-hostable</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectViewMode('landing');
                    setDrawerOpen(false);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#141517] group/all"
                >
                  <span>Explore platform home</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/all:translate-x-1" />
                </button>
              </div>

              {/* Right Column: Cohere.com Featured Card on Warm Stone Backdrop */}
              <div className="hidden xl:flex flex-1 bg-[#F4F2EE] p-6 flex-col justify-between">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  Featured
                </p>
                <div className="my-3 rounded-xl bg-[#141517] text-white p-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
                    <span>ONA TOPOLOGY 2.0</span>
                    <span>{peerExclusionCount} ALERTS</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Visualize squad sync overlap and resolve accidental teammate exclusion with 1-click private Teams coaching cards.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToTab('inclusion')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#141517] group/feat"
                >
                  <span>Open ONA Squad Constellation</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/feat:translate-x-1" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
