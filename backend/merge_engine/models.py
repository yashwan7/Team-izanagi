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

class BloodInventoryUnit(BaseModel):
    unit_id: str
    bank_id: str
    bank_name: str
    abo: str
    rh: str
    blood_group_display: str
    component_type: str
    component_name: str
    volume_ml: int
    collection_date: str
    preparation_date: str
    expiry_date: str
    days_until_expiry: int
    status: str
    screening_status: str = "TESTED_NEGATIVE"
    screening_tests: Dict[str, str] = Field(default_factory=dict)
    storage_requirement: str
    storage_location_ref: str
    storage_temp_current: float
    storage_excursion_detected: bool = False
    special_attributes: List[str] = Field(default_factory=list)
    can_reserve: bool = True
    reservation_id: Optional[str] = None
    last_verified_at: str

class BloodBankFacility(BaseModel):
    bank_id: str
    name: str
    address: str
    lat: float
    lng: float
    distance_km: float
    travel_time_mins: int
    contact_phone: str
    contact_vhf: str
    operating_status: str
    license_accreditation: str
    verified: bool = True
    transport_available: bool = True
    walk_in_collection: bool = True
    total_units_stocked: int
    available_units_count: int
    cold_storage_status: str = "OPTIMAL_ONLINE"
    director: str
    last_inventory_sync: str

class BloodRequestOrder(BaseModel):
    request_id: str
    timestamp: str
    patient_id: Optional[str] = None
    patient_name_or_alias: Optional[str] = "Emergency Trauma Casualty"
    patient_blood_group: str = "O-"
    requested_abo: str
    requested_rh: str
    component_type: str
    units_requested: int
    units_allocated: int = 0
    urgency: str
    clinical_indication: str
    requesting_hospital: str = "Forward Surgical Team Alpha (FST-A)"
    target_blood_bank_id: str
    target_blood_bank_name: str
    status: str
    authorized_clinician: str = "Maj. Dr. A. Sharma, Trauma Team Lead"
    allocated_unit_ids: List[str] = Field(default_factory=list)
    transfer_id: Optional[str] = None
    clinical_safeguard_acknowledged: bool = True

class BloodTransferManifest(BaseModel):
    transfer_id: str
    request_id: str
    source_blood_bank_id: str
    source_name: str
    destination_facility_id: str
    destination_name: str
    allocated_units: List[str]
    component_type: str
    transport_container_id: str
    data_logger_id: str
    current_transit_temp_c: float
    dispatch_timestamp: str
    estimated_arrival_timestamp: str
    actual_arrival_timestamp: Optional[str] = None
    courier_callsign: str
    courier_contact: str
    transfer_status: str
    chain_of_custody_events: List[Dict[str, Any]] = Field(default_factory=list)
    receipt_confirmed_by: Optional[str] = None
    receipt_notes: Optional[str] = None

class BloodAuditEntry(BaseModel):
    audit_id: str
    timestamp: str
    event_type: str
    unit_id: Optional[str] = None
    request_id: Optional[str] = None
    actor: str
    facility: str
    details: str
    digital_signature_hash: str

class BloodBankNetworkData(BaseModel):
    system_status: str = "OPERATIONAL"
    total_registered_banks: int = 4
    total_available_released_units: int = 528
    total_o_negative_emergency_units: int = 42
    active_requests_count: int = 3
    pending_reservations_count: int = 2
    units_near_expiry_count: int = 5
    units_quarantined_count: int = 2
    in_transit_transfers_count: int = 1
    cold_chain_compliance_pct: float = 99.6
    facilities: List[BloodBankFacility] = Field(default_factory=list)
    inventory: List[BloodInventoryUnit] = Field(default_factory=list)
    requests: List[BloodRequestOrder] = Field(default_factory=list)
    transfers: List[BloodTransferManifest] = Field(default_factory=list)
    audit_log: List[BloodAuditEntry] = Field(default_factory=list)
    last_updated: float = Field(default_factory=time.time)

class BloodBankActionRequest(BaseModel):
    action: str
    request_id: Optional[str] = None
    transfer_id: Optional[str] = None
    unit_id: Optional[str] = None
    bank_id: Optional[str] = None
    patient_id: Optional[str] = None
    patient_name_or_alias: Optional[str] = None
    component_type: Optional[str] = None
    abo: Optional[str] = None
    rh: Optional[str] = None
    units_requested: Optional[int] = 1
    urgency: Optional[str] = "EMERGENCY_STAT"
    clinical_indication: Optional[str] = None
    destination_facility: Optional[str] = None
    actor_name: Optional[str] = None
    reason_or_notes: Optional[str] = None

