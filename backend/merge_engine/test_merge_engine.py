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


@pytest.mark.asyncio
async def test_pharmaceutical_network_models_and_actions():
    from backend.merge_engine.models import (
        MedicineItem,
        PharmacyDepot,
        MedicineBatch,
        ReservationOrder,
        PharmacyPartner,
        PharmaceuticalNetworkData,
        PharmacyActionRequest
    )
    from backend.merge_engine.service import (
        pharmaceutical_network_state,
        handle_pharmacy_action
    )

    # Verify initial state contains all required entities
    assert len(pharmaceutical_network_state.medicines) >= 8
    assert len(pharmaceutical_network_state.depots) >= 4
    assert len(pharmaceutical_network_state.batches) >= 5
    assert len(pharmaceutical_network_state.partners) >= 3
    assert pharmaceutical_network_state.cold_chain_compliance_pct > 95.0

    # Verify critical medicines like TXA and Whole Blood
    txa = next((m for m in pharmaceutical_network_state.medicines if m.med_id == "MED-TXA-01"), None)
    assert txa is not None
    assert txa.category == "HEMOSTATIC"
    assert txa.stock_available > 0
    assert "Aminocaproic Acid" in txa.active_substitutes

    # Test CREATE_RESERVATION action
    initial_avail = txa.stock_available
    res_req = PharmacyActionRequest(
        action="CREATE_RESERVATION",
        med_id="MED-TXA-01",
        quantity=5,
        reserved_for="Ambulance MEDEVAC-01 (Urgent Trauma)",
        depot_id="PHARM-FST-01",
        urgency="EMERGENCY_STAT"
    )
    res_result = await handle_pharmacy_action(res_req)
    assert res_result.medicines[0].stock_available == initial_avail - 5
    assert res_result.reservations[0].med_id == "MED-TXA-01"
    assert res_result.reservations[0].quantity == 5

    # Test QUARANTINE_BATCH action
    batch_req = PharmacyActionRequest(
        action="QUARANTINE_BATCH",
        batch_id="BATCH-TXA-26A"
    )
    q_result = await handle_pharmacy_action(batch_req)
    q_batch = next((b for b in q_result.batches if b.batch_id == "BATCH-TXA-26A"), None)
    assert q_batch is not None
    assert q_batch.status == "QUARANTINED"
    assert q_batch.cold_chain_breach is True


@pytest.mark.asyncio
async def test_blood_bank_network_models_and_actions():
    from backend.merge_engine.models import (
        BloodInventoryUnit,
        BloodBankFacility,
        BloodRequestOrder,
        BloodTransferManifest,
        BloodAuditEntry,
        BloodBankNetworkData,
        BloodBankActionRequest
    )
    from backend.merge_engine.service import (
        blood_bank_state,
        handle_blood_bank_action
    )

    # 1. Verify blood bank initial state
    assert len(blood_bank_state.facilities) >= 4
    assert len(blood_bank_state.inventory) >= 10
    assert len(blood_bank_state.requests) >= 3
    assert len(blood_bank_state.transfers) >= 1
    assert blood_bank_state.cold_chain_compliance_pct > 98.0

    # 2. Verify clinical safety rule: Expired & Quarantined units cannot be reserved
    expired_unit = next((u for u in blood_bank_state.inventory if u.status == "EXPIRED"), None)
    assert expired_unit is not None
    assert expired_unit.can_reserve is False
    assert expired_unit.days_until_expiry < 0

    quarantined_unit = next((u for u in blood_bank_state.inventory if u.status == "QUARANTINED"), None)
    assert quarantined_unit is not None
    assert quarantined_unit.can_reserve is False

    # 3. Verify universal red cell & plasma units exist
    o_neg_units = [u for u in blood_bank_state.inventory if u.blood_group_display == "O-" and u.status == "AVAILABLE_RELEASED"]
    assert len(o_neg_units) >= 2

    ab_plasma = next((u for u in blood_bank_state.inventory if u.blood_group_display == "AB+" and u.component_type == "FFP"), None)
    assert ab_plasma is not None
    assert "UNIVERSAL_PLASMA_DONOR" in ab_plasma.special_attributes

    # 4. Test CREATE_REQUEST action
    req_action = BloodBankActionRequest(
        action="CREATE_REQUEST",
        patient_id="PT-TEST-BLOOD",
        patient_name_or_alias="Test Casualty Severe Trauma",
        component_type="PRBC",
        abo="O",
        rh="NEGATIVE",
        units_requested=1,
        urgency="EMERGENCY_STAT",
        clinical_indication="Test emergency blood request",
        destination_facility="Forward Surgical Team Alpha",
        actor_name="Capt. Clinical Medic"
    )
    created_res = await handle_blood_bank_action(req_action)
    created_order = created_res.requests[0]
    assert created_order.requested_abo == "O"
    assert created_order.status == "SUBMITTED"

    # 5. Test ACCEPT_REQUEST action (locks unit)
    accept_action = BloodBankActionRequest(
        action="ACCEPT_REQUEST",
        request_id=created_order.request_id,
        actor_name="AFTC Blood Bank Officer"
    )
    accepted_res = await handle_blood_bank_action(accept_action)
    accepted_order = next((r for r in accepted_res.requests if r.request_id == created_order.request_id), None)
    assert accepted_order.status == "ACCEPTED_RESERVED"
    assert accepted_order.units_allocated >= 1

    # 6. Test DISPATCH_TRANSFER action
    dispatch_action = BloodBankActionRequest(
        action="DISPATCH_TRANSFER",
        request_id=created_order.request_id,
        actor_name="Tactical Courier Desk"
    )
    dispatched_res = await handle_blood_bank_action(dispatch_action)
    assert dispatched_res.transfers[0].request_id == created_order.request_id
    assert dispatched_res.transfers[0].transfer_status == "DISPATCHED_IN_TRANSIT"

    # 7. Test CONFIRM_RECEIPT action
    receipt_action = BloodBankActionRequest(
        action="CONFIRM_RECEIPT",
        transfer_id=dispatched_res.transfers[0].transfer_id,
        actor_name="Receiving Trauma Surgeon"
    )
    received_res = await handle_blood_bank_action(receipt_action)
    assert received_res.transfers[0].transfer_status == "DELIVERED_RECEIVED"
    assert received_res.transfers[0].actual_arrival_timestamp is not None


