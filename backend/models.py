from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field
import time

class Vitals(BaseModel):
    heart_rate: Optional[float] = Field(default=80.0, description="Heart rate in BPM")
    spo2: Optional[float] = Field(default=98.0, description="Oxygen saturation %")
    systolic_bp: Optional[float] = Field(default=120.0, description="Systolic Blood Pressure")
    diastolic_bp: Optional[float] = Field(default=80.0, description="Diastolic Blood Pressure")
    respiratory_rate: Optional[float] = Field(default=16.0, description="Breaths per minute")
    temperature: Optional[float] = Field(default=37.0, description="Body temp in Celsius")
    fall_detected: bool = Field(default=False, description="Whether fall detection triggered")

class EyeGaze(BaseModel):
    command: Optional[str] = Field(default=None, description="EOG command: CALL_NURSE, PAIN, WATER, BATHROOM")
    direction: Optional[str] = Field(default="CENTER", description="Gaze direction: LEFT, RIGHT, CENTER")
    blink_count: Optional[int] = Field(default=0, description="Blink count in window")
    timestamp: Optional[float] = Field(default_factory=time.time)

class GPSLocation(BaseModel):
    lat: float = Field(default=28.6139, description="Latitude")
    lng: float = Field(default=77.2090, description="Longitude")
    altitude: Optional[float] = Field(default=216.0, description="Altitude in meters")

class MedicationEntry(BaseModel):
    medication: str
    dose: str
    administered_at: str
    administered_by: str
    entry_id: Optional[str] = None

class CaseCapsule(BaseModel):
    patient_id: str = Field(..., description="Unique patient identifier, e.g. PT-101")
    patient_name: Optional[str] = Field(default="Anonymous Operative")
    timestamp: float = Field(default_factory=time.time)
    time_to_help: float = Field(default=0.5, description="Time to nearest definitive help in hours (e.g. 0.5 = 30m, 24 = 24h)")
    vitals: Vitals = Field(default_factory=Vitals)
    red_flags: List[str] = Field(default_factory=list, description="Clinical red flags, e.g. tension_pneumothorax, hypovolemia")
    eye_gaze: Optional[EyeGaze] = None
    medications: List[MedicationEntry] = Field(default_factory=list)
    gps: GPSLocation = Field(default_factory=GPSLocation)
    triage_color: Optional[str] = Field(default="YELLOW", description="GREEN, YELLOW, RED, BLACK")
    delta_fields: Optional[List[str]] = Field(default_factory=list)
    offline_cached: bool = Field(default=False)
    sequence_id: int = Field(default=1)
    hmac_signature: Optional[str] = None
    verification_status: str = Field(default="UNVERIFIED", description="VERIFIED, TAMPERED, UNVERIFIED")

class TriageEvaluationResponse(BaseModel):
    patient_id: str
    priority_score: float = Field(..., description="Calculated harm-priority score")
    triage_level: str = Field(..., description="IMMEDIATE_RED, DELAYED_YELLOW, MINIMAL_GREEN, EXPECTANT_BLACK")
    protocol_mode: str = Field(..., description="ACUTE_STABILIZATION, PROLONGED_FIELD_CARE, TACTICAL_STANDARD")
    clinical_summary: str
    action_steps: List[str]
    red_flag_triggers: List[str] = Field(default_factory=list)
    rationing_guidelines: List[str] = Field(default_factory=list)
    evaluation_source: str = Field(default="ollama:llama3.2:3b")

class NetworkTelemetry(BaseModel):
    port_name: str
    latency_ms: float
    jitter_ms: float
    packet_loss_pct: float
    dns_time_ms: float

class NetworkStatus(BaseModel):
    active_state: str = Field(default="PORT_A_ACTIVE", description="PORT_A_ACTIVE, PORT_B_ACTIVE, STATE_WARNING, MESH_ACTIVE")
    port_a: NetworkTelemetry
    port_b: NetworkTelemetry
    degradation_score: float = 0.12
    last_switch: str = "Init"
    mesh_nodes_online: int = 4

class TimelineIncident(BaseModel):
    id: str
    timestamp: str
    patient_id: str
    category: str # 'VITALS_CRITICAL', 'MEDICATION_ADMIN', 'CONFLICT_RESOLVED', 'EYE_GAZE_ALERT', 'TRIAGE_UPDATE'
    title: str
    details: str
    conflict_detected: bool = False
    resolution: Optional[str] = None
