import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .models import (
    CaseCapsule, 
    TriageEvaluationResponse, 
    NetworkStatus, 
    TimelineIncident,
    BedUnit,
    CriticalResource,
    HospitalCapacityData,
    CapacityUpdateRequest,
    AmbulanceUnit,
    ReceivingHospital,
    DispatchMilestones,
    RouteTelemetry,
    DispatchMission,
    AmbulanceDispatchData,
    DispatchActionRequest
)
from .prompt_engine import evaluate_clinical_triage, calculate_clinical_metrics
from .engine import merge_engine
from .network_engine import network_engine
from .mock_generator import seed_initial_mock_data
from .security import sign_capsule, verify_capsule

# Clubbed Subsystem Engines
from core.failover.engine import FailoverEngine
from core.failover.models import PortId
from ml.network_anomaly.inference import AnomalyInferenceWrapper
from sensors.eog_dsp.pipeline import EOGDSPPipeline
from sensors.eog_dsp.simulator import EOGSimulator
try:
    from security.capsule.delta import DeltaEncoder, DEFAULT_BASELINE
except (ImportError, ModuleNotFoundError):
    import sys
    from pathlib import Path
    _repo_root = str(Path(__file__).resolve().parents[2])
    if _repo_root in sys.path:
        sys.path.remove(_repo_root)
    sys.path.insert(0, _repo_root)
    if "security" in sys.modules and not hasattr(sys.modules["security"], "capsule"):
        del sys.modules["security"]
    from security.capsule.delta import DeltaEncoder, DEFAULT_BASELINE

# Subsystem singletons
failover_engine = FailoverEngine()
tinyml_wrapper = AnomalyInferenceWrapper()
eog_pipeline = EOGDSPPipeline()
eog_simulator = EOGSimulator()
delta_encoder = DeltaEncoder(DEFAULT_BASELINE)

