import React from 'react';
import { 
  LayoutGrid, Users, Activity, MapPin, 
  Zap, Eye, GitMerge, FileText, Settings, 
  ChevronRight, Radio, ShieldCheck, Building2
} from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab }) {
  const sections = [
    {
      heading: 'CLINICAL COMMAND',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutGrid },
        { id: 'capacity', label: 'Hospital Capacity', icon: Building2, badge: 'SURGE' },
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
    <aside className="w-64 bg-gradient-to-b from-[#14284b] via-[#1a3666] to-[#204482] text-white flex flex-col justify-between p-5 shrink-0 min-h-screen select-none shadow-2xl border-r border-blue-900/30">
      
      {/* Top Profile / Brand */}
      <div>
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-bold text-white shadow-inner">
              <span className="text-base font-semibold tracking-wider">KZ</span>
            </div>
            <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#14284b] absolute -bottom-0.5 -right-0.5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white m-0 tracking-tight">KSHITIJ EMR</h1>
            <p className="text-[11px] text-blue-200/80 m-0">Tactical Bio-Capsule OS</p>
          </div>
        </div>

        {/* Grouped Menu Navigation */}
        <nav className="space-y-4">
          {sections.map((sec, secIdx) => (
            <div key={secIdx} className="space-y-1">
              <div className="px-3 text-[10px] font-mono tracking-wider text-blue-300/60 font-semibold uppercase">
                {sec.heading}
              </div>

              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-950/40 font-bold'
                        : 'text-blue-100/75 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-200/70'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ${
                        isActive 
                          ? 'bg-white/20 text-white' 
                          : 'bg-white/10 text-blue-200/80'
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
      <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-between cursor-pointer hover:bg-white/15 transition-all mt-4">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
              FST
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#14284b] absolute -bottom-0.5 -right-0.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white leading-tight">Forward Surg Team</div>
            <div className="text-[10px] text-blue-200/75 leading-tight">Bangalore Focal HQ</div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-blue-200/60" />
      </div>

    </aside>
  );
}
