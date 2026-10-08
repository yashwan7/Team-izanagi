import React, { useState } from 'react';
import { 
  GitMerge, ShieldAlert, Pill, Activity, AlertTriangle, 
  Sparkles, RefreshCw, CheckCircle2, FileText, ChevronDown 
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
          label: 'CONFLICT RESOLVED'
        };
      case 'SECURITY_ALERT':
        return {
          icon: ShieldAlert,
          color: 'text-rose-400 bg-rose-500/15 border-rose-500/40',
          label: 'SECURITY TAMPER'
        };
      case 'MEDICATION_ADMIN':
        return {
          icon: Pill,
          color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
          label: 'MEDICATION'
        };
      case 'VITALS_CRITICAL':
        return {
          icon: Activity,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
          label: 'VITALS ALERT'
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
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <GitMerge className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold tracking-wider text-slate-100 uppercase m-0">
            Offline Sync & Merge Timeline
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {selectedPatientId && (
            <button
              onClick={handleSummarize}
              disabled={loadingNarrative}
              className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 transition-all"
            >
              <Sparkles className={`w-3.5 h-3.5 ${loadingNarrative ? 'animate-spin' : ''}`} />
              <span>Ollama Incident Summary</span>
            </button>
          )}

          <button
            onClick={handleSyncOffline}
            disabled={syncingOffline}
            className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all"
            title="Simulates ingesting an offline replay batch containing duplicate medication to test conflict resolution"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingOffline ? 'animate-spin' : ''}`} />
            <span>Simulate Offline Replay</span>
          </button>
        </div>
      </div>

      {/* Ollama Narrative Banner if requested */}
      {narrative && (
        <div className="mx-3 mt-3 p-3.5 bg-cyan-950/40 border border-cyan-500/40 rounded-xl text-xs font-mono text-cyan-200">
          <div className="flex items-center justify-between font-bold mb-1">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <Sparkles className="w-3.5 h-3.5" /> Ollama Llama 3.2 Chronological Summary ({selectedPatientId}):
            </span>
            <button onClick={() => setNarrative(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <p className="whitespace-pre-line leading-relaxed m-0 text-slate-200 text-[11px]">
            {narrative}
          </p>
        </div>
      )}

      {/* Incident List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {timeline.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-mono text-xs">
            No synchronization incidents recorded yet.
          </div>
        ) : (
          timeline.map((item) => {
            const badge = getCategoryBadge(item.category);
            const Icon = badge.icon;

            return (
              <div
                key={item.id}
                className={`p-3 rounded-xl border text-xs font-mono transition-all ${
                  item.conflict_detected
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${badge.color}`}>
                      <Icon className="w-3 h-3" />
                      {badge.label}
                    </span>
                    <span className="font-bold text-slate-300">{item.patient_id}</span>
                  </div>
                  <span className="text-slate-500 text-[11px]">{item.timestamp}</span>
                </div>

                <div className="font-semibold text-slate-200 text-xs mb-1">
                  {item.title}
                </div>

                <div className="text-slate-400 text-[11px] leading-relaxed">
                  {item.details}
                </div>

                {item.resolution && (
                  <div className="mt-2 p-2 rounded bg-slate-900/90 border border-slate-800 text-[11px] text-cyan-300 flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Resolution:</strong> {item.resolution}</span>
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
