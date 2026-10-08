import time
from backend.models import CaseCapsule, Vitals, EyeGaze, GPSLocation, MedicationEntry
from backend.security import sign_capsule
from backend.merge_engine import merge_engine

def seed_initial_mock_data():
    """
    Populates initial clinical cases reflecting diverse tactical scenarios:
    - Acute stabilization (<30m)
    - Prolonged Field Care (>=24h)
    - Eye-gaze commands (CALL_NURSE, WATER)
    - Valid HMAC and Tampered capsules
    - Duplicate medication records
    """
    now = time.time()

    # Patient 1: Acute trauma (<30m) - Tension Pneumothorax
    p1 = CaseCapsule(
        patient_id="PT-101",
        patient_name="Sgt. Marcus Vance",
        timestamp=now - 120,
        time_to_help=0.4, # 24 minutes! <= 30m
        vitals=Vitals(
            heart_rate=138.0,
            spo2=86.0,
            systolic_bp=88.0,
            diastolic_bp=56.0,
            respiratory_rate=34.0,
            temperature=36.4,
            fall_detected=True
        ),
        red_flags=["tension_pneumothorax", "penetrating_chest_trauma", "severe_hypoxemia"],
        eye_gaze=EyeGaze(command="PAIN", direction="CENTER", blink_count=3, timestamp=now - 60),
        medications=[
            MedicationEntry(medication="Fentanyl", dose="100mcg", administered_at="14:15", administered_by="Medic Echo", entry_id="M1")
        ],
        gps=GPSLocation(lat=28.6189, lng=77.2050, altitude=218.0),
        triage_color="RED"
    )
    # Sign p1 with HMAC
    p1_signed = sign_capsule(p1.model_dump())
    merge_engine.ingest_capsule(CaseCapsule(**p1_signed))

    # Patient 2: Prolonged Field Care (>=24h) - Severe blast concussion & burns in isolated outpost
    p2 = CaseCapsule(
        patient_id="PT-204",
        patient_name="Cpl. David Chen",
        timestamp=now - 300,
        time_to_help=32.0, # 32 hours! >= 24h
        vitals=Vitals(
            heart_rate=104.0,
            spo2=93.0,
            systolic_bp=108.0,
            diastolic_bp=72.0,
            respiratory_rate=22.0,
            temperature=38.3,
            fall_detected=False
        ),
        red_flags=["blast_injury_burns_2nd_degree", "austere_outpost_isolated"],
        eye_gaze=EyeGaze(command="WATER", direction="LEFT", blink_count=1, timestamp=now - 200),
        medications=[
            MedicationEntry(medication="Ceftriaxone", dose="1g IV", administered_at="12:00", administered_by="Sgt. Bradley", entry_id="M2")
        ],
        gps=GPSLocation(lat=28.6250, lng=77.2180, altitude=230.0),
        triage_color="YELLOW"
    )
    p2_signed = sign_capsule(p2.model_dump())
    merge_engine.ingest_capsule(CaseCapsule(**p2_signed))

    # Patient 3: Eye-gaze paralyzed operative - Call Nurse alert (Verified)
    p3 = CaseCapsule(
        patient_id="PT-309",
        patient_name="Lt. Elena Rostova",
        timestamp=now - 60,
        time_to_help=2.5, # 2.5 hours
        vitals=Vitals(
            heart_rate=92.0,
            spo2=96.0,
            systolic_bp=122.0,
            diastolic_bp=78.0,
            respiratory_rate=18.0,
            temperature=37.1,
            fall_detected=False
        ),
        red_flags=["spinal_cord_immobilized", "dysphagia"],
        eye_gaze=EyeGaze(command="CALL_NURSE", direction="CENTER", blink_count=2, timestamp=now - 15),
        medications=[],
        gps=GPSLocation(lat=28.6090, lng=77.2200, altitude=210.0),
        triage_color="YELLOW"
    )
    p3_signed = sign_capsule(p3.model_dump())
    merge_engine.ingest_capsule(CaseCapsule(**p3_signed))

    # Patient 4: Tampered Capsule Demo (simulating MITM interception or corrupted telemetry)
    p4 = CaseCapsule(
        patient_id="PT-412",
        patient_name="Operative Vikram Singh",
        timestamp=now - 90,
        time_to_help=1.2,
        vitals=Vitals(
            heart_rate=78.0,
            spo2=98.0,
            systolic_bp=118.0,
            diastolic_bp=78.0,
            respiratory_rate=16.0,
            temperature=36.9,
            fall_detected=False
        ),
        red_flags=[],
        eye_gaze=EyeGaze(command="BATHROOM", direction="RIGHT", blink_count=1, timestamp=now - 30),
        medications=[],
        gps=GPSLocation(lat=28.6145, lng=77.2310, altitude=212.0),
        triage_color="GREEN",
        hmac_signature="bad_tampered_hash_9876543210deadbeef" # Invalid HMAC!
    )
    # Ingest without re-signing to showcase Developer 2's Tamper detection!
    merge_engine.ingest_capsule(p4)

    # Ingest duplicate medication scenario for PT-101 to demonstrate deduplication!
    dup_med_capsule = CaseCapsule(
        patient_id="PT-101",
        patient_name="Sgt. Marcus Vance",
        timestamp=now - 10,
        time_to_help=0.4,
        vitals=p1.vitals,
        red_flags=p1.red_flags,
        medications=[
            MedicationEntry(medication="Fentanyl", dose="100mcg", administered_at="14:15", administered_by="Paramedic Sierra", entry_id="M1_dup")
        ],
        offline_cached=True,
        sequence_id=2
    )
    dup_signed = sign_capsule(dup_med_capsule.model_dump())
    merge_engine.ingest_capsule(CaseCapsule(**dup_signed))
