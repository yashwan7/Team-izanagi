import React from 'react';
import { 
  LayoutGrid, Users, Activity, MapPin, 
  Zap, Eye, GitMerge, FileText, Settings, 
  ChevronRight, Building2, Droplet, Pill, Database
} from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab }) {
  const sections = [
    {
      heading: 'CLINICAL COMMAND',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutGrid },
        { id: 'capacity', label: 'Hospital Capacity', icon: Building2, badge: 'SURGE' },
        { id: 'bloodbank', label: 'Blood Bank Network', icon: Droplet, badge: 'HEMO' },
        { id: 'patients', label: 'Patients', icon: Users },
        { id: 'pharmacy', label: 'Pharmacy', icon: Pill, badge: 'RX' },
        { id: 'triage', label: 'Triage Queue', icon: Activity, badge: 'AUTO' },
        { id: 'map', label: 'GPS Radar', icon: MapPin },
      ]
    },
    {
      heading: 'HARDWARE & TELEMETRY',
      items: [
        { id: 'failover', label: 'Failover & TinyML', icon: Zap, badge: '500ms' },
        { id: 'eog', label: 'EOG & Bio-Security', icon: Eye, badge: '100Hz' },
        { id: 'cdc', label: 'CDC Parquet Telemetry', icon: Database, badge: 'PARQUET' },
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
    <aside className="w-64 bg-[#EAE4D8] text-[#1A241C] flex flex-col justify-between p-4 shrink-0 min-h-screen max-h-screen overflow-y-auto sticky top-0 select-none border-r border-[#D8D0C0] shadow-[4px_0_20px_rgba(180,170,150,0.3)]">
      
      {/* Top Profile / Brand */}
      <div>
        <div className="flex items-center gap-3 mb-6 px-3 py-2.5 nm-flat rounded-2xl border border-white/80">
          <div className="relative">
            <div className="w-10 h-10 nm-convex rounded-xl flex items-center justify-center font-bold text-[#1A241C]">
              <span className="text-xs font-mono font-black tracking-wider text-[#2D6A4F]">KZ</span>
            </div>
            <span className="w-2.5 h-2.5 bg-[#52B788] rounded-full absolute -bottom-0.5 -right-0.5 shadow-[0_0_8px_rgba(82,183,136,0.8)]" />
          </div>
          <div>
            <h1 className="text-xs font-black text-[#1A241C] m-0 tracking-widest uppercase font-mono">KSHITIJ EMR</h1>
            <p className="text-[10px] text-[#556455] m-0 font-mono tracking-tight font-medium">TACTICAL BIO-CAPSULE OS</p>
          </div>
        </div>

        {/* Grouped Menu Navigation */}
        <nav className="space-y-5">
          {sections.map((sec, secIdx) => (
            <div key={secIdx} className="space-y-1.5">
              <div className="px-3 py-1 text-[9px] font-mono tracking-widest text-[#758475] font-bold uppercase">
                {sec.heading}
              </div>

              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-mono font-medium rounded-xl transition-all text-left ${
                      isActive
                        ? 'nm-inset text-[#2D6A4F] font-bold border border-[#52B788]/40 shadow-inner'
                        : 'text-[#556455] hover:text-[#1A241C] hover:bg-black/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-[#2D6A4F] scale-105' : 'text-[#758475]'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded-lg shrink-0 font-bold ${
                        isActive 
                          ? 'nm-badge text-[#2D6A4F] border border-[#52B788]/40 bg-[#E8F5EE]' 
                          : 'nm-badge text-[#556455]'
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
      <div className="p-3 nm-flat rounded-2xl flex items-center justify-between cursor-pointer hover:border-black/[0.08] transition-all mt-4 border border-white/80">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 nm-convex rounded-xl flex items-center justify-center text-[10px] font-mono font-black text-[#2D6A4F]">
              FST
            </div>
            <span className="w-2 h-2 bg-[#52B788] rounded-full absolute -bottom-0.5 -right-0.5 shadow-[0_0_6px_rgba(82,183,136,0.8)]" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#1A241C] leading-tight font-mono">Forward Surg Team</div>
            <div className="text-[10px] text-[#556455] leading-tight font-mono">Bangalore Focal HQ</div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[#758475]" />
      </div>

    </aside>
  );
}
