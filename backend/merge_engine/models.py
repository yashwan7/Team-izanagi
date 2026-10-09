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
    lat: float = Field(default=12.871773, description="Latitude")
    lng: float = Field(default=77.576856, description="Longitude")
    altitude: Optional[float] = Field(default=920.0, description="Altitude in meters")

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
    evaluation_source: str = Field(default="nirantara:clinical-3b")

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
    category: str # 'VITALS_CRITICAL', 'MEDICATION_ADMIN', 'CONFLICT_RESOLVED', 'EYE_GAZE_ALERT', 'SECURITY_ALERT', 'SYNC_DEDUPLICATION'
    title: str
    details: str
    conflict_detected: bool = False
    resolution: Optional[str] = None

class BedUnit(BaseModel):
    unit_id: str
    unit_name: str
    category: str # "ICU", "TRAUMA_RESUS", "STEP_DOWN", "AUSTERE_SURGE"
    total_beds: int
    occupied_beds: int
    ventilators_total: int
    ventilators_active: int
    critical_reserve: int

class CriticalResource(BaseModel):
    resource_id: str
    name: str
    category: str # "OXYGEN", "BLOOD_BANK", "MEDICATIONS", "SURGICAL_KITS", "IV_FLUIDS"
    current_level: float
    max_capacity: float
    unit: str
    burn_rate_per_hour: float
    hours_remaining: float
    status: str # "NOMINAL", "ELEVATED_BURN", "CRITICAL_RATIONING"

class HospitalCapacityData(BaseModel):
    facility_name: str = "Forward Surgical Team Alpha (FST-A)"
    operational_status: str = "SURGE_ELEVATED" # "NORMAL", "SURGE_ELEVATED", "MASS_CASUALTY_RED"
    occupancy_pct: float = 78.5
    last_updated: float = Field(default_factory=time.time)
    bed_units: List[BedUnit]
    critical_resources: List[CriticalResource]
    rationing_mode: bool = False
    resupply_drone_eta_mins: Optional[int] = 45

class CapacityUpdateRequest(BaseModel):
    action: str # "TOGGLE_RATIONING", "REQUEST_RESUPPLY", "REALLOCATE_BED", "UPDATE_STOCK"
    unit_id: Optional[str] = None
    resource_id: Optional[str] = None
    delta: Optional[float] = None
    target_status: Optional[str] = None
    rationing_mode: Optional[bool] = None

class AmbulanceUnit(BaseModel):
    unit_id: str
    callsign: str
    type: str # "ALS", "BLS", "CCT", "TACTICAL_4X4"
    status: str # "AVAILABLE", "DISPATCHED", "ON_SCENE", "TRANSPORTING", "OFFLINE"
    gps_lat: float
    gps_lng: float
    heading_deg: Optional[float] = 45.0
    speed_kmh: Optional[float] = 0.0
    crew: str
    equipment: List[str] = Field(default_factory=list)
    assigned_patient_id: Optional[str] = None
    assigned_hospital_id: Optional[str] = None
    battery_or_fuel_pct: int = 92
    gps_quality: str = "HIGH" # "HIGH", "DEGRADED", "LOST_DEAD_RECKONING"

class ReceivingHospital(BaseModel):
    hospital_id: str
    name: str
    gps_lat: float
    gps_lng: float
    trauma_level: str # "LEVEL_1", "LEVEL_2", "AUSTERE_SURGICAL"
    icu_beds_free: int
    trauma_bays_free: int
    total_occupancy_pct: float
    accepting_status: str # "ACCEPTING_ALL", "SELECTIVE_TRAUMA", "DIVERT_OVERCAPACITY"
    distance_km: float
    travel_time_mins: int
    delay_factor_mins: int = 0
    specialties: List[str] = Field(default_factory=list)
    recommendation_tier: str = "RECOMMENDED" # "RECOMMENDED", "SECONDARY", "DIVERT"
    logistics_rationale: str = ""

class DispatchMilestones(BaseModel):
    dispatched_at: Optional[str] = None
    en_route_at: Optional[str] = None
    on_scene_at: Optional[str] = None
    patient_loaded_at: Optional[str] = None
    hospital_arrived_at: Optional[str] = None

class RouteTelemetry(BaseModel):
    route_name: str
    status: str # "NOMINAL", "DELAYED_CONGESTION", "DETOUR_APPLIED", "OFFLINE_DEAD_RECKONING"
    estimated_arrival_eta_mins: int
    delay_added_mins: int = 0
    route_change_reason: Optional[str] = None
    waypoints: List[List[float]] = Field(default_factory=list)

