import React, { useState } from 'react';
import { 
  Search, Wifi, WifiOff, Radio, AlertTriangle, 
  RefreshCw, Cpu, Activity, Clock 
} from 'lucide-react';

export default function NetworkBar({ networkStatus, onSimulateNetwork, isOnline, mqttStatus }) {
  const [loadingAction, setLoadingAction] = useState(false);

  const state = networkStatus?.active_state || 'PORT_A_ACTIVE';
  const portA = networkStatus?.port_a || { latency_ms: 18, packet_loss_pct: 0 };
  const portB = networkStatus?.port_b || { latency_ms: 45, packet_loss_pct: 0.1 };

  const handleSimulate = async (scenario) => {
    setLoadingAction(true);
    try {
      await onSimulateNetwork(scenario);
    } finally {
      setTimeout(() => setLoadingAction(false), 300);
    }
  };

  const getStateConfig = () => {
    switch (state) {
      case 'PORT_A_ACTIVE':
        return {
          label: 'Port A Active (LAN)',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          dot: 'bg-emerald-500',
          icon: Wifi
        };
      case 'PORT_B_ACTIVE':
        return {
          label: 'Port B Active (Failover LTE)',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          icon: Radio
        };
      case 'MESH_ACTIVE':
        return {
          label: 'Mesh Active (P2P Relay)',
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
          dot: 'bg-purple-500',
          icon: Cpu
        };
      default:
        return {
          label: state,
          badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-500',
          icon: Activity
        };
    }
  };

  const config = getStateConfig();
  const StateIcon = config.icon;

  return (
    <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      
      {/* Header Title */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2 m-0">
          Emergency Telemetry
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 m-0">
          Kshitij Clinical Command
        </p>
      </div>

      {/* Center Search Pill & Network Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        
        {/* Modern Pill Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patients, vitals..."
            className="w-full bg-white text-xs text-slate-700 placeholder-slate-400 rounded-full pl-9 pr-4 py-2.5 border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* MQTT Status Pill */}
        {mqttStatus && (
          <div className={`status-pill flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm transition-all ${
            mqttStatus === 'Connected' 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : mqttStatus === 'Connecting...' || mqttStatus === 'Reconnecting...'
              ? 'bg-amber-50 text-amber-700 border-amber-200' 
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              mqttStatus === 'Connected' ? 'bg-emerald-500 animate-ping' :
              mqttStatus === 'Connecting...' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
            }`} style={{ animationDuration: '2s' }} />
            <Radio className="w-3.5 h-3.5 text-current" />
            <span>MQTT: {mqttStatus}</span>
          </div>
        )}

        {/* Network State Pill Badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm ${config.badgeClass}`}>
          <span className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
          <StateIcon className="w-3.5 h-3.5" />
          <span>{config.label}</span>
        </div>

        {/* Failover Simulation Buttons in a Clean White Pill */}
        <div className="flex items-center bg-white p-1 rounded-full border border-slate-200/80 shadow-sm text-xs">
          <button
            onClick={() => handleSimulate('PORT_A_FAILURE')}
            disabled={loadingAction}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
              state === 'PORT_B_ACTIVE' 
                ? 'bg-amber-100 text-amber-800 font-semibold' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Simulate Port A degradation triggering failover to Port B"
          >
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span>Failover</span>
          </button>

          <button
            onClick={() => handleSimulate('TOTAL_DISCONNECT')}
            disabled={loadingAction}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
              state === 'MESH_ACTIVE' 
                ? 'bg-purple-100 text-purple-800 font-semibold' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Simulate dual link failure triggering P2P Mesh Mode"
          >
            <WifiOff className="w-3 h-3 text-purple-500" />
            <span>Mesh</span>
          </button>

          <button
            onClick={() => handleSimulate('RESTORE_HEALTHY')}
            disabled={loadingAction}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
              state === 'PORT_A_ACTIVE' 
                ? 'bg-emerald-100 text-emerald-800 font-semibold' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Restore healthy link metrics to Port A"
          >
            <RefreshCw className={`w-3 h-3 text-emerald-500 ${loadingAction ? 'animate-spin' : ''}`} />
            <span>Restore</span>
          </button>
        </div>

      </div>

    </div>
  );
}
