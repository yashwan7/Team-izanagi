import pytest
from backend.merge_engine.models import CaseCapsule, Vitals, EyeGaze, MedicationEntry, GPSLocation
from backend.merge_engine.prompt_engine import calculate_clinical_metrics, evaluate_clinical_triage
from backend.merge_engine.security import sign_capsule, verify_capsule
from backend.merge_engine.engine import SyncAndMergeEngine
from backend.merge_engine.network_engine import NetworkFailoverEngine

def test_priority_score_and_metrics():
    c1 = CaseCapsule(
        patient_id="TEST-01",
        time_to_help=0.4,
        vitals=Vitals(heart_rate=140, spo2=84, respiratory_rate=32),
        red_flags=["tension_pneumothorax"]
    )
    m1 = calculate_clinical_metrics(c1)
    assert m1["severity"] > 6.0
    assert m1["priority_score"] > 20.0
    assert m1["time_to_help"] == 0.4

    c2 = CaseCapsule(
        patient_id="TEST-02",
        time_to_help=24.0,
        vitals=Vitals(heart_rate=72, spo2=98, respiratory_rate=14),
        red_flags=[]
    )
    m2 = calculate_clinical_metrics(c2)
    assert m2["severity"] < 3.0
    assert m2["priority_score"] < 2.0

@pytest.mark.asyncio
async def test_delay_aware_triage_evaluation():
    # Test Acute Stabilization (<30m)
    c_acute = CaseCapsule(
        patient_id="TEST-ACUTE",
        time_to_help=0.3, # 18 mins
        vitals=Vitals(heart_rate=135, spo2=88),
        red_flags=["massive_hemorrhage"]
    )
    res_acute = await evaluate_clinical_triage(c_acute)
    assert res_acute.protocol_mode == "ACUTE_STABILIZATION"
    assert res_acute.triage_level == "IMMEDIATE_RED"
    assert len(res_acute.action_steps) > 0

    # Test Prolonged Field Care (>=24h)
    c_pfc = CaseCapsule(
        patient_id="TEST-PFC",
        time_to_help=30.0, # 30 hours
        vitals=Vitals(heart_rate=95, spo2=94),
        red_flags=["burn_injury"]
    )
    res_pfc = await evaluate_clinical_triage(c_pfc)
    assert res_pfc.protocol_mode == "PROLONGED_FIELD_CARE"
    assert len(res_pfc.rationing_guidelines) > 0

def test_hmac_tamper_detection():
    data = {
        "patient_id": "TEST-HMAC",
        "vitals": {"heart_rate": 80, "spo2": 98},
        "eye_gaze": {"command": "CALL_NURSE"}
    }
    signed = sign_capsule(data)
    assert "hmac_signature" in signed
    assert signed["verification_status"] == "VERIFIED"

    status, is_valid = verify_capsule(signed)
    assert status == "VERIFIED"
    assert is_valid is True

    tampered = dict(signed)
    tampered["vitals"] = {"heart_rate": 180, "spo2": 60}
    status_tampered, is_valid_tampered = verify_capsule(tampered)
    assert status_tampered == "TAMPERED"
    assert is_valid_tampered is False

def test_sync_merge_and_medication_conflict_resolution():
    engine = SyncAndMergeEngine()
    
    # Ingest first medication record
    c1 = CaseCapsule(
        patient_id="PT-DUP",
        medications=[
            MedicationEntry(medication="Morphine", dose="5mg", administered_at="10:00", administered_by="Medic A")
        ]
    )
    _, inc1 = engine.ingest_capsule(c1)
    assert len(engine.medication_history["PT-DUP"]) == 1

    # Ingest duplicate administration at same time by Medic B
    c2 = CaseCapsule(
        patient_id="PT-DUP",
        medications=[
            MedicationEntry(medication="Morphine", dose="5mg", administered_at="10:00", administered_by="Medic B")
        ]
    )
    _, inc2 = engine.ingest_capsule(c2)
    # Deduplication should prevent duplicate entry in history
    assert len(engine.medication_history["PT-DUP"]) == 1
    # Check that a conflict resolution incident was registered
    conflict_incidents = [i for i in inc2 if i.category == "CONFLICT_RESOLVED"]
    assert len(conflict_incidents) == 1
    assert conflict_incidents[0].conflict_detected is True

def test_network_failover_state_machine():
    net = NetworkFailoverEngine()
    assert net.active_state == "PORT_A_ACTIVE"

    net.inject_network_degradation("PORT_A_FAILURE")
    assert net.active_state == "PORT_B_ACTIVE"

    net.inject_network_degradation("TOTAL_DISCONNECT")
    assert net.active_state == "MESH_ACTIVE"

    net.restore_healthy()
    assert net.active_state == "PORT_A_ACTIVE"