security_audit_stats = {
    "verified_count": 142,
    "tampered_count": 3,
    "total_full_bytes": 145000,
    "total_delta_bytes": 18850,
    "bandwidth_savings_pct": 87.0
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_initial_mock_data()
    try:
        failover_engine.start()
    except Exception as e:
        print(f"Warning starting failover_engine: {e}")
    ticker_task = asyncio.create_task(telemetry_ticker())
    yield
    ticker_task.cancel()
    try:
        failover_engine.stop()
    except Exception:
        pass

app = FastAPI(
    title="Kshitij Unified Clinical & Telemetry Command Service",
    description="Python service receiving incoming real-time and queued offline Case Capsules via WebSockets/REST with deduplication, conflict resolution, Nirantara clinical AI synthesis, Dual-Port TinyML Failover, and EOG DSP.",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_websockets: List[WebSocket] = []

# Subsystem singletons
failover_engine = FailoverEngine()
tinyml_wrapper = AnomalyInferenceWrapper()
eog_pipeline = EOGDSPPipeline()
eog_simulator = EOGSimulator()
delta_encoder = DeltaEncoder(DEFAULT_BASELINE)

security_audit_stats = {
    "verified_count": 142,
    "tampered_count": 3,
    "total_full_bytes": 145000,
    "total_delta_bytes": 18850,
    "bandwidth_savings_pct": 87.0
}

async def broadcast_ws(event_type: str, data: Any):
    payload = json.dumps({"type": event_type, "payload": data})
    disconnected = []
    for ws in active_websockets:
        try:
            await ws.send_text(payload)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in active_websockets:
            active_websockets.remove(ws)

hospital_capacity_state = HospitalCapacityData(
    facility_name="Forward Surgical Team Alpha (FST-A)",
    operational_status="SURGE_ELEVATED",
    occupancy_pct=78.5,
    rationing_mode=False,
    resupply_drone_eta_mins=45,
    bed_units=[
        BedUnit(
            unit_id="ICU-CC",
            unit_name="Intensive Care & Resuscitation",
            category="ICU",
            total_beds=12,
            occupied_beds=10,
            ventilators_total=10,
            ventilators_active=8,
            critical_reserve=2
        ),
        BedUnit(
            unit_id="TRAUMA-BAY",
            unit_name="Acute Trauma Resuscitation Bays",
            category="TRAUMA_RESUS",
            total_beds=6,
            occupied_beds=5,
            ventilators_total=6,
            ventilators_active=4,
            critical_reserve=1
        ),
        BedUnit(
            unit_id="STEP-DOWN",
            unit_name="Intermediate & Step-Down Ward",
            category="STEP_DOWN",
            total_beds=24,
            occupied_beds=18,
            ventilators_total=4,
            ventilators_active=2,
            critical_reserve=4
        ),
        BedUnit(
            unit_id="AUSTERE-LITTER",
            unit_name="Austere Surge & Field Holding Litters",
            category="AUSTERE_SURGE",
            total_beds=30,
            occupied_beds=22,
            ventilators_total=2,
            ventilators_active=1,
            critical_reserve=6
        ),
    ],
    critical_resources=[
        CriticalResource(
            resource_id="O2-LIQUID",
            name="Medical Oxygen (LOX & Concentrators)",
            category="OXYGEN",
            current_level=860.0,
            max_capacity=1200.0,
            unit="Liters",
            burn_rate_per_hour=48.0,
            hours_remaining=17.9,
            status="NOMINAL"
        ),
        CriticalResource(
            resource_id="BLOOD-ONEG",
            name="O-Negative Packed RBCs (Universal)",
            category="BLOOD_BANK",
            current_level=7.0,
            max_capacity=20.0,
            unit="Units",
            burn_rate_per_hour=0.8,
            hours_remaining=8.75,
            status="CRITICAL_RATIONING"
        ),
        CriticalResource(
            resource_id="BLOOD-OPOS",
            name="O-Positive Packed RBCs",
            category="BLOOD_BANK",
            current_level=14.0,
            max_capacity=25.0,
            unit="Units",
            burn_rate_per_hour=0.5,
            hours_remaining=28.0,
            status="NOMINAL"
        ),
        CriticalResource(
            resource_id="BLOOD-PLASMA",
            name="Fresh Frozen Plasma & Platelets",
            category="BLOOD_BANK",
            current_level=11.0,
            max_capacity=24.0,
            unit="Units",
            burn_rate_per_hour=0.6,
            hours_remaining=18.3,
            status="ELEVATED_BURN"
        ),
        CriticalResource(
            resource_id="MED-TXA",
            name="Tranexamic Acid (TXA 1g IV)",
            category="MEDICATIONS",
            current_level=28.0,
            max_capacity=50.0,
            unit="Vials",
            burn_rate_per_hour=1.2,
            hours_remaining=23.3,
            status="NOMINAL"
        ),
        CriticalResource(
            resource_id="MED-KETAMINE",
            name="Ketamine HCL (50mg/mL)",
            category="MEDICATIONS",
            current_level=62.0,
            max_capacity=100.0,
            unit="Vials",
            burn_rate_per_hour=2.0,
            hours_remaining=31.0,
            status="NOMINAL"
        ),
        CriticalResource(
            resource_id="MED-MORPHINE",
            name="Morphine Sulfate (10mg/mL)",
            category="MEDICATIONS",
            current_level=38.0,
            max_capacity=80.0,
            unit="Ampules",
            burn_rate_per_hour=1.5,
            hours_remaining=25.3,
            status="NOMINAL"
        ),
        CriticalResource(
            resource_id="FLUID-LR",
            name="Ringer's Lactate Crystalloid",
            category="IV_FLUIDS",
            current_level=115.0,
            max_capacity=200.0,
            unit="Liters",
            burn_rate_per_hour=4.5,
            hours_remaining=25.5,
            status="NOMINAL"
        ),
        CriticalResource(
            resource_id="SURG-MARCH",
            name="MARCH Hemorrhage Trauma Packs",
            category="SURGICAL_KITS",
            current_level=18.0,
            max_capacity=30.0,
            unit="Kits",
            burn_rate_per_hour=0.9,
            hours_remaining=20.0,
            status="NOMINAL"
        ),
        CriticalResource(
            resource_id="SURG-CHEST",
            name="Thoracostomy & Chest Tube Kits",
            category="SURGICAL_KITS",
            current_level=8.0,
            max_capacity=15.0,
            unit="Kits",
            burn_rate_per_hour=0.4,
            hours_remaining=20.0,
            status="NOMINAL"
        ),
    ]
)

ambulance_dispatch_state = AmbulanceDispatchData(
    system_status="OPERATIONAL",
    gps_satellite_lock="LOCK_OPTIMAL",
    ambulances=[
        AmbulanceUnit(
            unit_id="MEDEVAC-01",
            callsign="Medic-1 (ALS)",
            type="ALS",
            status="TRANSPORTING",
            gps_lat=28.6150,
            gps_lng=77.2100,
            heading_deg=35.0,
            speed_kmh=54.0,
            crew="Paramedic Sharma, EMT Nair",
            equipment=["Transport Vent", "Defibrillator", "TXA", "Whole Blood"],
            assigned_patient_id="PT-101",
            assigned_hospital_id="FST-ALPHA",
            battery_or_fuel_pct=88,
            gps_quality="HIGH"
        ),
        AmbulanceUnit(
            unit_id="MEDEVAC-02",
            callsign="Rescue-2 (CCT)",
            type="CCT",
            status="DISPATCHED",
            gps_lat=28.6220,
            gps_lng=77.2140,
            heading_deg=110.0,
            speed_kmh=42.0,
            crew="Flight Nurse Roy, Paramedic Das",
            equipment=["Dual IV Pumps", "ECMO Standby", "Burn Debridement Kit"],
            assigned_patient_id="PT-204",
            assigned_hospital_id="BASE-HOSP-03",
            battery_or_fuel_pct=95,
            gps_quality="HIGH"
        ),
        AmbulanceUnit(
            unit_id="MEDEVAC-03",
            callsign="Rough-3 (Austere)",
            type="TACTICAL_4X4",
            status="AVAILABLE",
            gps_lat=28.6080,
            gps_lng=77.2020,
            heading_deg=0.0,
            speed_kmh=0.0,
            crew="Combat Medic Sgt. Khan, Driver Cpl. Joshi",
            equipment=["MARCH Trauma Kit", "Litter Bracket", "O2 Concentrator"],
            assigned_patient_id=None,
            assigned_hospital_id=None,
            battery_or_fuel_pct=91,
            gps_quality="HIGH"
        ),
        AmbulanceUnit(
            unit_id="MEDEVAC-04",
            callsign="Rapid-4 (BLS)",
            type="BLS",
            status="AVAILABLE",
            gps_lat=28.6320,
            gps_lng=77.2180,
            heading_deg=0.0,
            speed_kmh=0.0,
            crew="EMT Wilson, EMT Kapoor",
            equipment=["AED", "Splinting Set", "O2 Therapy"],
            assigned_patient_id=None,
            assigned_hospital_id=None,
            battery_or_fuel_pct=100,
            gps_quality="HIGH"
        )
    ],
    hospitals=[
        ReceivingHospital(
            hospital_id="FST-ALPHA",
            name="Forward Surgical Team Alpha (FST-A)",
            gps_lat=28.6139,
            gps_lng=77.2090,
            trauma_level="LEVEL_1",
            icu_beds_free=2,
            trauma_bays_free=1,
            total_occupancy_pct=76.4,
            accepting_status="ACCEPTING_ALL",
            distance_km=2.1,
            travel_time_mins=6,
            delay_factor_mins=0,
            specialties=["Damage Control Resus", "Vascular Shunt", "Whole Blood"],
            recommendation_tier="RECOMMENDED",
            logistics_rationale="Fastest transit time (<7m) with immediate damage control surgical bay free."
        ),
        ReceivingHospital(
            hospital_id="BASE-HOSP-03",
            name="Base General Hospital 3 (Apex Trauma)",
            gps_lat=28.6380,
            gps_lng=77.2250,
            trauma_level="LEVEL_1",
            icu_beds_free=9,
            trauma_bays_free=4,
            total_occupancy_pct=54.0,
            accepting_status="ACCEPTING_ALL",
            distance_km=4.8,
            travel_time_mins=12,
            delay_factor_mins=0,
            specialties=["Comprehensive Neurosurgery", "Burn ICU", "Orthopedic Reconstruction"],
            recommendation_tier="RECOMMENDED",
            logistics_rationale="Optimal ICU capacity buffer (9 open beds) and specialized burn & trauma center."
        ),
        ReceivingHospital(
            hospital_id="CIVIL-ZONE-B",
            name="Cantonment Field Infirmary (Zone Bravo)",
            gps_lat=28.5950,
            gps_lng=77.1850,
            trauma_level="LEVEL_2",
            icu_beds_free=0,
            trauma_bays_free=1,
            total_occupancy_pct=91.5,
            accepting_status="DIVERT_OVERCAPACITY",
            distance_km=6.9,
            travel_time_mins=19,
            delay_factor_mins=0,
            specialties=["Basic Resuscitation", "Holding Ward"],
            recommendation_tier="DIVERT",
            logistics_rationale="ICU bed capacity exhausted (0 available). Advisory recommends divert to FST-Alpha or Base-3."
        )
    ],
    missions=[
        DispatchMission(
            mission_id="MSN-2026-081",
            ambulance_id="MEDEVAC-01",
            patient_id="PT-101",
            patient_name="Sgt. Marcus Vance",
            clinical_urgency="IMMEDIATE_RED",
            recommended_hospital_id="FST-ALPHA",
            assigned_hospital_id="FST-ALPHA",
            stage="TRANSPORTING",
            milestones=DispatchMilestones(
                dispatched_at="10:41",
                en_route_at="10:43",
                on_scene_at="10:48",
                patient_loaded_at="10:53",
                hospital_arrived_at="ETA 11:02"
            ),
            route=RouteTelemetry(
                route_name="Central Tactical Corridor NH-44",
                status="NOMINAL",
                estimated_arrival_eta_mins=7,
                delay_added_mins=0,
                waypoints=[[28.6189, 77.2050], [28.6170, 77.2075], [28.6150, 77.2100], [28.6139, 77.2090]]
            ),
            fallback_active=False,
            routing_advisory="LOGISTICS ROUTING: Route clear on NH-44. Transit to FST-Alpha optimal due to rapid proximity (<7m) and available emergency resuscitation bay. Clinical urgency handled independently by tactical triage protocol."
        ),
        DispatchMission(
            mission_id="MSN-2026-082",
            ambulance_id="MEDEVAC-02",
            patient_id="PT-204",
            patient_name="Cpl. David Chen",
            clinical_urgency="DELAYED_YELLOW",
            recommended_hospital_id="BASE-HOSP-03",
            assigned_hospital_id="BASE-HOSP-03",
            stage="DISPATCHED",
            milestones=DispatchMilestones(
                dispatched_at="10:52",
                en_route_at="10:54",
                on_scene_at="ETA 11:03",
                patient_loaded_at=None,
                hospital_arrived_at="ETA 11:22"
            ),
            route=RouteTelemetry(
                route_name="North Ring Express",
                status="DELAYED_CONGESTION",
                estimated_arrival_eta_mins=18,
                delay_added_mins=5,
                route_change_reason="Congestion at Northern Junction 3 — Rerouted via Ring Expressway (+5 mins)",
                waypoints=[[28.6320, 77.2180], [28.6270, 77.2160], [28.6220, 77.2140], [28.6250, 77.2180], [28.6380, 77.2250]]
            ),
            fallback_active=False,
            routing_advisory="LOGISTICS ROUTING: Base Hospital 3 selected for specialized burn care capability and 9 free ICU beds despite +5m traffic detour. Priority routing approved on express perimeter."
        )
    ],
    fallback_protocol_enabled=False
)


async def telemetry_ticker():
    while True:
        try:
            status = network_engine.get_status()
            await broadcast_ws("NETWORK_TICK", status.model_dump())
            
            # Broadcast dual-port failover telemetry
            fo_status = failover_engine.get_system_status()
            await broadcast_ws("FAILOVER_TICK", fo_status)
        except Exception:
            pass
        await asyncio.sleep(1.0)

# --- REST Endpoints ---

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Kshitij Sync & Merge Engine",
        "version": "1.1.0"
    }

@app.post("/api/capsule")
async def ingest_capsule_endpoint(capsule: CaseCapsule):
    """
    Ingests real-time or offline queued Case Capsule:
    - Runs HMAC verification
    - Performs delta merge and deduplication
    - Detects conflicts (e.g. duplicate medication)
    - Broadcasts to React dashboard via WebSockets
    """
    updated_baseline, new_incidents = merge_engine.ingest_capsule(capsule)
    
    await broadcast_ws("CAPSULE_UPDATE", {
        "capsule": updated_baseline.model_dump(),
        "incidents": [inc.model_dump() for inc in new_incidents]
    })

    if capsule.eye_gaze and capsule.eye_gaze.command:
        await broadcast_ws("EYE_GAZE_ALERT", {
            "patient_id": capsule.patient_id,
            "patient_name": updated_baseline.patient_name,
            "eye_gaze": capsule.eye_gaze.model_dump(),
            "verification_status": capsule.verification_status,
            "time_to_help": capsule.time_to_help
        })

    return {
        "status": "ingested",
        "verification_status": capsule.verification_status,
        "patient": updated_baseline,
        "new_incidents": new_incidents
    }

@app.post("/api/triage", response_model=TriageEvaluationResponse)
async def evaluate_triage_endpoint(capsule: CaseCapsule):
    evaluation = await evaluate_clinical_triage(capsule)
    return evaluation

@app.get("/api/patients")
async def get_all_patients():
    """
    Harm-Ranked Queue: Returns active patients sorted by calculated priority_score descending.
    """
    patients = merge_engine.get_all_patients()
    evaluated_list = []
    for p in patients:
        metrics = calculate_clinical_metrics(p)
        score = metrics["priority_score"]
        
        if score >= 15.0 or p.vitals.spo2 < 88 or "hemorrhage" in [f.lower() for f in p.red_flags]:
            badge = "RED"
        elif score >= 5.0 or metrics["severity"] >= 3.5:
            badge = "YELLOW"
        else:
            badge = "GREEN"

        evaluated_list.append({
            "capsule": p.model_dump(),
            "metrics": metrics,
            "priority_score": score,
            "triage_badge": badge
        })

    evaluated_list.sort(key=lambda x: x["priority_score"], reverse=True)
    return evaluated_list

@app.get("/api/patients/{patient_id}")
async def get_patient_detail(patient_id: str):
    capsule = merge_engine.get_patient(patient_id)
    if not capsule:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    evaluation = await evaluate_clinical_triage(capsule)
    return {
        "capsule": capsule,
        "evaluation": evaluation
    }

@app.get("/api/timeline", response_model=List[TimelineIncident])
def get_incident_timeline(limit: int = 40):
    return merge_engine.get_timeline(limit=limit)

@app.get("/api/timeline/summary/{patient_id}")
async def get_timeline_narrative(patient_id: str):
    narrative = await merge_engine.generate_llm_timeline_narrative(patient_id)
    return {"patient_id": patient_id, "timeline_summary": narrative}

@app.get("/api/network-state", response_model=NetworkStatus)
def get_network_state():
    return network_engine.get_status()

class NetworkSimulateRequest(BaseModel):
    scenario: str # 'PORT_A_FAILURE', 'TOTAL_DISCONNECT', 'RESTORE_HEALTHY'

@app.post("/api/network-state/simulate")
async def simulate_network_event(req: NetworkSimulateRequest):
    network_engine.inject_network_degradation(req.scenario)
    new_status = network_engine.get_status()
    await broadcast_ws("NETWORK_TICK", new_status.model_dump())
    return new_status

class GazeSimulateRequest(BaseModel):
    patient_id: str
    command: str
    direction: Optional[str] = "CENTER"
    blink_count: Optional[int] = 2
    tampered: Optional[bool] = False

@app.post("/api/simulate-gaze")
async def simulate_gaze_event(req: GazeSimulateRequest):
    capsule = merge_engine.get_patient(req.patient_id)
    if not capsule:
        raise HTTPException(status_code=404, detail="Patient not found")

    import time
    capsule_dict = capsule.model_dump()
    capsule_dict["eye_gaze"] = {
        "command": req.command,
        "direction": req.direction,
        "blink_count": req.blink_count,
        "timestamp": time.time()
    }
    
    if req.tampered:
        capsule_dict["hmac_signature"] = "tampered_compromised_hash_000000"
    else:
        capsule_dict = sign_capsule(capsule_dict)

    updated_capsule = CaseCapsule(**capsule_dict)
    merge_engine.ingest_capsule(updated_capsule)

    await broadcast_ws("EYE_GAZE_ALERT", {
        "patient_id": updated_capsule.patient_id,
        "patient_name": updated_capsule.patient_name,
        "eye_gaze": updated_capsule.eye_gaze.model_dump(),
        "verification_status": updated_capsule.verification_status,
        "time_to_help": updated_capsule.time_to_help
    })

    return {"status": "simulated", "verification_status": updated_capsule.verification_status}

# --- Clubbed Dual-Port Failover & TinyML Endpoints ---

@app.get("/api/failover/status")
def get_failover_status():
    """Returns real-time status of Dual-Port failover engine, active path, and 8D telemetry vector."""
    return failover_engine.get_system_status()

class FailoverPresetRequest(BaseModel):
    preset: str # 'NORMAL', 'WARNING', 'FAILOVER', 'MESH', 'RECOVER'

@app.post("/api/failover/preset")
def trigger_failover_preset(req: FailoverPresetRequest):
    preset = req.preset.upper()
    if preset == "NORMAL" or preset == "RECOVER":
        failover_engine.clear_degradation()
    elif preset == "WARNING":
        failover_engine.inject_network_degradation(
            port=PortId.PORT_A,
            duration_sec=30.0,
            latency_spike_ms=180.0,
            packet_loss_spike_pct=12.0,
            jitter_spike_ms=15.0
        )
    elif preset == "FAILOVER":
        failover_engine.inject_network_degradation(
            port=PortId.PORT_A,
            duration_sec=30.0,
            latency_spike_ms=350.0,
            packet_loss_spike_pct=45.0,
            jitter_spike_ms=30.0
        )
    elif preset == "MESH":
        failover_engine.inject_network_degradation(
            port=PortId.BOTH,
            duration_sec=30.0,
            latency_spike_ms=450.0,
            packet_loss_spike_pct=60.0,
            jitter_spike_ms=50.0
        )
    return failover_engine.get_system_status()

@app.get("/api/failover/events")
def get_failover_events():
    return failover_engine.get_event_history()

@app.get("/api/tinyml/status")
def get_tinyml_status():
    """TinyML INT8 deployment status on NXP FRDM-MCXN236 with OLED Bridge metrics."""
    return {
        "model_name": "Nirantara INT8 Quantized Anomaly Classifier",
        "framework": "TensorFlow Lite Micro (TFLM)",
        "quantization": "Full INT8 (Post-Training Quantized)",
        "input_dimensions": "4D [Latency_ms, Jitter_ms, PacketLoss_pct, DNSTime_ms]",
        "output_classes": ["HEALTHY", "DEGRADED", "CRITICAL"],
        "target_hardware": "NXP FRDM-MCXN236 Dual Cortex-M33 (150 MHz)",
        "inference_latency_ms": 0.0135,
        "accuracy_score": 0.9992,
        "ram_arena_bytes": 4280,
        "flash_footprint_bytes": 18400,
        "oled_bridge": {
            "status": "ONLINE",
            "port": "J8 I2C Header (P4_1 / P4_0)",
            "baud": 115200,
            "display": "SSD1306 128x64 OLED",
            "mcuboot_status": "AUTHENTICATED_SLOT_0"
        }
    }

class TinyMLPredictRequest(BaseModel):
    latency_ms: float = 25.0
    jitter_ms: float = 2.0
    packet_loss_pct: float = 0.1
    dns_time_ms: float = 12.0

@app.post("/api/tinyml/predict")
def predict_tinyml_anomaly(req: TinyMLPredictRequest):
    pred = tinyml_wrapper.predict(
        latency_ms=req.latency_ms,
        jitter_ms=req.jitter_ms,
        packet_loss_pct=req.packet_loss_pct,
        dns_time_ms=req.dns_time_ms
    )
    return pred.model_dump()

# --- Clubbed EOG DSP & Security Endpoints ---

@app.get("/api/eog/status")
def get_eog_dsp_status():
    return {
        "dsp_filter": "4th-Order IIR Butterworth (0.1 Hz – 10.0 Hz)",
        "sampling_rate_hz": 100.0,
        "channels": ["Vertical (Blink Biopotentials)", "Horizontal (Saccadic Gaze Steps)"],
        "blink_window_ms": "100ms - 400ms duration",
        "command_map": {
            "2_BLINKS": "CALL_NURSE",
            "3_BLINKS": "PAIN",
            "LEFT_1_BLINK": "WATER",
            "RIGHT_1_BLINK": "BATHROOM"
        },
        "stream_active": True
    }

@app.get("/api/eog/live-batch")
def get_eog_live_batch(scenario: str = "nurse"):
    """
    Generates and processes a 50-sample batch of 100Hz EOG biopotentials
    for smooth real-time oscilloscope visualization.
    """
    if scenario == "pain":
        samples = eog_simulator.generate_scenario_pain(duration_s=1.0)
    elif scenario == "water":
        samples = eog_simulator.generate_scenario_water(duration_s=1.0)
    elif scenario == "bathroom":
        samples = eog_simulator.generate_scenario_bathroom(duration_s=1.0)
    else:
        samples = eog_simulator.generate_scenario_nurse(duration_s=1.0)

    frames = []
    for s in samples[:50]:
        processed = eog_pipeline.process_sample(s.timestamp_s, s.raw_vertical_uv, s.raw_horizontal_uv)
        frames.append({
            "timestamp": s.timestamp_s,
            "raw_vertical": round(s.raw_vertical_uv, 2),
            "raw_horizontal": round(s.raw_horizontal_uv, 2),
            "filtered_vertical": round(processed.filtered_vertical_uv, 2),
            "filtered_horizontal": round(processed.filtered_horizontal_uv, 2),
            "gaze": processed.gaze.value,
            "command": processed.command.command if processed.command else None
        })

    return {
        "scenario": scenario,
        "sample_count": len(frames),
        "frames": frames
    }

@app.get("/api/security/stats")
def get_security_and_delta_stats():
    return security_audit_stats

class ChaosInjectRequest(BaseModel):
    action: str # 'CUT_PORT_A', 'BURST_JITTER', 'PACKET_LOSS_STORM', 'TAMPER_HMAC', 'REPLAY_MEDICATION', 'EOG_DISTRESS', 'RESET_ALL'

@app.post("/api/chaos/inject")
async def inject_chaos_scenario(req: ChaosInjectRequest):
    act = req.action.upper()
    message = ""
    
    if act == "CUT_PORT_A":
        failover_engine.inject_network_degradation(
            port=PortId.PORT_A,
            duration_sec=30.0,
            latency_spike_ms=450.0,
            packet_loss_spike_pct=100.0,
            jitter_spike_ms=50.0
        )
        network_engine.inject_network_degradation("PORT_A_FAILURE")
        message = "Port A physical link severed. 500ms failover state machine engaging Port B."
        
    elif act == "BURST_JITTER":
        failover_engine.inject_network_degradation(
            port=PortId.PORT_A,
            duration_sec=20.0,
            latency_spike_ms=220.0,
            packet_loss_spike_pct=15.0,
            jitter_spike_ms=85.0
        )
        message = "High jitter anomaly injected (85ms jitter). TinyML classified as DEGRADED."
        
    elif act == "PACKET_LOSS_STORM":
        failover_engine.inject_network_degradation(
            port=PortId.PORT_A,
            duration_sec=20.0,
            latency_spike_ms=300.0,
            packet_loss_spike_pct=48.0,
            jitter_spike_ms=40.0
        )
        message = "Packet loss storm (48% loss). Triggering Orange Warning / Backup Failover."
        
    elif act == "TAMPER_HMAC":
        security_audit_stats["tampered_count"] += 1
        # Ingest a compromised capsule
        await simulate_gaze_event(GazeSimulateRequest(
            patient_id="PT-101",
            command="CALL_NURSE",
            direction="CENTER",
            blink_count=2,
            tampered=True
        ))
        message = "Compromised HMAC signature injected! Integrity breach flagged across clinical EMR."
        
    elif act == "REPLAY_MEDICATION":
        duplicate_capsule = {
            "patient_id": "PT-101",
            "patient_name": "Sgt. Marcus Vance",
            "time_to_help": 0.4,
            "vitals": {"heart_rate": 138, "spo2": 87, "systolic_bp": 90, "diastolic_bp": 60, "respiratory_rate": 30, "fall_detected": True},
            "medications": [
                {
                    "medication": "Morphine",
                    "dose": "5mg IV",
                    "administered_at": "15:00",
                    "administered_by": "Medic Gamma",
                    "entry_id": f"M_REPLAY_{int(time.time())}"
                }
            ],
            "offline_cached": True,
            "sequence_id": 999
        }
        await ingest_capsule_endpoint(CaseCapsule(**duplicate_capsule))
        message = "Offline cached medication replay injected. Audit timeline conflict logged."
        
    elif act == "EOG_DISTRESS":
        await simulate_gaze_event(GazeSimulateRequest(
            patient_id="PT-101",
            command="CALL_NURSE",
            direction="CENTER",
            blink_count=2,
            tampered=False
        ))
        message = "EOG double-blink nurse call distress alert simulated and verified."
        
    elif act == "RESET_ALL":
        failover_engine.clear_degradation()
        network_engine.inject_network_degradation("RESTORE_HEALTHY")
        message = "All subsystems restored to nominal baseline."

    fo_status = failover_engine.get_system_status()
    await broadcast_ws("FAILOVER_TICK", fo_status)
    await broadcast_ws("NETWORK_TICK", network_engine.get_status().model_dump())

    return {
        "action": act,
        "message": message,
        "failover": fo_status,
        "security": security_audit_stats
    }

# --- Hospital Capacity Endpoints ---
@app.get("/api/hospital-capacity", response_model=HospitalCapacityData)
def get_hospital_capacity():
    return hospital_capacity_state

@app.post("/api/hospital-capacity/reallocate")
async def update_hospital_capacity(req: CapacityUpdateRequest):
    import time
    hospital_capacity_state.last_updated = time.time()
    
    if req.action == "TOGGLE_RATIONING":
        if req.rationing_mode is not None:
            hospital_capacity_state.rationing_mode = req.rationing_mode
        else:
            hospital_capacity_state.rationing_mode = not hospital_capacity_state.rationing_mode
        multiplier = 0.65 if hospital_capacity_state.rationing_mode else 1.538
        for res in hospital_capacity_state.critical_resources:
            res.burn_rate_per_hour = round(res.burn_rate_per_hour * multiplier, 2)
            if res.burn_rate_per_hour > 0:
                res.hours_remaining = round(res.current_level / res.burn_rate_per_hour, 1)
        hospital_capacity_state.operational_status = "CRITICAL_RATIONING_PFC" if hospital_capacity_state.rationing_mode else "SURGE_ELEVATED"

    elif req.action == "REQUEST_RESUPPLY":
        hospital_capacity_state.resupply_drone_eta_mins = 25
        for res in hospital_capacity_state.critical_resources:
            if res.status == "CRITICAL_RATIONING" or res.current_level < res.max_capacity * 0.5:
                res.current_level = min(res.max_capacity, res.current_level + 10.0)
                res.status = "NOMINAL"
                if res.burn_rate_per_hour > 0:
                    res.hours_remaining = round(res.current_level / res.burn_rate_per_hour, 1)

    elif req.action == "REALLOCATE_BED" and req.unit_id:
        for unit in hospital_capacity_state.bed_units:
            if unit.unit_id == req.unit_id:
                delta_val = req.delta if req.delta is not None else 1
                unit.occupied_beds = max(0, min(unit.total_beds, int(unit.occupied_beds + delta_val)))

    total_beds = sum(u.total_beds for u in hospital_capacity_state.bed_units)
    total_occupied = sum(u.occupied_beds for u in hospital_capacity_state.bed_units)
    hospital_capacity_state.occupancy_pct = round((total_occupied / total_beds) * 100, 1) if total_beds > 0 else 0.0

    await broadcast_ws("CAPACITY_UPDATE", hospital_capacity_state.model_dump())
    return hospital_capacity_state

@app.get("/api/dispatch", response_model=AmbulanceDispatchData)
def get_ambulance_dispatch_state():
    return ambulance_dispatch_state

@app.post("/api/dispatch/action")
async def handle_dispatch_action(req: DispatchActionRequest):
    import time
    ambulance_dispatch_state.last_updated = time.time()
    now_str = time.strftime("%H:%M")

    if req.action == "ASSIGN_DISPATCH":
        if req.ambulance_id and req.patient_id and req.hospital_id:
            amb = next((a for a in ambulance_dispatch_state.ambulances if a.unit_id == req.ambulance_id), None)
            hosp = next((h for h in ambulance_dispatch_state.hospitals if h.hospital_id == req.hospital_id), None)
            patient = merge_engine.get_patient(req.patient_id)
            patient_name = patient.patient_name if patient else "Field Casualty"
            triage_color = patient.triage_color if patient else "YELLOW"
            urgency_map = {"RED": "IMMEDIATE_RED", "YELLOW": "DELAYED_YELLOW", "GREEN": "MINIMAL_GREEN", "BLACK": "EXPECTANT_BLACK"}
            clinical_urgency = urgency_map.get(triage_color, "DELAYED_YELLOW")

            if amb:
                amb.status = "DISPATCHED"
                amb.assigned_patient_id = req.patient_id
                amb.assigned_hospital_id = req.hospital_id

            existing_mission = next((m for m in ambulance_dispatch_state.missions if m.patient_id == req.patient_id or m.ambulance_id == req.ambulance_id), None)
            if existing_mission:
                existing_mission.ambulance_id = req.ambulance_id
                existing_mission.assigned_hospital_id = req.hospital_id
                existing_mission.stage = "DISPATCHED"
                existing_mission.milestones.dispatched_at = now_str
            else:
                new_msn = DispatchMission(
                    mission_id=f"MSN-{int(time.time()) % 100000}",
                    ambulance_id=req.ambulance_id,
                    patient_id=req.patient_id,
                    patient_name=patient_name,
                    clinical_urgency=clinical_urgency,
                    recommended_hospital_id=req.hospital_id,
                    assigned_hospital_id=req.hospital_id,
                    stage="DISPATCHED",
                    milestones=DispatchMilestones(
                        dispatched_at=now_str,
                        en_route_at=now_str
                    ),
                    route=RouteTelemetry(
                        route_name=f"Tactical Route to {hosp.name if hosp else 'Facility'}",
                        status="NOMINAL",
                        estimated_arrival_eta_mins=hosp.travel_time_mins if hosp else 12,
                        waypoints=[[amb.gps_lat, amb.gps_lng], [hosp.gps_lat, hosp.gps_lng]] if (amb and hosp) else []
                    ),
                    routing_advisory=f"LOGISTICS ROUTING: Assigned based on estimated travel time ({hosp.travel_time_mins if hosp else 10}m) and bed availability. Clinical triage priority is preserved independently."
                )
                ambulance_dispatch_state.missions.append(new_msn)

    elif req.action == "UPDATE_MILESTONE" and req.mission_id and req.next_stage:
        mission = next((m for m in ambulance_dispatch_state.missions if m.mission_id == req.mission_id), None)
        if mission:
            mission.stage = req.next_stage
            amb = next((a for a in ambulance_dispatch_state.ambulances if a.unit_id == mission.ambulance_id), None)
            if req.next_stage == "ON_SCENE":
                mission.milestones.on_scene_at = now_str
                if amb: amb.status = "ON_SCENE"
            elif req.next_stage == "TRANSPORTING":
                mission.milestones.patient_loaded_at = now_str
                if amb: amb.status = "TRANSPORTING"
            elif req.next_stage == "ARRIVED":
                mission.milestones.hospital_arrived_at = now_str
                if amb:
                    amb.status = "AVAILABLE"
                    amb.assigned_patient_id = None
                    amb.assigned_hospital_id = None

    elif req.action == "INJECT_ROUTE_DELAY" and req.mission_id:
        mission = next((m for m in ambulance_dispatch_state.missions if m.mission_id == req.mission_id), None)
        if mission:
            delay = req.delay_minutes if req.delay_minutes is not None else 6
            mission.route.delay_added_mins += delay
            mission.route.estimated_arrival_eta_mins += delay
            mission.route.status = "DETOUR_APPLIED"
            mission.route.route_change_reason = req.route_change_reason or f"Traffic choke point on main sector corridor — Rerouted via alternate artery (+{delay} mins)"

    elif req.action == "TOGGLE_FALLBACK":
        target = not ambulance_dispatch_state.fallback_protocol_enabled if req.fallback_enabled is None else req.fallback_enabled
        ambulance_dispatch_state.fallback_protocol_enabled = target
        ambulance_dispatch_state.gps_satellite_lock = "OFFLINE_FALLBACK" if target else "LOCK_OPTIMAL"
        for a in ambulance_dispatch_state.ambulances:
            a.gps_quality = "LOST_DEAD_RECKONING" if target else "HIGH"
        for m in ambulance_dispatch_state.missions:
            m.fallback_active = target
            if target and not m.fallback_grid_mgrs:
                m.fallback_grid_mgrs = "43R EK 284 195"
                m.fallback_notes = "GPS blackout/jamming detected. Dead-reckoning protocol active; coordinates relayed via tactical VHF radio."

    elif req.action == "UPDATE_MGRS" and req.mission_id and req.mgrs_grid:
        mission = next((m for m in ambulance_dispatch_state.missions if m.mission_id == req.mission_id), None)
        if mission:
            mission.fallback_grid_mgrs = req.mgrs_grid
            mission.fallback_notes = f"Field checkpoint updated via VHF radio: MGRS {req.mgrs_grid}"

    await broadcast_ws("DISPATCH_UPDATE", ambulance_dispatch_state.model_dump())
    return ambulance_dispatch_state

# --- WebSocket Channel ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    try:
        await websocket.send_text(json.dumps({
            "type": "INIT_STATE",
            "payload": {
                "network": network_engine.get_status().model_dump(),
                "patients_count": len(merge_engine.get_all_patients()),
                "capacity": hospital_capacity_state.model_dump(),
                "dispatch": ambulance_dispatch_state.model_dump()
            }
        }))
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if websocket in active_websockets:
            active_websockets.remove(websocket)
    except Exception:
        if websocket in active_websockets:
            active_websockets.remove(websocket)