class DispatchMission(BaseModel):
    mission_id: str
    ambulance_id: str
    patient_id: str
    patient_name: str
    clinical_urgency: str # "IMMEDIATE_RED", "DELAYED_YELLOW", "MINIMAL_GREEN"
    recommended_hospital_id: str
    assigned_hospital_id: str
    stage: str # "DISPATCHED", "ON_SCENE", "TRANSPORTING", "ARRIVED"
    milestones: DispatchMilestones = Field(default_factory=DispatchMilestones)
    route: RouteTelemetry
    fallback_active: bool = False
    fallback_grid_mgrs: Optional[str] = None
    fallback_notes: Optional[str] = None
    routing_advisory: str

class AmbulanceDispatchData(BaseModel):
    system_status: str = "OPERATIONAL"
    gps_satellite_lock: str = "LOCK_OPTIMAL"
    ambulances: List[AmbulanceUnit]
    hospitals: List[ReceivingHospital]
    missions: List[DispatchMission]
    fallback_protocol_enabled: bool = False
    last_updated: float = Field(default_factory=time.time)

class DispatchActionRequest(BaseModel):
    action: str # "ASSIGN_DISPATCH", "UPDATE_MILESTONE", "INJECT_ROUTE_DELAY", "TOGGLE_FALLBACK", "UPDATE_MGRS"
    ambulance_id: Optional[str] = None
    mission_id: Optional[str] = None
    patient_id: Optional[str] = None
    hospital_id: Optional[str] = None
    next_stage: Optional[str] = None
    delay_minutes: Optional[int] = None
    route_change_reason: Optional[str] = None
    mgrs_grid: Optional[str] = None
    fallback_enabled: Optional[bool] = None

class MedicineItem(BaseModel):
    med_id: str
    name: str
    generic_name: str
    category: str # "HEMOSTATIC", "ANALGESIC", "ANESTHETIC", "ANTIBIOTIC", "RESUSCITATION", "IV_FLUIDS", "ANTIDOTE"
    form: str
    dosage: str
    stock_total: int
    stock_available: int
    stock_reserved: int
    unit: str
    min_threshold: int
    temperature_requirement: str
    is_cold_chain: bool = False
    schedule: str = "Rx"
    active_substitutes: List[str] = Field(default_factory=list)
    criticality: str = "HIGH"

class PharmacyDepot(BaseModel):
    depot_id: str
    name: str
    depot_type: str
    location: str
    lat: float
    lng: float
    distance_km: float
    travel_time_mins: int
    status: str = "OPEN_24_7"
    pharmacist_in_charge: str
    contact_vhf: str
    cold_chain_status: str = "OPTIMAL_STABLE"
    cold_storage_temp_c: float = 4.2
    inventory_count: int = 1200
    is_network_partner: bool = True

class MedicineBatch(BaseModel):
    batch_id: str
    med_id: str
    med_name: str
    manufacturer: str
    manufacture_date: str
    expiry_date: str
    days_until_expiry: int
    quantity: int
    location_depot_id: str
    cold_chain_breach: bool = False
    status: str = "ACTIVE"
    fefo_priority: int = 1

class ReservationOrder(BaseModel):
    order_id: str
    timestamp: str
    med_id: str
    med_name: str
    quantity: int
    reserved_for: str
    destination_depot_id: str
    urgency: str = "EMERGENCY_STAT"
    status: str = "DISPATCHED"
    requester: str = "Tactical Dispatch Command"

class PharmacyPartner(BaseModel):
    partner_id: str
    name: str
    tier: str
    compliance_score: float = 99.4
    avg_fulfillment_mins: int = 18
    mesh_api_status: str = "SYNCED_ONLINE"
    authorized_stock_types: List[str] = Field(default_factory=list)
    contact_officer: str

class PharmaceuticalNetworkData(BaseModel):
    system_status: str = "OPERATIONAL"
    total_skus: int = 42
    total_inventory_units: int = 14580
    cold_chain_compliance_pct: float = 99.2
    low_stock_critical_count: int = 3
    active_reservations_count: int = 8
    medicines: List[MedicineItem] = Field(default_factory=list)
    depots: List[PharmacyDepot] = Field(default_factory=list)
    batches: List[MedicineBatch] = Field(default_factory=list)
    reservations: List[ReservationOrder] = Field(default_factory=list)
    partners: List[PharmacyPartner] = Field(default_factory=list)
    last_updated: float = Field(default_factory=time.time)

class PharmacyActionRequest(BaseModel):
    action: str
    med_id: Optional[str] = None
    batch_id: Optional[str] = None
    depot_id: Optional[str] = None
    target_depot_id: Optional[str] = None
    quantity: Optional[int] = 1
    reserved_for: Optional[str] = None
    urgency: Optional[str] = "EMERGENCY_STAT"
    notes: Optional[str] = None

