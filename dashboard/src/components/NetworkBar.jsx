import React, { useState } from 'react';
import { 
  Search, Wifi, WifiOff, Radio, AlertTriangle, 
  RefreshCw, Cpu, Activity
} from 'lucide-react';

export default function NetworkBar({ networkStatus, onSimulateNetwork, isOnline: _isOnline }) {
  const [loadingAction, setLoadingAction] = useState(false);

  const state = networkStatus?.active_state || 'PORT_A_ACTIVE';

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
          label: 'PORT A PRIMARY (LAN)',
          badgeClass: 'nm-badge text-[#2D6A4F] border border-[#52B788]/40',
          dot: 'bg-[#52B788]',
          icon: Wifi
        };
      case 'PORT_B_ACTIVE':
        return {
          label: 'PORT B FAILOVER (LTE)',
          badgeClass: 'nm-alert-inset text-[#C84B31] border border-[#C84B31]/30',
          dot: 'bg-[#C84B31]',
          icon: Radio
        };
      case 'MESH_ACTIVE':
        return {
          label: 'P2P MESH RELAY',
          badgeClass: 'nm-alert-inset text-[#C84B31] border border-[#C84B31]/40',
          dot: 'bg-[#C84B31]',
          icon: Cpu
        };
      default:
        return {
          label: state,
          badgeClass: 'nm-inset text-[#556455]',
          dot: 'bg-[#758475]',
          icon: Activity
        };
    }
  };

  const config = getStateConfig();
  const StateIcon = config.icon;

  return (
    <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 border-b border-[#D8D0C0] pb-4">
      
      {/* Header Title */}
      <div>
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#52B788] shadow-[0_0_8px_rgba(82,183,136,0.8)]" />
          <h2 className="text-base md:text-lg font-black text-[#1A241C] tracking-wider uppercase font-mono m-0">
            EMERGENCY CLINICAL TELEMETRY
          </h2>
        </div>
        <p className="text-[11px] text-[#556455] font-mono mt-0.5 m-0 font-medium">
          KSHITIJ TACTICAL COMMAND &bull; DUAL-PORT REDUNDANCY
        </p>
      </div>

      {/* Center Search & Network Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        
        {/* Tactical Neumorphic Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#758475] absolute left-3.5 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="SEARCH CASUALTY / TAC ID..."
            className="w-full nm-inset rounded-xl text-xs font-mono text-[#1A241C] placeholder-[#758475] pl-9 pr-3.5 py-2 border-none focus:outline-none focus:ring-1 focus:ring-[#52B788]/60 transition-all"
          />
        </div>

        {/* Network State Badge */}
        <div className="flex items-center gap-2 px-3 py-2 nm-flat rounded-xl text-xs font-mono font-bold border border-white/80">
          <span className="w-2 h-2 rounded-full bg-[#52B788] shadow-[0_0_6px_rgba(82,183,136,0.8)] animate-pulse" />
          <StateIcon className="w-4 h-4 text-[#2D6A4F]" />
          <span className="text-[#1A241C]">{config.label}</span>
        </div>

        {/* Failover Simulation Tactical Controls */}
        <div className="flex items-center nm-inset p-1 rounded-xl text-xs font-mono gap-1">
          <button
            onClick={() => handleSimulate('PORT_A_FAILURE')}
            disabled={loadingAction}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              state === 'PORT_B_ACTIVE' 
                ? 'nm-alert-inset text-[#C84B31] border border-[#C84B31]/40' 
                : 'nm-btn text-[#556455] hover:text-[#C84B31]'
            }`}
            title="Simulate Port A degradation triggering failover to Port B"
          >
            <AlertTriangle className="w-3 h-3 text-[#C84B31]" />
            <span>FAILOVER</span>
          </button>

          <button
            onClick={() => handleSimulate('TOTAL_DISCONNECT')}
            disabled={loadingAction}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              state === 'MESH_ACTIVE' 
                ? 'nm-alert-inset text-[#C84B31] border border-[#C84B31]/40' 
                : 'nm-btn text-[#556455] hover:text-[#C84B31]'
            }`}
            title="Simulate dual link failure triggering P2P Mesh Mode"
          >
            <WifiOff className="w-3 h-3 text-[#C84B31]" />
            <span>MESH</span>
          </button>

          <button
            onClick={() => handleSimulate('RESTORE_HEALTHY')}
            disabled={loadingAction}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              state === 'PORT_A_ACTIVE' 
                ? 'nm-btn text-[#2D6A4F]' 
                : 'nm-btn text-[#556455] hover:text-[#2D6A4F]'
            }`}
            title="Restore healthy link metrics to Port A"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#2D6A4F] ${loadingAction ? 'animate-spin' : ''}`} />
            <span>RESTORE</span>
          </button>
        </div>

      </div>

    </div>
  );
}
