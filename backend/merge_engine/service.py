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
    CapacityUpdateRequest
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
                "capacity": hospital_capacity_state.model_dump()
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
