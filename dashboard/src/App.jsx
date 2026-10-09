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
import FailoverTinyMLView from './components/FailoverTinyMLView';
import EOGSecurityView from './components/EOGSecurityView';
import { 
  HeartPulse, ShieldAlert, RefreshCw, 
  Sparkles, Stethoscope, Activity, FileText, Zap, Eye 
} from 'lucide-react';

import mqtt from 'mqtt';
import { connectMQTT } from './mqttService';
import SensorWidgetsGrid, { 
  PulseCard, 
  ForceGauge, 
  BedForceCard, 
  PatientMotionIndicator, 
  RFIDBadge, 
  ActiveRouteMatrixCard 
} from './components/SensorWidgets';

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
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'capacity' | 'patients' | 'triage' | 'map' | 'timeline' | 'reports' | 'settings'
  const [capacityData, setCapacityData] = useState(null);
  const wsRef = useRef(null);

  // MQTT Real-time Sensor State with all 5 telemetry bindings
  const [sensorData, setSensorData] = useState({
    pulse_bpm: 0,
    force_n: 0,
    gyro_z: 0.0,
    mpu_ok: true,
    rfid: 'NONE',
    lat: 12.871773,
    lng: 77.576856,
    pressure_kpa: 101.3,
    temp_c: 36.8,
  });
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  // MQTT Connection Lifecycle - Auto-reconnecting with RAF zero-freeze updates
  useEffect(() => {
    const client = connectMQTT(
      (newData) => {
        setSensorData(prev => ({ ...prev, ...newData }));

        // If an RFID tag is detected, automatically match and select patient
        if (newData.rfid && newData.rfid !== 'NONE' && newData.rfid !== 'NO_TAG') {
          const match = patients.find(p => p.capsule.patient_id === newData.rfid);
          if (match) {
            setSelectedPatientId(match.capsule.patient_id);
          }
        }
      },
      (status) => setConnectionStatus(status)
    );

    return () => {
      if (client && client.end) {
        client.end();
      }
    };
  }, [patients]);

  const fetchAllData = async () => {
    try {
      const [resNet, resPat, resTime, resCap] = await Promise.all([
        fetch(`${API_BASE}/network-state`).then(r => r.json()),
        fetch(`${API_BASE}/patients`).then(r => r.json()),
        fetch(`${API_BASE}/timeline`).then(r => r.json()),
        fetch(`${API_BASE}/hospital-capacity`).then(r => r.json()).catch(() => null)
      ]);
      setNetworkStatus(resNet);
      setPatients(resPat);
      setIncidentTimeline(resTime);
      if (resCap) {
        setCapacityData(resCap);
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
          } else if (msg.type === 'INIT_STATE') {
            if (msg.payload && msg.payload.capacity) {
              setCapacityData(msg.payload.capacity);
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

  return (
    <div className="min-h-screen bg-[#eef2f7] flex font-sans selection:bg-blue-500 selection:text-white">
      
      {/* ================= LEFT TABLET SIDEBAR ================= */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* ================= MAIN TABLET CONTENT AREA ================= */}
      <div className="flex-1 flex flex-col min-w-0 p-5 md:p-8 max-h-screen overflow-y-auto">
        
        {/* Top Header & Search Bar with Network and MQTT status */}
        <NetworkBar 
          networkStatus={networkStatus} 
          onSimulateNetwork={handleSimulateNetwork} 
          isOnline={wsConnected}
          mqttStatus={connectionStatus}
        />

        {/* Real-Time MQTT Sensors Telemetry Widget Grid */}
        <SensorWidgetsGrid 
          sensorData={sensorData} 
          connectionStatus={connectionStatus}
          networkStatus={networkStatus}
        />

        {/* Demo Quick Simulator Pills */}
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap bg-white/70 backdrop-blur-md p-2.5 px-4 rounded-2xl border border-slate-200/60 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Interactive Simulator:</span>
            <span className="text-slate-400 font-normal hidden sm:inline">&bull; Test EOG & HMAC streams</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleSimulateGaze({
                patient_id: selectedPatientId || 'PT-101',
                command: 'CALL_NURSE',
                direction: 'CENTER',
                blink_count: 2,
                tampered: false
              })}
              className="px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <HeartPulse className="w-3.5 h-3.5" />
              <span>Simulate Nurse Call (Verified)</span>
            </button>

            <button
              onClick={() => handleSimulateGaze({
                patient_id: selectedPatientId || 'PT-309',
                command: 'WATER',
                direction: 'LEFT',
                blink_count: 1,
                tampered: true
              })}
              className="px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Simulate Tampered HMAC</span>
            </button>

            <button
              onClick={handleTriggerOfflineSync}
              className="px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Duplicate Med Sync</span>
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
            sensorData={sensorData}
          />
        )}

        {activeTab === 'capacity' && (
          <HospitalCapacity 
            capacityData={capacityData}
            onUpdateCapacity={handleUpdateCapacity}
            onSelectPatient={(id) => handleSelectPatient(id, true)}
            patients={patients}
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
          <div className="h-[calc(100vh-180px)] rounded-3xl overflow-hidden border border-slate-200 shadow-lg">
            <TriageMap 
              patients={patients}
              selectedPatientId={selectedPatientId}
              onSelectPatient={handleSelectPatient}
              sensorData={sensorData}
            />
          </div>
        )}

        {activeTab === 'failover' && (
          <FailoverTinyMLView />
        )}

        {activeTab === 'eog' && (
          <EOGSecurityView />
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
        />
      )}

    </div>
  );
}
