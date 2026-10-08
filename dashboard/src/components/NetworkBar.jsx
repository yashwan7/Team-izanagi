import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, ShieldCheck, Wifi, WifiOff, Radio, 
  RefreshCw, AlertTriangle, Cpu, Hospital, Clock, Activity 
} from 'lucide-react';

export default function NetworkBar({ networkStatus, onSimulateNetwork, isOnline }) {
  const [loadingAction, setLoadingAction] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const state = networkStatus?.active_state || 'PORT_A_ACTIVE';
  const portA = networkStatus?.port_a || { latency_ms: 18, packet_loss_pct: 0, jitter_ms: 2.1 };
  const portB = networkStatus?.port_b || { latency_ms: 45, packet_loss_pct: 0.1, jitter_ms: 4.8 };
  const degradation = networkStatus?.degradation_score || 0.08;

  const handleSimulate = async (scenario) => {
    setLoadingAction(true);
    try {
      await onSimulateNetwork(scenario);
    } finally {
      setTimeout(() => setLoadingAction(false), 300);
    }
  };

  const getStateBadge = () => {
    switch (state) {
      case 'PORT_A_ACTIVE':
        return {
          label: 'PRIMARY LAN: PORT A ACTIVE',
          bg: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400',
          desc: 'High-speed hospital hospital network',
          icon: Wifi
        };
      case 'PORT_B_ACTIVE':
        return {
          label: 'SECONDARY PATH: PORT B ACTIVE',
          bg: 'bg-amber-950/40 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400',
          desc: 'Failover LTE/Satellite uplink engaged',
          icon: Radio
        };
      case 'MESH_ACTIVE':
        return {
          label: 'P2P MESH ACTIVE (DISASTER MODE)',
          bg: 'bg-purple-950/50 text-purple-300 border-purple-500/50 emergency-beacon-alert',
          dot: 'bg-purple-400',
          desc: 'Dual-link failure · Austere ad-hoc mesh',
          icon: Cpu
        };
      case 'STATE_WARNING':
        return {
          label: 'UPLINK DEGRADING (YELLOW ALERT)',
          bg: 'bg-yellow-950/50 text-yellow-300 border-yellow-500/50',
          dot: 'bg-yellow-400',
          desc: 'High jitter and packet loss detected',
          icon: AlertTriangle
        };
      default:
        return {
          label: state,
          bg: 'bg-slate-900 text-slate-300 border-slate-700',
          dot: 'bg-slate-400',
          desc: 'Operational',
          icon: Activity
        };
    }
  };

  const badge = getStateBadge();
  const StateIcon = badge.icon;

  return (
    <header className="w-full bg-[#0a1022] border-b border-[#1b284a] px-4 md:px-6 py-2.5 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        
        {/* Hospital Branding */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-600 to-cyan-700 flex items-center justify-center shadow-md shadow-sky-600/20 border border-sky-400/30">
            <Hospital className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-bold tracking-tight text-white m-0 flex items-center gap-1.5">
                KSHITIJ <span className="text-[11px] font-semibold text-sky-400 tracking-wider">HOSPITAL COMMAND CENTER</span>
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                SYSTEM OPERATIONAL
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Department of Emergency Medicine &bull; Trauma Triage & Patient Telemetry System
            </p>
          </div>
        </div>

        {/* Real-Time Link Telemetry & Clock */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Active Link Pill */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-md border text-xs font-semibold ${badge.bg}`}>
            <span className={`w-2 h-2 rounded-full ${badge.dot} animate-pulse`} />
            <StateIcon className="w-3.5 h-3.5" />
            <span>{badge.label}</span>
          </div>

          {/* Telemetry Strip */}
          <div className="hidden lg:flex items-center gap-3 bg-[#0d162e] px-3 py-1 rounded-md border border-[#1b284a] text-xs">
            <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3">
              <span className="text-slate-400">Port A:</span>
              <span className={`font-semibold font-mono ${portA.latency_ms > 200 ? 'text-rose-400' : 'text-slate-200'}`}>
                {portA.latency_ms.toFixed(0)} ms
              </span>
              <span className="text-[10px] text-slate-500 font-mono">({portA.packet_loss_pct.toFixed(1)}% loss)</span>
            </div>
            <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3">
              <span className="text-slate-400">Port B:</span>
              <span className="font-semibold font-mono text-slate-200">{portB.latency_ms.toFixed(0)} ms</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono text-slate-300">{currentTime || '12:00:00'}</span>
            </div>
          </div>
        </div>

        {/* Failover Simulation Buttons */}
        <div className="flex items-center gap-1.5 bg-[#0d162e] p-1 rounded-lg border border-[#1b284a]">
          <button
            onClick={() => handleSimulate('PORT_A_FAILURE')}
            disabled={loadingAction}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5 ${
              state === 'PORT_B_ACTIVE' 
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 font-semibold' 
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
            title="Simulate Port A link degradation triggering automatic failover to Port B"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Fail Port A</span>
          </button>

          <button
            onClick={() => handleSimulate('TOTAL_DISCONNECT')}
            disabled={loadingAction}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5 ${
              state === 'MESH_ACTIVE' 
                ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40 font-semibold' 
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
            title="Simulate dual link failure triggering P2P Mesh Mode"
          >
            <WifiOff className="w-3.5 h-3.5 text-purple-400" />
            <span>Trigger Mesh</span>
          </button>

          <button
            onClick={() => handleSimulate('RESTORE_HEALTHY')}
            disabled={loadingAction}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5 ${
              state === 'PORT_A_ACTIVE' 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
            title="Restore primary network link"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loadingAction ? 'animate-spin' : ''}`} />
            <span>Restore Link</span>
          </button>
        </div>

      </div>
    </header>
  );
}
