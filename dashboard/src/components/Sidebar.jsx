import React from 'react';
import { 
  LayoutGrid, Users, Activity, MapPin, 
  Zap, Eye, GitMerge, FileText, Settings, 
  ChevronRight, Radio, ShieldCheck, Building2, Pill, Droplet
} from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab }) {
  const sections = [
    {
      heading: 'CLINICAL COMMAND',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutGrid },
        { id: 'capacity', label: 'Hospital Capacity', icon: Building2, badge: 'SURGE' },
        { id: 'pharma', label: 'Pharmaceutical Network', icon: Pill, badge: 'RX' },
        { id: 'bloodbank', label: 'Blood Bank Network', icon: Droplet, badge: 'HEMO' },
        { id: 'patients', label: 'Patients', icon: Users },
        { id: 'triage', label: 'Triage Queue', icon: Activity, badge: 'AUTO' },
        { id: 'map', label: 'GPS Radar', icon: MapPin },
      ]
    },
    {
      heading: 'HARDWARE & TELEMETRY',
      items: [
        { id: 'failover', label: 'Failover & TinyML', icon: Zap, badge: '500ms' },
        { id: 'eog', label: 'EOG & Bio-Security', icon: Eye, badge: '100Hz' },
      ]
    },
    {
      heading: 'INTELLIGENCE & AUDIT',
      items: [
        { id: 'timeline', label: 'Audit Timeline', icon: GitMerge },
        { id: 'reports', label: 'AI Reports', icon: FileText, badge: 'LLM' },
        { id: 'settings', label: 'Settings & Lab', icon: Settings },
      ]
    }
  ];

  return (
    <aside className="sidebar-tactical w-64 bg-[#0a0d14] text-white flex flex-col justify-between p-5 shrink-0 min-h-screen max-h-screen overflow-y-auto sticky top-0 select-none border-r border-[#1a1f2c] shadow-2xl">
      
      {/* Top Profile / Brand */}
      <div>
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="relative">
            <div className="w-10 h-10 rounded-none bg-[#121622] border border-[#2a3245] flex items-center justify-center font-bold text-white shadow-inner">
              <span className="text-sm font-mono tracking-wider font-bold text-red-500">KZ</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-none bg-red-600 border border-[#0a0d14] absolute -bottom-0.5 -right-0.5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white m-0 tracking-tight font-sans">KSHITIJ EMR</h1>
            <p className="text-[10px] text-[#8c96a5] m-0 font-mono tracking-wide">TACTICAL COMMAND OS</p>
          </div>
        </div>

        {/* Grouped Menu Navigation */}
        <nav className="space-y-4">
          {sections.map((sec, secIdx) => (
            <div key={secIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-mono tracking-wider text-[#6b7280] font-bold uppercase">
                {sec.heading}
              </div>

              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`sidebar-nav-item w-full flex items-center justify-between px-3.5 py-2.5 rounded-none text-xs font-semibold transition-all duration-200 border-l-[3px] ${
                      isActive
                        ? 'bg-[#181d28] text-white border-l-[#dc2626] font-bold shadow-sm'
                        : 'text-[#9ca3af] border-l-transparent hover:bg-[#141822] hover:border-l-[#ef4444] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 transition-colors duration-200 ${isActive ? 'text-red-500' : 'text-[#6b7280]'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-none border ${
                        isActive 
                          ? 'bg-red-950/60 text-red-400 border-red-800/80 font-bold' 
                          : 'bg-[#181d28] text-[#8c96a5] border-[#2a3245]'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Tactical Officer Card */}
      <div className="p-3 rounded-none bg-[#121622] border border-[#222a3a] flex items-center justify-between cursor-pointer hover:bg-[#181d28] hover:border-l-[3px] hover:border-l-[#ef4444] transition-all duration-200 mt-4">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-none bg-[#1c2230] border border-[#2a3245] flex items-center justify-center text-xs font-mono font-bold text-red-400 shadow-sm">
              FST
            </div>
            <span className="w-2 h-2 rounded-none bg-red-600 border border-[#0a0d14] absolute -bottom-0.5 -right-0.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white leading-tight">Forward Surg Team</div>
            <div className="text-[10px] text-[#8c96a5] leading-tight font-mono">Bangalore Focal HQ</div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#6b7280]" />
      </div>

    </aside>
  );
}