def test_clubbed_tinyml_predict_endpoint():
    from backend.merge_engine.service import predict_tinyml_anomaly, TinyMLPredictRequest
    
    # Healthy telemetry vector
    req_healthy = TinyMLPredictRequest(latency_ms=22.0, jitter_ms=1.5, packet_loss_pct=0.05, dns_time_ms=10.0)
    res_healthy = predict_tinyml_anomaly(req_healthy)
    assert res_healthy["class_label"] == "HEALTHY"
    assert res_healthy["confidence"] > 0.80
    assert res_healthy["inference_time_ms"] < 5.0 # Sub-5ms target

    # Critical anomaly telemetry vector
    req_crit = TinyMLPredictRequest(latency_ms=320.0, jitter_ms=45.0, packet_loss_pct=40.0, dns_time_ms=180.0)
    res_crit = predict_tinyml_anomaly(req_crit)
    assert res_crit["class_label"] == "CRITICAL"
    assert res_crit["is_anomalous"] is True

def test_clubbed_eog_live_batch_endpoint():
    from backend.merge_engine.service import get_eog_live_batch
    batch = get_eog_live_batch(scenario="nurse")
    assert batch["sample_count"] == 50
    assert len(batch["frames"]) == 50
    # Check that filtered vertical biopotentials exist
    assert "filtered_vertical" in batch["frames"][0]
    assert "gaze" in batch["frames"][0]

@pytest.mark.asyncio
async def test_clubbed_chaos_injection_endpoint():
    from backend.merge_engine.service import inject_chaos_scenario, ChaosInjectRequest
    
    req = ChaosInjectRequest(action="BURST_JITTER")
    res = await inject_chaos_scenario(req)
    assert res["action"] == "BURST_JITTER"
    assert "High jitter anomaly" in res["message"]

    req_reset = ChaosInjectRequest(action="RESET_ALL")
    res_reset = await inject_chaos_scenario(req_reset)
    assert res_reset["action"] == "RESET_ALL"

def test_hospital_capacity_models_and_reallocation():
    from backend.merge_engine.models import BedUnit, CriticalResource, HospitalCapacityData, CapacityUpdateRequest
    from backend.merge_engine.service import hospital_capacity_state

    # Verify initial capacity state
    assert hospital_capacity_state.facility_name == "Forward Surgical Team Alpha (FST-A)"
    assert len(hospital_capacity_state.bed_units) >= 4
    assert len(hospital_capacity_state.critical_resources) >= 10

    # Test BedUnit model validation
    bed = BedUnit(
        unit_id="TEST-ICU",
        unit_name="Test ICU",
        category="ICU",
        total_beds=10,
        occupied_beds=8,
        ventilators_total=8,
        ventilators_active=6,
        critical_reserve=2
    )
    assert bed.occupied_beds == 8

    # Test CriticalResource model
    res = CriticalResource(
        resource_id="TEST-O2",
        name="Oxygen",
        category="OXYGEN",
        current_level=500.0,
        max_capacity=1000.0,
        unit="Liters",
        burn_rate_per_hour=25.0,
        hours_remaining=20.0,
        status="NOMINAL"
    )
    assert res.hours_remaining == 20.0

    # Test CapacityUpdateRequest
    req = CapacityUpdateRequest(
        action="REALLOCATE_BED",
        unit_id="ICU-CC",
        delta=1
    )
    assert req.delta == 1


def test_ambulance_dispatch_intelligence_and_fallback():
    from backend.merge_engine.models import AmbulanceUnit, ReceivingHospital, DispatchMission, AmbulanceDispatchData
    from backend.merge_engine.service import ambulance_dispatch_state

    # Verify dispatch system initial state
    assert len(ambulance_dispatch_state.ambulances) >= 4
    assert len(ambulance_dispatch_state.hospitals) >= 3
    assert len(ambulance_dispatch_state.missions) >= 2

    # Check receiving hospital recommendations and capacity separation
    hosp1 = ambulance_dispatch_state.hospitals[0]
    assert hosp1.icu_beds_free >= 1
    assert "RECOMMENDED" in hosp1.recommendation_tier
    assert len(hosp1.logistics_rationale) > 0

    # Verify mission routing advisory is distinct from clinical triage
    m1 = ambulance_dispatch_state.missions[0]
    assert m1.clinical_urgency in ["IMMEDIATE_RED", "DELAYED_YELLOW", "MINIMAL_GREEN"]
    assert "LOGISTICS ROUTING" in m1.routing_advisory

    # Verify ambulance unit telemetry
    a1 = ambulance_dispatch_state.ambulances[0]
    assert a1.gps_quality == "HIGH"
    assert a1.speed_kmh is not None
    assert a1.heading_deg is not None


