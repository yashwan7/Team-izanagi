import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import NetworkBar from './components/NetworkBar';
import ClinicalOverview from './components/ClinicalOverview';
import PatientsRegistry from './components/PatientsRegistry';
import HarmRankedQueue from './components/HarmRankedQueue';
import TriageMap from './components/TriageMap';
import SyncConflictTimeline from './components/SyncConflictTimeline';
import EyeGazeAlertModal from './components/EyeGazeAlertModal';
import PatientDetailModal from './components/PatientDetailModal';
import AIReports from './components/AIReports';
import SettingsView from './components/SettingsView';
import HospitalCapacity from './components/HospitalCapacity';
import BloodBankNetwork from './components/BloodBankNetwork';
import FailoverTinyMLView from './components/FailoverTinyMLView';
import EOGSecurityView from './components/EOGSecurityView';
import PharmacyNetwork from './components/PharmacyNetwork';
import CDCPipelineView from './components/CDCPipelineView';
import { 
  HeartPulse, ShieldAlert, RefreshCw, 
  Sparkles, Stethoscope, Activity, FileText, Zap, Eye 
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
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'capacity' | 'bloodbank' | 'patients' | 'triage' | 'map' | 'timeline' | 'reports' | 'settings'
  const [capacityData, setCapacityData] = useState(null);
  const [bloodBankData, setBloodBankData] = useState(null);
  const wsRef = useRef(null);

  const fetchAllData = async () => {
    try {
      const [resNet, resPat, resTime, resCap, resBlood] = await Promise.all([
        fetch(`${API_BASE}/network-state`).then(r => r.json()),
        fetch(`${API_BASE}/patients`).then(r => r.json()),
        fetch(`${API_BASE}/timeline`).then(r => r.json()),
        fetch(`${API_BASE}/hospital-capacity`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/bloodbank`).then(r => r.json()).catch(() => null)
      ]);
      setNetworkStatus(resNet);
      setPatients(resPat);
      setIncidentTimeline(resTime);
      if (resCap) {
        setCapacityData(resCap);
      }
      if (resBlood) {
        setBloodBankData(resBlood);
      }

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
          } else if (msg.type === 'CAPACITY_UPDATE') {
            setCapacityData(msg.payload);
          } else if (msg.type === 'BLOODBANK_UPDATE') {
            setBloodBankData(msg.payload);
          } else if (msg.type === 'INIT_STATE') {
            if (msg.payload && msg.payload.capacity) {
              setCapacityData(msg.payload.capacity);
            }
            if (msg.payload && msg.payload.bloodbank) {
              setBloodBankData(msg.payload.bloodbank);
            }
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

  const handleSelectPatient = (id, openModal = true) => {
    setSelectedPatientId(id);
    fetchPatientDetail(id);
    if (openModal) {
      setIsDetailOpen(true);
    }
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

  const handleUpdateCapacity = async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/hospital-capacity/reallocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setCapacityData(data);
        return data;
      }
    } catch (err) {
      console.error('Failed to update capacity:', err);
    }
  };

  const handleBloodBankAction = async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/bloodbank/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setBloodBankData(data);
        return data;
      }
    } catch (err) {
      console.error('Failed blood bank action:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#EFECE6] text-[#1A241C] flex font-mono selection:bg-[#52B788] selection:text-[#FFFFFF]">
      
      {/* ================= LEFT TABLET SIDEBAR ================= */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* ================= MAIN TABLET CONTENT AREA ================= */}
      <div className="flex-1 flex flex-col min-w-0 p-4 md:p-6 max-h-screen overflow-y-auto">
        
        {/* Top Header & Search Bar */}
        <NetworkBar 
          networkStatus={networkStatus} 
          onSimulateNetwork={handleSimulateNetwork} 
          isOnline={wsConnected}
        />

        {/* Tactical Simulator Controls Bar - Neumorphic Extruded Panel */}
        <div className="mb-5 flex items-center justify-between gap-3 flex-wrap nm-flat rounded-2xl p-3 border border-white/80">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-[#556455]">
            <div className="w-6 h-6 rounded-lg nm-inset flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-[#2D6A4F]" />
            </div>
            <span className="text-[#1A241C] tracking-wide font-bold">TACTICAL SIMULATOR:</span>
            <span className="text-[#758475] hidden sm:inline">&bull; EOG DSP &amp; HMAC Telemetry Injection</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap text-xs">
            <button
              onClick={() => handleSimulateGaze({
                patient_id: selectedPatientId || 'PT-101',
                command: 'CALL_NURSE',
                direction: 'CENTER',
                blink_count: 2,
                tampered: false
              })}
              className="nm-btn px-3 py-1.5 rounded-xl text-[#1A241C] hover:text-[#2D6A4F] font-bold flex items-center gap-1.5 transition-all text-xs"
            >
              <HeartPulse className="w-3.5 h-3.5 text-[#2D6A4F]" />
              <span>SIM NURSE CALL</span>
            </button>

            <button
              onClick={() => handleSimulateGaze({
                patient_id: selectedPatientId || 'PT-309',
                command: 'WATER',
                direction: 'LEFT',
                blink_count: 1,
                tampered: true
              })}
              className="nm-alert-inset px-3 py-1.5 rounded-xl text-[#C84B31] font-bold flex items-center gap-1.5 transition-all text-xs border border-[#C84B31]/30 hover:border-[#C84B31]/60"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-[#C84B31]" />
              <span>SIM TAMPERED HMAC</span>
            </button>

            <button
              onClick={handleTriggerOfflineSync}
              className="nm-btn px-3 py-1.5 rounded-xl text-[#556455] hover:text-[#1A241C] font-bold flex items-center gap-1.5 transition-all text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#2D6A4F]" />
              <span>DUPLICATE MED SYNC</span>
            </button>
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === 'overview' && (
          <ClinicalOverview 
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={handleSelectPatient}
            networkStatus={networkStatus}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'capacity' && (
          <HospitalCapacity 
            capacityData={capacityData}
            onUpdateCapacity={handleUpdateCapacity}
            onSelectPatient={(id) => handleSelectPatient(id, true)}
            patients={patients}
            onNavigateTab={setActiveTab}
            bloodBankData={bloodBankData}
          />
        )}

        {activeTab === 'bloodbank' && (
          <BloodBankNetwork 
            bloodBankData={bloodBankData}
            onBloodBankAction={handleBloodBankAction}
            patients={patients}
            onSelectPatient={handleSelectPatient}
          />
        )}

        {activeTab === 'patients' && (
          <PatientsRegistry 
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={handleSelectPatient}
            onOpenChart={(id) => {
              handleSelectPatient(id);
              setIsDetailOpen(true);
            }}
          />
        )}

        {activeTab === 'pharmacy' && (
          <PharmacyNetwork 
            patients={patients}
            onSelectPatient={handleSelectPatient}
          />
        )}

        {activeTab === 'triage' && (
          <div className="h-[calc(100vh-180px)]">
            <HarmRankedQueue 
              patients={patients}
              selectedPatientId={selectedPatientId}
              onSelectPatient={handleSelectPatient}
            />
          </div>
        )}

        {activeTab === 'map' && (
          <div className="h-[calc(100vh-180px)] overflow-hidden border border-[#35353B]">
            <TriageMap 
              patients={patients}
              selectedPatientId={selectedPatientId}
              onSelectPatient={handleSelectPatient}
            />
          </div>
        )}

        {activeTab === 'failover' && (
          <FailoverTinyMLView />
        )}

        {activeTab === 'eog' && (
          <EOGSecurityView />
        )}

        {activeTab === 'cdc' && (
          <CDCPipelineView />
        )}

        {activeTab === 'timeline' && (
          <div className="h-[calc(100vh-180px)]">
            <SyncConflictTimeline 
              timeline={incidentTimeline}
              onTriggerOfflineSync={handleTriggerOfflineSync}
              selectedPatientId={selectedPatientId}
              onFetchTimelineNarrative={handleFetchTimelineNarrative}
            />
          </div>
        )}

        {activeTab === 'reports' && (
          <AIReports 
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={handleSelectPatient}
            onFetchTimelineNarrative={handleFetchTimelineNarrative}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView 
            networkStatus={networkStatus}
            onSimulateNetwork={handleSimulateNetwork}
            onSimulateGaze={handleSimulateGaze}
          />
        )}

      </div>

      {/* ================= REAL-TIME NURSE CALL MODAL ================= */}
      {activeGazeAlert && (
        <EyeGazeAlertModal 
          alert={activeGazeAlert} 
          onClose={() => setActiveGazeAlert(null)}
          onDispatch={(alert) => {
            console.log('Dispatched action for:', alert);
          }}
        />
      )}

      {/* ================= PATIENT DETAIL CLINICAL CHART MODAL ================= */}
      {isDetailOpen && selectedPatientDetail && (
        <PatientDetailModal 
          patient={selectedPatientDetail}
          onClose={() => setIsDetailOpen(false)}
          onSimulateGaze={handleSimulateGaze}
          onReevaluateTriage={() => fetchPatientDetail(selectedPatientId)}
          onRequestBlood={(patId) => {
            setIsDetailOpen(false);
            setSelectedPatientId(patId);
            setActiveTab('bloodbank');
          }}
        />
      )}

    </div>
  );
}
