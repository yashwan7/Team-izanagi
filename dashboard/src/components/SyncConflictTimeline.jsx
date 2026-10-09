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
          color: 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40',
          label: 'MEDICATION CONFLICT RESOLVED'
        };
      case 'SECURITY_ALERT':
        return {
          icon: ShieldAlert,
          color: 'nm-alert-inset text-[#FF334B] border-[#FF334B]/50 animate-pulse',
          label: 'SECURITY SIGNATURE MISMATCH'
        };
      case 'MEDICATION_ADMIN':
        return {
          icon: Pill,
          color: 'nm-inset text-[#10B981] border-[#10B981]/30',
          label: 'PHARMACY DISPENSE RECORD'
        };
      case 'VITALS_CRITICAL':
        return {
          icon: Activity,
          color: 'nm-alert-inset text-[#FF334B] border-[#FF334B]/40',
          label: 'VITAL SIGN ALERT'
        };
      default:
        return {
          icon: FileText,
          color: 'nm-inset text-[#94A3B8] border-white/[0.04]',
          label: category
        };
    }
  };

  return (
    <div className="flex flex-col h-full nm-flat rounded-2xl border border-white/[0.04] font-mono select-none text-[#F8FAFC] overflow-hidden">
      
      {/* Hospital EMR Audit Header */}
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 nm-convex rounded-xl border border-[#FF334B]/30 text-[#FF334B] flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs md:text-sm font-bold text-[#F8FAFC] uppercase tracking-wider m-0">
              EMR AUDIT LOG &bull; RECONCILIATION TIMELINE
            </h3>
            <p className="text-[11px] text-[#94A3B8] m-0 font-sans mt-0.5">
              Distributed delta merging &bull; Automatic medication deduplication &amp; HMAC verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedPatientId && (
            <button
              onClick={handleSummarize}
              disabled={loadingNarrative}
              className="px-3.5 py-2 text-xs font-bold nm-btn text-[#F8FAFC] hover:text-[#FF334B] rounded-xl flex items-center gap-1.5 transition-all"
            >
              <Sparkles className={`w-3.5 h-3.5 text-[#FF334B] ${loadingNarrative ? 'animate-spin' : ''}`} />
              <span>AI CHART SYNTHESIS</span>
            </button>
          )}

          <button
            onClick={handleSyncOffline}
            disabled={syncingOffline}
            className="px-3.5 py-2 text-xs font-bold nm-btn-accent text-white rounded-xl flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(255,51,75,0.3)]"
            title="Simulate ingesting an offline replay batch to verify medication deduplication"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingOffline ? 'animate-spin' : ''}`} />
            <span>SIMULATE OFFLINE REPLAY</span>
          </button>
        </div>
      </div>

      {/* AI Clinical Narrative Summary */}
      {narrative && (
        <div className="mx-5 mt-4 p-4 nm-convex rounded-xl border border-[#FF334B]/30 text-xs text-[#F8FAFC]">
          <div className="flex items-center gap-2 font-bold mb-1.5 text-[#FF334B] uppercase text-[11px] tracking-wider">
            <Sparkles className="w-4 h-4 text-[#FF334B]" />
            <span>NIRANTARA CHRONOLOGICAL SYNTHESIS ({selectedPatientId}):</span>
          </div>
          <p className="m-0 leading-relaxed whitespace-pre-line text-[11px] text-[#94A3B8] font-sans">
            {narrative}
          </p>
        </div>
      )}

      {/* Timeline Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {timeline.length === 0 ? (
          <div className="text-center py-20 text-[#94A3B8] text-xs">
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
                key={event.id || event.incident_id || idx}
                className="p-4 nm-flat rounded-2xl border border-white/[0.04] hover:border-[#FF334B]/30 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1.5 ${config.color}`}>
                      <EventIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[#FF334B] nm-alert-inset px-2 py-0.5 rounded-lg border border-[#FF334B]/30">
                      {event.patient_id}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-[#94A3B8] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
                    {timeStr}
                  </span>
                </div>

                {event.title && (
                  <h4 className="text-sm font-bold text-[#F8FAFC] m-0 mb-1">
                    {event.title}
                  </h4>
                )}

                <p className="text-[11px] font-medium text-[#94A3B8] m-0 leading-relaxed font-sans">
                  {event.details || event.description}
                </p>

                {/* Conflict Resolution Details */}
                {event.conflict_detected && (
                  <div className="mt-3 p-3 nm-alert-inset rounded-xl border border-[#FF334B]/40 text-[11px] text-[#FF334B] flex items-start gap-2 font-sans">
                    <AlertTriangle className="w-4 h-4 text-[#FF334B] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold uppercase font-mono text-[10px]">Safety Conflict Averted:</strong>
                      Duplicate medication administration suppressed via cryptographic entry ID deduplication. Overdose prevention protocol active.
                    </div>
                  </div>
                )}

                {/* Resolution Confirmation */}
                {event.resolution && (
                  <div className="mt-3 p-3 nm-inset rounded-xl border border-white/[0.04] text-[11px] text-[#F8FAFC] flex items-start gap-2 font-sans">
                    <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-[#10B981] uppercase font-mono text-[10px]">Clinical Resolution:</strong>
                      {event.resolution}
                    </div>
                  </div>
                )}

                {/* Payload Metadata Inspector */}
                {event.payload && Object.keys(event.payload).length > 0 && (
                  <div className="mt-3 text-[10px] font-mono text-[#94A3B8] nm-inset p-3 rounded-xl border border-white/[0.02] flex flex-wrap gap-x-4 gap-y-1">
                    {Object.entries(event.payload).map(([k, v]) => (
                      <span key={k}>
                        <span className="text-[#64748B]">{k}:</span>{' '}
                        <strong className="text-[#F8FAFC]">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</strong>
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
