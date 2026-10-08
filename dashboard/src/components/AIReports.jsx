import React, { useState } from 'react';
import { 
  FileText, Sparkles, BrainCircuit, CheckSquare, 
  ShieldCheck, AlertTriangle, Download, RefreshCw, 
  Clock, Heart, Wind, Stethoscope, ChevronRight 
} from 'lucide-react';

export default function AIReports({ 
  patients = [], 
  selectedPatientId, 
  onSelectPatient,
  onFetchTimelineNarrative 
}) {
  const [activePid, setActivePid] = useState(selectedPatientId || 'PT-101');
  const [generating, setGenerating] = useState(false);
  const [narrativeSummary, setNarrativeSummary] = useState(null);

  const activePatientItem = patients.find(p => p.capsule.patient_id === activePid) || patients[0];
  const p = activePatientItem?.capsule || {};
  const evalData = activePatientItem?.evaluation || {
    priority_score: activePatientItem?.priority_score || 25.0,
    triage_level: activePatientItem?.triage_badge || 'YELLOW',
    protocol_mode: p.time_to_help <= 0.5 ? 'ACUTE_STABILIZATION' : p.time_to_help >= 24 ? 'PROLONGED_FIELD_CARE' : 'TACTICAL_STANDARD',
    clinical_summary: 'Patient evaluation active under clinical surveillance protocol.',
    action_steps: ['Maintain vital stability', 'Continuous telemetry uplink monitoring'],
    red_flag_triggers: ['Acute vital degradation', 'Sudden hypoxemia drop below 90%'],
    rationing_guidelines: ['Standard field supply allocation']
  };

  const handleGenerateNarrative = async () => {
    setGenerating(true);
    try {
      if (onFetchTimelineNarrative) {
        const text = await onFetchTimelineNarrative(activePid);
        setNarrativeSummary(text);
      }
    } finally {
      setGenerating(false);
    }
  };

  const isAcute = p.time_to_help <= 0.5;
  const isPFC = p.time_to_help >= 24.0;

  return (
    <div className="space-y-6">
      
      {/* Header Strip with Patient Selector */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 m-0">
              AI Clinical Reports & Decision Intelligence
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 m-0">
            Powered by Ollama Llama 3.2:3b &bull; Delay-Aware Triage & Incident Timeline Synthesis
          </p>
        </div>

        {/* Patient Selection Dropdown & Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Patient:</span>
            <select
              value={activePid}
              onChange={(e) => {
                setActivePid(e.target.value);
                if (onSelectPatient) onSelectPatient(e.target.value, false);
                setNarrativeSummary(null);
              }}
              className="bg-slate-50 text-xs font-semibold text-slate-700 rounded-full px-4 py-2 border border-slate-200 focus:outline-none focus:border-blue-400"
            >
              {patients.map(item => (
                <option key={item.capsule.patient_id} value={item.capsule.patient_id}>
                  {item.capsule.patient_id} - {item.capsule.patient_name} ({item.triage_badge})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => onSelectPatient && onSelectPatient(activePid, true)}
            className="px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Open patient medical chart modal"
          >
            <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
            <span>Full Chart</span>
          </button>

          <button
            onClick={handleGenerateNarrative}
            disabled={generating}
            className="px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Sparkles className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'Querying Ollama...' : 'Synthesize Timeline'}</span>
          </button>
        </div>
      </div>

      {/* Main Report Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Triage Assessment & Metrics (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Clinical Triage Overview Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  CLINICAL ASSESSMENT · {p.patient_id}
                </span>
                <h3 className="text-base font-bold text-slate-800 m-0">{p.patient_name}</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                evalData.triage_level === 'IMMEDIATE_RED' || activePatientItem?.triage_badge === 'RED'
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {evalData.triage_level || activePatientItem?.triage_badge} (Score: {activePatientItem?.priority_score.toFixed(1)})
              </span>
            </div>

            {/* Protocol Mode Banner */}
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 text-xs">
              <span className="font-bold text-blue-900 block mb-0.5">
                OPERATIONAL PROTOCOL: {evalData.protocol_mode || (isAcute ? 'ACUTE_STABILIZATION' : isPFC ? 'PROLONGED_FIELD_CARE' : 'TACTICAL_STANDARD')}
              </span>
              <p className="text-blue-800/80 m-0 text-[11px] leading-relaxed">
                {isAcute 
                  ? 'Evacuation ETA < 30 minutes. Prioritizing MARCH algorithm, high-speed airway control, and rapid transport packaging.'
                  : isPFC 
                  ? 'Delayed evacuation (> 24 hours). Austere conditions require fluid and oxygen rationing with scheduled decubitus rotation.'
                  : 'Tactical holding and scheduled reassessment active.'}
              </p>
            </div>

            {/* Clinical Summary */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Clinical Diagnosis & Urgency Summary
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100 m-0">
                {evalData.clinical_summary || 'Evaluating patient physiological status...'}
              </p>
            </div>

            {/* Ordered Action Steps */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-emerald-500" />
                Prescribed Clinical Action Checklist
              </h4>
              <div className="space-y-2">
                {evalData.action_steps?.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Supply Rationing (if PFC) */}
            {(isPFC || (evalData.rationing_guidelines && evalData.rationing_guidelines.length > 0)) && (
              <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100 text-xs">
                <span className="font-bold text-purple-900 block mb-1">
                  Austere Supply Rationing Guidelines (Help ETA: {p.time_to_help}h):
                </span>
                <ul className="text-purple-800 space-y-1 pl-4 list-disc text-[11px]">
                  {evalData.rationing_guidelines?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: AI Incident Synthesis & Vitals Trends (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* AI Narrative Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-800 m-0">Ollama Chronological Narrative</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Model: llama3.2:3b</span>
            </div>

            {narrativeSummary ? (
              <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 text-xs text-purple-900 leading-relaxed whitespace-pre-line font-sans">
                {narrativeSummary}
              </div>
            ) : (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center text-xs text-slate-400">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <span>Click "Synthesize Timeline" to generate a chronological natural-language incident audit for {p.patient_id}.</span>
              </div>
            )}
          </div>

          {/* Vitals & Red Flags Snapshot */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] space-y-3">
            <h3 className="text-sm font-bold text-slate-800 m-0">Vitals & Physiological Markers</h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 text-[10px] font-semibold">Heart Rate</span>
                <div className="text-lg font-bold text-slate-800 mt-0.5">{p.vitals?.heart_rate || '--'} bpm</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 text-[10px] font-semibold">Oxygen SpO2</span>
                <div className="text-lg font-bold text-slate-800 mt-0.5">{p.vitals?.spo2 || '--'}%</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 text-[10px] font-semibold">Blood Pressure</span>
                <div className="text-lg font-bold text-slate-800 mt-0.5">{p.vitals?.systolic_bp || '--'}/{p.vitals?.diastolic_bp || '--'}</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 text-[10px] font-semibold">Evac Window</span>
                <div className="text-lg font-bold text-blue-600 mt-0.5">{p.time_to_help < 1 ? `${Math.round(p.time_to_help*60)}m` : `${p.time_to_help}h`}</div>
              </div>
            </div>

            {/* Red Flags List */}
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">Registered Red Flags:</span>
              <div className="flex flex-wrap gap-1.5">
                {p.red_flags?.map((flag, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    {flag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
