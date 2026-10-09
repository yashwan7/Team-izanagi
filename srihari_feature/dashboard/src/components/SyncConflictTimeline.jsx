import React, { useState } from 'react';
import { 
  GitMerge, ShieldAlert, Pill, Activity, AlertTriangle, 
  Sparkles, RefreshCw, CheckCircle2, FileText, ClipboardList, Clock 
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
          color: 'text-amber-700 bg-amber-50 border-amber-200',
          label: 'MEDICATION CONFLICT RESOLVED'
        };
      case 'SECURITY_ALERT':
        return {
          icon: ShieldAlert,
          color: 'text-rose-700 bg-rose-50 border-rose-200',
          label: 'SECURITY SIGNATURE MISMATCH'
        };
      case 'MEDICATION_ADMIN':
        return {
          icon: Pill,
          color: 'text-sky-700 bg-sky-50 border-sky-200',
          label: 'PHARMACY DISPENSE RECORD'
        };
      case 'VITALS_CRITICAL':
        return {
          icon: Activity,
          color: 'text-rose-700 bg-rose-50 border-rose-200',
          label: 'VITAL SIGN ALERT'
        };
      default:
        return {
          icon: FileText,
          color: 'text-slate-700 bg-slate-100 border-slate-200',
          label: category
        };
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] overflow-hidden">
      
      {/* Hospital EMR Audit Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-800 tracking-tight m-0">
              EMR Audit Log &bull; Offline Reconciliation Timeline
            </h3>
            <p className="text-[11px] text-slate-400 m-0">
              Distributed delta merging &bull; Automatic medication deduplication &amp; HMAC verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedPatientId && (
            <button
              onClick={handleSummarize}
              disabled={loadingNarrative}
              className="px-3.5 py-1.5 text-xs font-bold rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Sparkles className={`w-3.5 h-3.5 ${loadingNarrative ? 'animate-spin' : ''}`} />
              <span>AI Chart Summary</span>
            </button>
          )}

          <button
            onClick={handleSyncOffline}
            disabled={syncingOffline}
            className="px-3.5 py-1.5 text-xs font-bold rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs transition-all"
            title="Simulate ingesting an offline replay batch to verify medication deduplication"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingOffline ? 'animate-spin' : ''}`} />
            <span>Simulate Offline Replay</span>
          </button>
        </div>
      </div>

      {/* AI Clinical Narrative Summary */}
      {narrative && (
        <div className="mx-6 mt-4 p-4 bg-purple-50/70 border border-purple-200 rounded-2xl text-xs text-purple-950 shadow-xs">
          <div className="flex items-center gap-1.5 font-bold mb-1 text-purple-800">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Nirantara Chronological Synthesis ({selectedPatientId}):</span>
          </div>
          <p className="m-0 leading-relaxed whitespace-pre-line text-[11px]">
            {narrative}
          </p>
        </div>
      )}

      {/* Timeline Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {timeline.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-xs">
            No audit events registered yet. Offline logs and medications will populate here upon sync.
          </div>
        ) : (
          timeline.map((event, idx) => {
            const config = getCategoryBadge(event.category);
            const EventIcon = config.icon;
            const timeStr = typeof event.timestamp === 'number'
              ? new Date(event.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : String(event.timestamp || '--:--:--');

            return (
              <div 
                key={`${event.id || event.incident_id || 'inc'}_${idx}`}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${config.color}`}>
                      <EventIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-lg border border-blue-200">
                      {event.patient_id}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeStr}
                  </span>
                </div>

                {event.title && (
                  <h4 className="text-xs font-bold text-slate-800 m-0 mb-1">
                    {event.title}
                  </h4>
                )}

                <p className="text-xs font-medium text-slate-600 m-0 leading-relaxed">
                  {event.details || event.description}
                </p>

                {/* Conflict Resolution Details */}
                {event.conflict_detected && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Safety Conflict Averted:</strong>
                      Duplicate medication administration suppressed via cryptographic entry ID deduplication. Overdose prevention protocol active.
                    </div>
                  </div>
                )}

                {/* Resolution Confirmation */}
                {event.resolution && (
                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Clinical Resolution:</strong>
                      {event.resolution}
                    </div>
                  </div>
                )}

                {/* Payload Metadata Inspector */}
                {event.payload && Object.keys(event.payload).length > 0 && (
                  <div className="mt-2 text-[10px] font-mono text-slate-500 bg-white p-2 rounded-xl border border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
                    {Object.entries(event.payload).map(([k, v]) => (
                      <span key={k}>
                        <span className="text-slate-400 font-medium">{k}:</span>{' '}
                        <strong className="text-slate-700">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</strong>
                      </span>
                    ))}
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
