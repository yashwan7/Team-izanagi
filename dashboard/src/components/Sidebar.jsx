import React from 'react';
import { 
  LayoutGrid, Users, Calendar, MessageSquare, 
  FileText, Activity, Settings, MapPin, GitMerge, ChevronRight,
  Building2 
} from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab }) {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'capacity', label: 'Hospital Capacity', icon: Building2 },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'triage', label: 'Triage Queue', icon: Activity },
    { id: 'map', label: 'GPS Map', icon: MapPin },
    { id: 'timeline', label: 'Audit Timeline', icon: GitMerge },
    { id: 'reports', label: 'AI Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-gradient-to-b from-[#18365f] via-[#1d4273] to-[#255799] text-white flex flex-col justify-between p-5 shrink-0 min-h-screen select-none shadow-xl">
      
      {/* Top Profile / Brand */}
      <div>
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-bold text-white shadow-inner">
              <span className="text-base font-semibold">KA</span>
            </div>
            <span className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#18365f] absolute -bottom-0.5 -right-0.5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white m-0 tracking-tight">KSHITIJ EMR</h1>
            <p className="text-[11px] text-blue-200/80 m-0">Clinical Command</p>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-900/30 font-bold'
                    : 'text-blue-100/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-200/70'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile Card */}
      <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-between cursor-pointer hover:bg-white/15 transition-all">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
              MO
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#18365f] absolute -bottom-0.5 -right-0.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white leading-tight">Medical Officer</div>
            <div className="text-[10px] text-blue-200/75 leading-tight">Field Command</div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-blue-200/60" />
      </div>

    </aside>
  );
}
