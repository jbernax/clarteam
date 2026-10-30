import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Network, Sparkles, Users } from 'lucide-react';
import type { OnaInsightsResponse, OnaGraphNode } from '../types';

interface OnaNetworkGraphProps {
  ona: OnaInsightsResponse;
}

interface PositionedNode extends OnaGraphNode {
  x: number;
  y: number;
}

interface SquadClusterCenter {
  squad: string;
  cx: number;
  cy: number;
  memberCount: number;
  isolatedCount: number;
}

export function OnaNetworkGraph({ ona }: OnaNetworkGraphProps) {
  const [selectedSquad, setSelectedSquad] = useState<string>('ALL');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const squads = useMemo(() => {
    const unique = Array.from(new Set(ona.nodes.map((n) => n.squad)));
    return unique;
  }, [ona.nodes]);

  // Deterministic orbital layout for squad clusters and member nodes
  const { positionedNodes, clusterCenters, nodeMap } = useMemo(() => {
    const width = 820;
    const height = 420;
    const centerX = width / 2;
    const centerY = height / 2;

    const filteredSquads = selectedSquad === 'ALL' ? squads : squads.filter((s) => s === selectedSquad);
    const numSquads = Math.max(1, filteredSquads.length);

    const centers: SquadClusterCenter[] = [];
    const posNodes: PositionedNode[] = [];
    const map = new Map<string, PositionedNode>();

    filteredSquads.forEach((squadName, sIdx) => {
      const members = ona.nodes.filter((n) => n.squad === squadName);
      const isolatedCount = members.filter((m) => m.is_isolated_risk).length;

      // Position squad center
      let cx = centerX;
      let cy = centerY;
      if (numSquads === 2) {
        cx = sIdx === 0 ? width * 0.3 : width * 0.7;
        cy = centerY;
      } else if (numSquads > 2) {
        const angle = (2 * Math.PI * sIdx) / numSquads - Math.PI / 2;
        const rx = width * 0.31;
        const ry = height * 0.28;
        cx = centerX + Math.cos(angle) * rx;
        cy = centerY + Math.sin(angle) * ry;
      }

      centers.push({
        squad: squadName,
        cx,
        cy,
        memberCount: members.length,
        isolatedCount,
      });

      const localRadius = numSquads === 1 ? 115 : Math.min(72, Math.max(46, members.length * 11));
      members.forEach((member, mIdx) => {
        const memberAngle = (2 * Math.PI * mIdx) / Math.max(1, members.length) - Math.PI / 4;
        // Slightly push isolated members outward to visually show the split-squad gap
        const distMultiplier = member.is_isolated_risk ? 1.24 : 0.88;
        const x = cx + Math.cos(memberAngle) * localRadius * distMultiplier;
        const y = cy + Math.sin(memberAngle) * localRadius * distMultiplier;
        const pNode: PositionedNode = { ...member, x, y };
        posNodes.push(pNode);
        map.set(member.id, pNode);
      });
    });

    return { positionedNodes: posNodes, clusterCenters: centers, nodeMap: map };
  }, [ona.nodes, squads, selectedSquad]);

  const visibleEdges = useMemo(() => {
    return ona.edges.filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target));
  }, [ona.edges, nodeMap]);

  const activeNode = useMemo(() => {
    if (activeNodeId && nodeMap.has(activeNodeId)) {
      return nodeMap.get(activeNodeId)!;
    }
    const firstIsolated = positionedNodes.find((n) => n.is_isolated_risk);
    return firstIsolated || positionedNodes[0] || null;
  }, [activeNodeId, nodeMap, positionedNodes]);

  const activeNodeConnections = useMemo(() => {
    if (!activeNode) return [];
    return visibleEdges
      .filter((e) => e.source === activeNode.id || e.target === activeNode.id)
      .map((e) => {
        const peerId = e.source === activeNode.id ? e.target : e.source;
        return {
          peer: nodeMap.get(peerId),
          sharedMeetings: e.shared_meetings_per_month,
          sameSquad: e.same_squad,
        };
      })
      .filter((item) => Boolean(item.peer));
  }, [activeNode, visibleEdges, nodeMap]);

  return (
    <div className="bento-card rounded-3xl overflow-hidden">
      {/* Top Bar */}
      <div className="px-6 py-5 border-b border-alabaster-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/70">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-emerald-800 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              <Network className="w-3 h-3 text-emerald-600" />
              ONA Topology Engine
            </span>
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              Cohesion Index: <strong className="text-volcanic-900">{ona.network_cohesion_score}/100</strong>
            </span>
          </div>
          <h2 className="text-lg font-semibold text-volcanic-900 tracking-tight">
            Squad Sync Constellation & Split-Team Detection
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl">
            {ona.silo_risk_summary}
          </p>
        </div>

        {/* Squad Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-alabaster-100 p-1.5 rounded-2xl border border-alabaster-200">
          <button
            type="button"
            onClick={() => setSelectedSquad('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              selectedSquad === 'ALL'
                ? 'bg-volcanic-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-volcanic-900'
            }`}
          >
            All Squads ({ona.nodes.length})
          </button>
          {squads.map((sq) => {
            const hasRisk = ona.nodes.some((n) => n.squad === sq && n.is_isolated_risk);
            const active = selectedSquad === sq;
            return (
              <button
                type="button"
                key={sq}
                onClick={() => setSelectedSquad(sq)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  active
                    ? 'bg-volcanic-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-volcanic-900'
                }`}
              >
                <span>{sq}</span>
                {hasRisk && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      active ? 'bg-coral-500' : 'bg-coral-500'
                    }`}
                    title="Split-squad exclusion detected"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Canvas + Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-alabaster-200">
        {/* Left 8 cols: Interactive SVG Topology */}
        <div className="lg:col-span-8 relative bg-[#121316] text-white p-4 sm:p-6 flex flex-col justify-between min-h-[380px]">
          {/* Subtle Obsidian Dot Grid */}
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at center, rgba(255,255,255,0.22) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Top Canvas Legend */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-300">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                Included in Squad Syncs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-coral-500 ring-4 ring-coral-500/25 inline-block" />
                Omitted Peer (Split Sync Risk)
              </span>
            </div>
            <span className="text-slate-400">Click any node to inspect connections</span>
          </div>

          {/* SVG Graph */}
          <div className="relative z-10 my-auto w-full overflow-hidden">
            <svg
              viewBox="0 0 820 420"
              className="w-full h-auto max-h-[360px] select-none"
              role="img"
              aria-label="Organizational Network Analysis Squad Graph"
            >
              <defs>
                <radialGradient id="cluster-aura-safe" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="cluster-aura-risk" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FF6B4A" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#FF6B4A" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Squad Orbital Halos */}
              {clusterCenters.map((cluster) => (
                <g key={cluster.squad}>
                  <circle
                    cx={cluster.cx}
                    cy={cluster.cy}
                    r={selectedSquad === 'ALL' ? 92 : 145}
                    fill={
                      cluster.isolatedCount > 0
                        ? 'url(#cluster-aura-risk)'
                        : 'url(#cluster-aura-safe)'
                    }
                  />
                  <circle
                    cx={cluster.cx}
                    cy={cluster.cy}
                    r={selectedSquad === 'ALL' ? 76 : 125}
                    fill="none"
                    stroke={cluster.isolatedCount > 0 ? 'rgba(255, 107, 74, 0.22)' : 'rgba(16, 185, 129, 0.18)'}
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={cluster.cx}
                    y={cluster.cy - (selectedSquad === 'ALL' ? 82 : 132)}
                    textAnchor="middle"
                    className="fill-slate-300 font-mono text-[10px] uppercase tracking-wider"
                  >
                    {cluster.squad}
                  </text>
                </g>
              ))}

              {/* Meeting Edges */}
              {visibleEdges.map((edge, idx) => {
                const s = nodeMap.get(edge.source);
                const t = nodeMap.get(edge.target);
                if (!s || !t) return null;

                const isHighlighted =
                  activeNode && (edge.source === activeNode.id || edge.target === activeNode.id);
                const strokeWidth = Math.min(3.5, Math.max(1.2, edge.shared_meetings_per_month / 3));

                return (
                  <line
                    key={`${edge.source}-${edge.target}-${idx}`}
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={
                      isHighlighted
                        ? '#34D399'
                        : edge.same_squad
                        ? 'rgba(148, 163, 184, 0.35)'
                        : 'rgba(99, 102, 241, 0.28)'
                    }
                    strokeWidth={isHighlighted ? strokeWidth + 0.8 : strokeWidth}
                    strokeDasharray={edge.same_squad ? undefined : '3 3'}
                  />
                );
              })}

              {/* Teammate Nodes */}
              {positionedNodes.map((node) => {
                const isSelected = activeNode?.id === node.id;
                const isRisk = node.is_isolated_risk;
                const initials = node.label
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setActiveNodeId(node.id)}
                    className="cursor-pointer group"
                  >
                    {/* Pulsing Halo for Omitted Teammates */}
                    {isRisk && (
                      <circle
                        r="21"
                        fill="rgba(255, 107, 74, 0.18)"
                        stroke="#FF6B4A"
                        strokeWidth="1.2"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Selection Ring */}
                    {isSelected && (
                      <circle
                        r="18"
                        fill="none"
                        stroke={isRisk ? '#FF6B4A' : '#34D399'}
                        strokeWidth="2"
                      />
                    )}

                    {/* Node Core */}
                    <circle
                      r="13"
                      fill={isRisk ? '#FF6B4A' : '#10B981'}
                      stroke="#121316"
                      strokeWidth="2.5"
                    />

                    {/* Initials */}
                    <text
                      y="3.5"
                      textAnchor="middle"
                      className="fill-volcanic-950 font-mono text-[9px] font-bold pointer-events-none"
                    >
                      {initials}
                    </text>

                    {/* Name Label */}
                    <g transform="translate(0, 25)">
                      <rect
                        x="-42"
                        y="-9"
                        width="84"
                        height="15"
                        rx="4"
                        fill="rgba(18, 19, 22, 0.86)"
                      />
                      <text
                        y="1.5"
                        textAnchor="middle"
                        className={`text-[9.5px] font-medium ${
                          isRisk ? 'fill-coral-100' : 'fill-slate-200'
                        }`}
                      >
                        {node.label.split(' ')[0]} {node.label.split(' ')[1]?.[0]}.
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Bottom Footnote */}
          <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/10 pt-3">
            <span>Privacy-safe graph computed from recurring calendar invite headers only</span>
            <span className="font-mono text-emerald-400 tabular-nums">
              {visibleEdges.length} active collaboration links
            </span>
          </div>
        </div>

        {/* Right 4 cols: Node Context Inspector */}
        <div className="lg:col-span-4 p-6 bg-white/90 flex flex-col justify-between space-y-6">
          {activeNode ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    Selected Teammate Node
                  </span>
                  <h3 className="text-lg font-semibold text-volcanic-900 mt-0.5">
                    {activeNode.label}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeNode.role} • {activeNode.squad}
                  </p>
                </div>
                {activeNode.is_isolated_risk ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-coral-50 text-coral-700 border border-coral-500/30">
                    <AlertCircle className="w-3.5 h-3.5 text-coral-500" />
                    Missed Sync
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    In Loop
                  </span>
                )}
              </div>

              {/* Telemetry Mini Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-alabaster-50 border border-alabaster-200">
                  <span className="text-[11px] text-slate-500 block">Weekly Sync Load</span>
                  <span className="text-base font-semibold font-mono text-volcanic-900 tabular-nums">
                    {activeNode.meeting_load_hrs} hrs/wk
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-alabaster-50 border border-alabaster-200">
                  <span className="text-[11px] text-slate-500 block">Recurring Links</span>
                  <span className="text-base font-semibold font-mono text-volcanic-900 tabular-nums">
                    {activeNodeConnections.length} peers
                  </span>
                </div>
              </div>

              {/* Risk Explanation or Healthy Status */}
              {activeNode.is_isolated_risk ? (
                <div className="p-4 rounded-2xl bg-coral-50/80 border border-coral-500/25 space-y-1.5">
                  <p className="text-xs font-semibold text-coral-700">
                    Structural Split-Squad Pattern Detected
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Most peers in <strong>{activeNode.squad}</strong> attend a recurring sync where{' '}
                    <strong>{activeNode.label}</strong> is omitted. Sharing written async notes or adding them as Optional restores shared context without meeting bloat.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 space-y-1">
                  <p className="text-xs font-semibold text-emerald-900">
                    Strong Squad Inclusion
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Connected to recurring squad rituals alongside immediate teammates in {activeNode.squad}.
                  </p>
                </div>
              )}

              {/* Connected Peers List */}
              <div className="space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block">
                  Shared Recurring Sync Peers ({activeNodeConnections.length})
                </span>
                {activeNodeConnections.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    No recurring meeting links in current view — high risk of information silos.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {activeNodeConnections.map(({ peer, sharedMeetings }, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => peer && setActiveNodeId(peer.id)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-alabaster-50 hover:bg-alabaster-100 border border-alabaster-200 text-xs transition"
                      >
                        <div className="flex items-center gap-2 text-left">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-volcanic-900">{peer?.label}</span>
                        </div>
                        <span className="font-mono text-[11px] text-emerald-700 tabular-nums">
                          {sharedMeetings}/mo
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="pt-3 border-t border-alabaster-200 flex items-center gap-2 text-[11px] text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Powered by NetworkX graph centrality & squad overlap analysis</span>
          </div>
        </div>
      </div>
    </div>
  );
}
