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
