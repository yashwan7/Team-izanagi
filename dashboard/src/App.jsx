import React, { useState, useEffect, useRef } from 'react';
import NetworkBar from './components/NetworkBar';
import HarmRankedQueue from './components/HarmRankedQueue';
import TriageMap from './components/TriageMap';
import SyncConflictTimeline from './components/SyncConflictTimeline';
import EyeGazeAlertModal from './components/EyeGazeAlertModal';
import PatientDetailModal from './components/PatientDetailModal';
import { 
  HeartPulse, ShieldAlert, RefreshCw, 
  Stethoscope, Activity, ClipboardCheck, Sparkles 
} from 'lucide-react';

const API_BASE = '/api';

export default function App() {
  const [networkStatus, setNetworkStatus] = useState(null);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('PT-101');
  const [selectedPatientDetail, setSelectedPatientDetail] = useState(null);
  const [activeGazeAlert, setActiveGazeAlert] = useState(null);
  const [incidentTimeline, setIncidentTimeline] = useState([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  const fetchAllData = async () => {
    try {
      const [resNet, resPat, resTime] = await Promise.all([
        fetch(`${API_BASE}/network-state`).then(r => r.json()),
        fetch(`${API_BASE}/patients`).then(r => r.json()),
        fetch(`${API_BASE}/timeline`).then(r => r.json())
      ]);
      setNetworkStatus(resNet);
      setPatients(resPat);
      setIncidentTimeline(resTime);

      if (resPat.length > 0 && !selectedPatientId) {
        setSelectedPatientId(resPat[0].capsule.patient_id);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const fetchPatientDetail = async (patientId) => {
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPatientDetail(data);
      }
    } catch (err) {
      console.error('Detail fetch error:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientDetail(selectedPatientId);
    }
  }, [selectedPatientId]);

  // WebSocket Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connectWs = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'NETWORK_TICK') {
            setNetworkStatus(msg.payload);
          } else if (msg.type === 'EYE_GAZE_ALERT') {
            setActiveGazeAlert(msg.payload);
            fetchAllData();
          } else if (msg.type === 'CAPSULE_UPDATE') {
            fetchAllData();
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWs, 2000);
      };
    };

    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleSelectPatient = (id) => {
    setSelectedPatientId(id);
    fetchPatientDetail(id);
    setIsDetailOpen(true);
  };

  const handleSimulateNetwork = async (scenario) => {
    const res = await fetch(`${API_BASE}/network-state/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario })
    });
    if (res.ok) {
      const data = await res.json();
      setNetworkStatus(data);
    }
  };

  const handleSimulateGaze = async (payload) => {
    await fetch(`${API_BASE}/simulate-gaze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    fetchAllData();
  };

  const handleFetchTimelineNarrative = async (patientId) => {
    const res = await fetch(`${API_BASE}/timeline/summary/${patientId}`);
    if (res.ok) {
      const data = await res.json();
      return data.timeline_summary;
    }
    return 'Summary unavailable.';
  };

  const handleTriggerOfflineSync = async () => {
    const duplicateCapsule = {
      patient_id: "PT-101",
      patient_name: "Sgt. Marcus Vance",
      time_to_help: 0.4,
      vitals: { heart_rate: 135, spo2: 87, systolic_bp: 90, diastolic_bp: 60, respiratory_rate: 30, fall_detected: true },
      medications: [
        {
          medication: "Morphine",
          dose: "5mg IV",
          administered_at: "15:00",
          administered_by: "Medic Gamma",
          entry_id: `M_REPLAY_${Date.now()}`
        }
      ],
      offline_cached: true,
      sequence_id: Math.floor(Math.random() * 1000)
    };

    await fetch(`${API_BASE}/capsule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicateCapsule)
    });
    fetchAllData();
  };

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      
      {/* Hospital Command Center Header */}
      <NetworkBar 
        networkStatus={networkStatus} 
        onSimulateNetwork={handleSimulateNetwork} 
        isOnline={wsConnected}
      />

      {/* Hospital Clinical Test & Simulator Bar */}
      <div className="bg-[#0b1328] border-b border-[#1b284a] px-4 md:px-6 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-slate-300">
            <Stethoscope className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-white">CLINICAL TRIAGE SANDBOX:</span>
            <span className="text-slate-500 hidden sm:inline">&bull; Real-time EOG Biopotential & Hardware HMAC Emulation</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleSimulateGaze({
                patient_id: 'PT-101',
                command: 'CALL_NURSE',
                direction: 'CENTER',
                blink_count: 2,
                tampered: false
              })}
              className="px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 transition-all font-medium"
            >
              <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
              <span>Simulate Nurse Call (Verified)</span>
            </button>

            <button
              onClick={() => handleSimulateGaze({
                patient_id: 'PT-309',
                command: 'WATER',
                direction: 'LEFT',
                blink_count: 1,
                tampered: true
              })}
              className="px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition-all font-medium"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Tampered HMAC Capsule</span>
            </button>

            <button
              onClick={handleTriggerOfflineSync}
              className="px-2.5 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 flex items-center gap-1.5 transition-all font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span>Reconcile Duplicate Meds</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Clinical Operations Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Hospital Emergency Triage Board (5 Columns) */}
        <section className="lg:col-span-5 h-[calc(100vh-140px)] min-h-[580px]">
          <HarmRankedQueue 
            patients={patients} 
            selectedPatientId={selectedPatientId} 
            onSelectPatient={handleSelectPatient}
          />
        </section>

        {/* Right Column: Dispatch Map & EMR Audit Timeline (7 Columns) */}
        <section className="lg:col-span-7 h-[calc(100vh-140px)] min-h-[580px] flex flex-col gap-4">
          
          {/* Dispatch Map (Top Half) */}
          <div className="flex-1 min-h-[290px]">
            <TriageMap 
              patients={patients} 
              selectedPatientId={selectedPatientId} 
              onSelectPatient={handleSelectPatient}
            />
          </div>

          {/* EMR Audit & Conflict Resolution Timeline (Bottom Half) */}
          <div className="flex-1 min-h-[270px]">
            <SyncConflictTimeline 
              timeline={incidentTimeline} 
              onTriggerOfflineSync={handleTriggerOfflineSync}
              selectedPatientId={selectedPatientId}
              onFetchTimelineNarrative={handleFetchTimelineNarrative}
            />
          </div>

        </section>
      </main>

      {/* Real-Time Nurse Call / EOG Alert Modal */}
      {activeGazeAlert && (
        <EyeGazeAlertModal 
          alert={activeGazeAlert} 
          onClose={() => setActiveGazeAlert(null)}
          onDispatch={(alert) => {
            console.log('Hospital response dispatched for:', alert);
          }}
        />
      )}

      {/* Patient EMR Clinical Chart Modal */}
      {isDetailOpen && selectedPatientDetail && (
        <PatientDetailModal 
          patient={selectedPatientDetail}
          onClose={() => setIsDetailOpen(false)}
          onSimulateGaze={handleSimulateGaze}
          onReevaluateTriage={() => fetchPatientDetail(selectedPatientId)}
        />
      )}

    </div>
  );
}
