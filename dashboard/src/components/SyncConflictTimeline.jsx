import React, { useState } from 'react';
import { 
  GitMerge, ShieldAlert, Pill, Activity, AlertTriangle, 
  Sparkles, RefreshCw, CheckCircle2, FileText, ClipboardList 
} from 'lucide-react';

export default function SyncConflictTimeline({ 
  timeline = [], 
  onTriggerOfflineSync, 
  selectedPatientId,
  onFetchTimelineNarrative 
}) {
  const [narrative, setNarrative] = useState(null);
  const [loadingNarrative, setLoadingNarrative] = useState(false);
  const [syncingOffline, setSyncingOffline] = useState(false);

  const handleSummarize = async () => {
    if (!selectedPatientId) return;
    setLoadingNarrative(true);
    try {
      const summary = await onFetchTimelineNarrative(selectedPatientId);
      setNarrative(summary);
    } finally {
      setLoadingNarrative(false);
    }
  };

  const handleSyncOffline = async () => {
    setSyncingOffline(true);
    try {
      await onTriggerOfflineSync();
    } finally {
      setTimeout(() => setSyncingOffline(false), 500);
    }
  };

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'CONFLICT_RESOLVED':
        return {
          icon: GitMerge,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          label: 'MEDICATION CONFLICT RESOLVED'
        };
      case 'SECURITY_ALERT':
        return {
          icon: ShieldAlert,
          color: 'text-rose-400 bg-rose-500/15 border-rose-500/40',
          label: 'DEVICE SECURITY MISMATCH'
        };
      case 'MEDICATION_ADMIN':
        return {
          icon: Pill,
          color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
          label: 'PHARMACY DISPENSE'
        };
      case 'VITALS_CRITICAL':
        return {
          icon: Activity,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
          label: 'VITAL SIGN ALERT'
        };
      default:
        return {
          icon: FileText,
          color: 'text-slate-400 bg-slate-800 border-slate-700',
          label: category
        };
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b1328] border border-[#1b284a] rounded-xl overflow-hidden shadow-xl">
      
      {/* Hospital EMR Audit Header */}
      <div className="px-4 py-3 bg-[#080d1c] border-b border-[#1b284a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs md:text-sm font-bold tracking-wider text-white uppercase m-0">
            EMR Audit Log · Offline Reconciliation Timeline
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {selectedPatientId && (
            <button
              onClick={handleSummarize}
              disabled={loadingNarrative}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 flex items-center gap-1.5 transition-all"
            >
              <Sparkles className={`w-3.5 h-3.5 ${loadingNarrative ? 'animate-spin' : ''}`} />
              <span>AI Chart Summary</span>
            </button>
          )}

          <button
            onClick={handleSyncOffline}
            disabled={syncingOffline}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#131f3d] hover:bg-[#1a2b54] text-slate-200 border border-[#213563] flex items-center gap-1.5 transition-all"
            title="Simulate ingesting an offline replay batch to verify medication deduplication"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingOffline ? 'animate-spin' : ''}`} />
            <span>Simulate Offline Replay</span>
          </button>
        </div>
      </div>

      {/* AI Clinical Narrative Summary */}
      {narrative && (
        <div className="mx-3 mt-3 p-3.5 bg-[#0e1c3a] border border-sky-500/40 rounded-xl text-xs text-sky-200">
          <div className="flex items-center justify-between font-bold mb-1">
            <span className="flex items-center gap-1.5 text-sky-300">
              <Sparkles className="w-3.5 h-3.5" /> Ollama Clinical Synthesis ({selectedPatientId}):
            </span>
            <button onClick={() => setNarrative(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <p className="whitespace-pre-line leading-relaxed m-0 text-slate-200 text-[11px]">
            {narrative}
          </p>
        </div>
      )}

      {/* Incident Audit Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {timeline.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            No synchronization incidents recorded. Clinical record in sync.
          </div>
        ) : (
          timeline.map((item) => {
            const badge = getCategoryBadge(item.category);
            const Icon = badge.icon;

            return (
              <div
                key={item.id}
                className={`p-3 rounded-lg border text-xs transition-all ${
                  item.conflict_detected
                    ? 'bg-[#181a24] border-amber-500/40'
                    : 'bg-[#0d162d] border-[#1b284a]/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 ${badge.color}`}>
                      <Icon className="w-3 h-3" />
                      {badge.label}
                    </span>
                    <span className="font-mono font-bold text-sky-400">{item.patient_id}</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">{item.timestamp}</span>
                </div>

                <div className="font-semibold text-slate-200 text-xs mb-0.5">
                  {item.title}
                </div>

                <div className="text-slate-400 text-[11px] leading-relaxed">
                  {item.details}
                </div>

                {item.resolution && (
                  <div className="mt-2 p-2 rounded bg-[#090f20] border border-[#1b284a] text-[11px] text-sky-300 flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                    <span><strong>Clinical Resolution:</strong> {item.resolution}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
