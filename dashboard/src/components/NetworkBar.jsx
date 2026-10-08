import React, { useState } from 'react';
import { Activity, Radio, Wifi, WifiOff, ShieldCheck, RefreshCw, AlertTriangle, Cpu } from 'lucide-react';

export default function NetworkBar({ networkStatus, onSimulateNetwork, isOnline }) {
  const [loadingAction, setLoadingAction] = useState(false);

  const state = networkStatus?.active_state || 'PORT_A_ACTIVE';
  const portA = networkStatus?.port_a || { latency_ms: 18, jitter_ms: 2, packet_loss_pct: 0, dns_time_ms: 12 };
  const portB = networkStatus?.port_b || { latency_ms: 45, jitter_ms: 5, packet_loss_pct: 0.1, dns_time_ms: 28 };
  const degradation = networkStatus?.degradation_score || 0.08;

  const handleSimulate = async (scenario) => {
    setLoadingAction(true);
    try {
      await onSimulateNetwork(scenario);
    } finally {
      setTimeout(() => setLoadingAction(false), 300);
    }
  };

  // Badge configuration based on active_state
  const getStateBadge = () => {
    switch (state) {
      case 'PORT_A_ACTIVE':
        return {
          label: 'PORT A ACTIVE (PRIMARY)',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400',
          icon: Wifi
        };
      case 'PORT_B_ACTIVE':
        return {
          label: 'PORT B FAILOVER (BACKUP LTE/SAT)',
          bg: 'bg-amber-500/15 text-amber-300 border-amber-500/40 pulse-warning',
          dot: 'bg-amber-400',
          icon: Radio
        };
      case 'MESH_ACTIVE':
        return {
          label: 'MESH MODE ACTIVE (P2P RELAY)',
          bg: 'bg-purple-500/15 text-purple-300 border-purple-500/40 radar-alert',
          dot: 'bg-purple-400',
          icon: Cpu
        };
      case 'STATE_WARNING':
        return {
          label: 'STATE WARNING (DEGRADING)',
          bg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
          dot: 'bg-yellow-400',
          icon: AlertTriangle
        };
      default:
        return {
          label: state,
          bg: 'bg-slate-800 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
          icon: Activity
        };
    }
  };

  const badge = getStateBadge();
  const StateIcon = badge.icon;

  return (
    <header className="w-full bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-xl px-4 py-3 sticky top-0 z-50 shadow-2xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        
        {/* Brand & Stack Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
            <Activity className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white m-0 flex items-center gap-1.5">
                KSHITIJ <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-mono font-medium">MISSION CONTROL</span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Austere Clinical Triage &bull; Offline Delta Merge &bull; Dual-Port Failover
            </p>
          </div>
        </div>

        {/* Live Link Health Indicators */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Active State Pill */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold ${badge.bg}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${badge.dot} animate-ping`} />
            <StateIcon className="w-4 h-4" />
            <span>{badge.label}</span>
          </div>

          {/* Telemetry Quick Gauges */}
          <div className="hidden lg:flex items-center gap-3 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-xs">
            <div className="flex items-center gap-2 border-r border-slate-800 pr-3">
              <span className="text-slate-400">Port A:</span>
              <span className={`font-semibold ${portA.latency_ms > 200 ? 'text-rose-400' : 'text-slate-200'}`}>
                {portA.latency_ms.toFixed(0)}ms
              </span>
              <span className={`text-[10px] ${portA.packet_loss_pct > 5 ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
                ({portA.packet_loss_pct.toFixed(1)}% loss)
              </span>
            </div>
            <div className="flex items-center gap-2 border-r border-slate-800 pr-3">
              <span className="text-slate-400">Port B:</span>
              <span className="font-semibold text-slate-200">{portB.latency_ms.toFixed(0)}ms</span>
              <span className="text-[10px] text-slate-500">({portB.packet_loss_pct.toFixed(1)}% loss)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Degradation:</span>
              <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div 
                  className={`h-full transition-all duration-500 ${
                    degradation > 0.8 ? 'bg-rose-500' : degradation > 0.5 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(degradation * 100, 100)}%` }}
                />
              </div>
              <span className="text-slate-300 font-bold">{(degradation * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Network Simulation Controller Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => handleSimulate('PORT_A_FAILURE')}
              disabled={loadingAction}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 ${
                state === 'PORT_B_ACTIVE' 
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="Simulates Port A link degradation triggering automatic failover to Port B"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Port A Fail</span>
            </button>

            <button
              onClick={() => handleSimulate('TOTAL_DISCONNECT')}
              disabled={loadingAction}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 ${
                state === 'MESH_ACTIVE' 
                  ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="Simulates dual-port link collapse triggering P2P Mesh Mode"
            >
              <WifiOff className="w-3.5 h-3.5 text-purple-400" />
              <span>Trigger Mesh</span>
            </button>

            <button
              onClick={() => handleSimulate('RESTORE_HEALTHY')}
              disabled={loadingAction}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-all flex items-center gap-1.5 ${
                state === 'PORT_A_ACTIVE' 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="Restore healthy link metrics to primary Port A"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loadingAction ? 'animate-spin' : ''}`} />
              <span>Restore Link</span>
            </button>
          </div>
        </div>

      </div>
    </header>
  );
}
