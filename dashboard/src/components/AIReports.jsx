import React, { useState } from 'react';
import { 
  FileText, Sparkles, BrainCircuit, CheckSquare, 
  Stethoscope 
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
    <div className="space-y-5 font-mono select-none text-[#F8FAFC]">
      
      {/* Header Strip with Patient Selector */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 nm-convex rounded-xl border border-[#FF334B]/30 text-[#FF334B] flex items-center justify-center">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-bold text-[#F8FAFC] uppercase tracking-wider m-0">
              AI CLINICAL REPORTS &amp; DECISION INTELLIGENCE
            </h2>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1 m-0 font-sans">
            Powered by Nirantara Local LLM &bull; Delay-Aware Triage &amp; Incident Timeline Synthesis
          </p>
        </div>

        {/* Patient Selection Dropdown & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-[#94A3B8]">Patient:</span>
            <select
              value={activePid}
              onChange={(e) => {
                setActivePid(e.target.value);
                if (onSelectPatient) onSelectPatient(e.target.value, false);
                setNarrativeSummary(null);
              }}
              className="nm-inset rounded-xl text-xs font-semibold text-[#F8FAFC] px-3.5 py-2 border border-white/[0.04] focus:outline-none focus:border-[#FF334B]/40"
            >
              {patients.map(item => (
                <option key={item.capsule.patient_id} value={item.capsule.patient_id} className="bg-[#14171D] text-[#F8FAFC]">
                  {item.capsule.patient_id} - {item.capsule.patient_name} ({item.triage_badge})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => onSelectPatient && onSelectPatient(activePid, true)}
            className="px-3.5 py-2 nm-btn text-[#F8FAFC] hover:text-[#FF334B] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Stethoscope className="w-4 h-4 text-[#FF334B]" />
            <span>FULL CHART</span>
          </button>

          <button
            onClick={handleGenerateNarrative}
            disabled={generating}
            className="px-4 py-2 nm-btn-accent text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-[0_0_12px_rgba(255,51,75,0.3)]"
          >
            <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            <span>{generating ? 'QUERYING NIRANTARA...' : 'SYNTHESIZE TIMELINE'}</span>
          </button>
        </div>
      </div>

      {/* Main Report Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Triage Assessment & Metrics (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Clinical Triage Overview Card */}
          <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-3">
              <div>
                <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider">
                  CLINICAL ASSESSMENT &bull; {p.patient_id}
                </span>
                <h3 className="text-sm font-bold text-[#F8FAFC] m-0 mt-0.5">{p.patient_name}</h3>
              </div>
              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border ${
                evalData.triage_level === 'IMMEDIATE_RED' || activePatientItem?.triage_badge === 'RED'
                  ? 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40'
                  : 'nm-inset text-[#F59E0B] border-[#F59E0B]/30'
              }`}>
                {evalData.triage_level || activePatientItem?.triage_badge} (Score: {activePatientItem?.priority_score?.toFixed(1) || '0.0'})
              </span>
            </div>

            {/* Protocol Mode Banner */}
            <div className="p-3.5 nm-inset rounded-xl border border-white/[0.02] text-xs">
              <span className="font-bold text-[#FF334B] block mb-1 text-[10px] uppercase font-mono">
                OPERATIONAL PROTOCOL: {evalData.protocol_mode || (isAcute ? 'ACUTE_STABILIZATION' : isPFC ? 'PROLONGED_FIELD_CARE' : 'TACTICAL_STANDARD')}
              </span>
              <p className="text-[#94A3B8] m-0 text-[11px] leading-relaxed font-sans">
                {isAcute 
                  ? 'Evacuation ETA < 30 minutes. Prioritizing MARCH algorithm, high-speed airway control, and rapid transport packaging.'
                  : isPFC 
                  ? 'Delayed evacuation (> 24 hours). Austere conditions require fluid and oxygen rationing with scheduled decubitus rotation.'
                  : 'Tactical holding and scheduled reassessment active.'}
              </p>
            </div>

            {/* Clinical Summary */}
            <div>
              <h4 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">
                Clinical Diagnosis &amp; Urgency Summary
              </h4>
              <p className="text-xs text-[#F8FAFC] leading-relaxed nm-inset p-3.5 rounded-xl border border-white/[0.02] m-0 font-sans">
                {evalData.clinical_summary || 'Evaluating patient physiological status...'}
              </p>
            </div>

            {/* Ordered Action Steps */}
            <div>
              <h4 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-[#FF334B]" />
                Prescribed Clinical Action Checklist
              </h4>
              <div className="space-y-2">
                {evalData.action_steps?.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 nm-inset rounded-xl border border-white/[0.02] text-xs text-[#F8FAFC] font-sans">
                    <span className="w-5 h-5 nm-convex rounded-md text-[#FF334B] border border-[#FF334B]/30 font-bold font-mono flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="mt-0.5">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Supply Rationing (if PFC) */}
            {(isPFC || (evalData.rationing_guidelines && evalData.rationing_guidelines.length > 0)) && (
              <div className="p-3.5 nm-convex rounded-xl border border-[#FF334B]/30 text-xs">
                <span className="font-bold text-[#FF334B] block mb-1.5 text-[10px] uppercase font-mono">
                  Austere Supply Rationing Guidelines (Help ETA: {p.time_to_help}h):
                </span>
                <ul className="text-[#94A3B8] space-y-1.5 pl-4 list-disc text-[11px] font-sans">
                  {evalData.rationing_guidelines?.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: AI Incident Synthesis & Vitals Trends (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* AI Narrative Card */}
          <div className="nm-flat rounded-2xl p-5 border border-white/[0.04]">
            <div className="flex items-center justify-between mb-3 border-b border-white/[0.04] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF334B]" />
                <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider m-0">Nirantara Chronological Narrative</h3>
              </div>
              <span className="text-[10px] font-mono text-[#94A3B8]">Nirantara-Clinical-3B</span>
            </div>

            {narrativeSummary ? (
              <div className="nm-convex p-4 rounded-xl border border-[#FF334B]/30 text-xs text-[#F8FAFC] leading-relaxed whitespace-pre-line font-sans">
                {narrativeSummary}
              </div>
            ) : (
              <div className="nm-inset p-8 rounded-xl border border-white/[0.02] text-center text-xs text-[#94A3B8]">
                <FileText className="w-8 h-8 text-[#64748B] mx-auto mb-2" />
                <span className="text-[11px] font-sans">Click &quot;Synthesize Timeline&quot; to generate chronological natural-language incident audit for {p.patient_id}.</span>
              </div>
            )}
          </div>

          {/* Vitals & Red Flags Snapshot */}
          <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] space-y-3">
            <h3 className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider m-0">Vitals &amp; Markers</h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 nm-inset rounded-xl border border-white/[0.02]">
                <span className="text-[#94A3B8] text-[10px] uppercase font-semibold">Heart Rate</span>
                <div className="text-base font-bold text-[#F8FAFC] mt-1">{p.vitals?.heart_rate || '--'} bpm</div>
              </div>
              <div className="p-3.5 nm-inset rounded-xl border border-white/[0.02]">
                <span className="text-[#94A3B8] text-[10px] uppercase font-semibold">Oxygen SpO2</span>
                <div className="text-base font-bold text-[#F8FAFC] mt-1">{p.vitals?.spo2 || '--'}%</div>
              </div>
              <div className="p-3.5 nm-inset rounded-xl border border-white/[0.02]">
                <span className="text-[#94A3B8] text-[10px] uppercase font-semibold">Blood Pressure</span>
                <div className="text-base font-bold text-[#F8FAFC] mt-1">{p.vitals?.systolic_bp || '--'}/{p.vitals?.diastolic_bp || '--'}</div>
              </div>
              <div className="p-3.5 nm-inset rounded-xl border border-white/[0.02]">
                <span className="text-[#94A3B8] text-[10px] uppercase font-semibold">Evac Window</span>
                <div className="text-base font-bold text-[#FF334B] mt-1">{p.time_to_help < 1 ? `${Math.round(p.time_to_help*60)}m` : `${p.time_to_help}h`}</div>
              </div>
            </div>

            {/* Red Flags List */}
            <div className="pt-2 border-t border-white/[0.04]">
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1.5">Registered Red Flags:</span>
              <div className="flex flex-wrap gap-1.5">
                {p.red_flags?.map((flag, idx) => (
                  <span key={idx} className="px-2 py-0.5 text-[10px] font-bold nm-alert-inset text-[#FF334B] border border-[#FF334B]/30 rounded-md">
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
