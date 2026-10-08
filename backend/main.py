import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.models import (
    CaseCapsule, 
    TriageEvaluationResponse, 
    NetworkStatus, 
    TimelineIncident
)
from backend.prompt_engine import evaluate_clinical_triage, calculate_clinical_metrics
from backend.merge_engine import merge_engine
from backend.network_engine import network_engine
from backend.mock_generator import seed_initial_mock_data
from backend.security import sign_capsule, verify_capsule

app = FastAPI(
    title="Kshitij Clinical Triage & Sync Engine",
    description="Developer 3 Backend: Ollama Llama 3.2 Triage Service, Offline Merge & Telemetry Sync",
    version="1.0.0"
)

# Enable CORS for React frontend (Vite port 5173 / localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connected WebSocket clients
active_websockets: List[WebSocket] = []

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

# Startup seed
@app.on_event("startup")
async def startup_event():
    seed_initial_mock_data()
    # Background task for live telemetry ticks
    asyncio.create_task(telemetry_ticker())

async def telemetry_ticker():
    """Broadcasts network telemetry and live vitals pulse every 1 second"""
    while True:
        try:
            status = network_engine.get_status()
            await broadcast_ws("NETWORK_TICK", status.model_dump())
        except Exception:
            pass
        await asyncio.sleep(1.0)

# --- REST Endpoints ---

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "Kshitij Triage & Merge Engine"}

@app.post("/api/triage", response_model=TriageEvaluationResponse)
async def evaluate_triage_endpoint(capsule: CaseCapsule):
    """
    Prompt 3.1: Accepts Case Capsule, computes delay-aware priority score,
    queries Ollama (or fallback) and returns structured JSON triage instructions.
    """
    evaluation = await evaluate_clinical_triage(capsule)
    return evaluation

@app.post("/api/capsule")
async def ingest_capsule_endpoint(capsule: CaseCapsule):
    """
    Ingests real-time or offline-synced Case Capsule:
    - Runs HMAC verification
    - Performs delta merge and deduplication
    - Detects conflicts (e.g. duplicate medication)
    - Broadcasts to React dashboard via WebSockets
    """
    updated_baseline, new_incidents = merge_engine.ingest_capsule(capsule)
    
    # Broadcast to dashboard
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

@app.get("/api/patients")
async def get_all_patients():
    """
    Harm-Ranked Queue: Returns all active patients with evaluated priority scores,
    sorted in descending harm-priority order (Red > Yellow > Green).
    """
    patients = merge_engine.get_all_patients()
    evaluated_list = []
    for p in patients:
        metrics = calculate_clinical_metrics(p)
        score = metrics["priority_score"]
        
        # Determine quick badge color
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

    # Sort descending by priority_score
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
    command: str # CALL_NURSE, WATER, PAIN, BATHROOM
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

# --- WebSocket Channel ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    # Send initial network and patient state
    try:
        await websocket.send_text(json.dumps({
            "type": "INIT_STATE",
            "payload": {
                "network": network_engine.get_status().model_dump(),
                "patients_count": len(merge_engine.get_all_patients())
            }
        }))
        while True:
            # Keep-alive receive
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if websocket in active_websockets:
            active_websockets.remove(websocket)
    except Exception:
        if websocket in active_websockets:
            active_websockets.remove(websocket)
