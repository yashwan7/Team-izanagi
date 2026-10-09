"""
security/capsule/generator.py
=============================
Patient Case Capsule Mock Data Generator for Kshitij.

Simulates evolving physiological conditions:
  - Baseline steady state
  - Rising heart rate (tachycardia crisis)
  - Acute Fall Detection trigger (triage RED alert)
  - Eye-gaze commands integration (WATER, CALL_NURSE, PAIN, BATHROOM)
  - Emergency GPS transit

Emits signed delta capsules via DeltaEncoder and HMAC-SHA256 crypto engine.
"""

from copy import deepcopy
import json
import time
from typing import Any, Callable, Dict, Generator, List, Optional, Tuple

from .crypto import sign_capsule
from .delta import DEFAULT_BASELINE, DeltaEncoder


class PatientCapsuleGenerator:
    """
    Simulates patient telemetry streams, encodes minimal delta capsules,
    and signs each capsule using HMAC-SHA256.
    """

    def __init__(
        self,
        patient_id: str = "KZ-PATIENT-001",
        secret_key: str = "kshitij_secure_key_2026",
        initial_baseline: Optional[Dict[str, Any]] = None
    ):
        self.patient_id = patient_id
        self.secret_key = secret_key
        self.encoder = DeltaEncoder(initial_baseline)
        self.current_state = deepcopy(self.encoder.baseline)
        self.current_state["patient_id"] = patient_id

    def set_vitals(
        self,
        heart_rate: Optional[int] = None,
        spo2: Optional[int] = None,
        systolic_bp: Optional[int] = None,
        diastolic_bp: Optional[int] = None,
        temp_c: Optional[float] = None,
        resp_rate: Optional[int] = None
    ) -> None:
        """Updates specific vital parameters."""
        v = self.current_state.setdefault("vitals", {})
        if heart_rate is not None: v["heart_rate_bpm"] = int(heart_rate)
        if spo2 is not None: v["spo2_percent"] = int(spo2)
        if systolic_bp is not None: v["systolic_bp"] = int(systolic_bp)
        if diastolic_bp is not None: v["diastolic_bp"] = int(diastolic_bp)
        if temp_c is not None: v["temperature_c"] = float(temp_c)
        if resp_rate is not None: v["respiratory_rate"] = int(resp_rate)

    def trigger_fall_event(self, triage_color: str = "RED") -> None:
        """Simulates an acute fall detection event."""
        self.current_state["fall_detected"] = True
        self.current_state["status"] = "EMERGENCY_FALL"
        self.current_state["triage_color"] = triage_color

    def clear_fall_event(self) -> None:
        self.current_state["fall_detected"] = False
        self.current_state["status"] = "MONITORING"
        self.current_state["triage_color"] = "GREEN"

    def set_eye_gaze(self, direction: str = "CENTER", blink_count: int = 0, last_command: str = "NONE") -> None:
        """Updates eye gaze biopotential command state."""
        g = self.current_state.setdefault("eye_gaze", {})
        g["direction"] = direction
        g["blink_count"] = blink_count
        g["last_command"] = last_command

    def set_gps(self, lat: float, lon: float, alt_m: float = 920.0) -> None:
        """Updates patient GPS coordinates."""
        gps = self.current_state.setdefault("gps", {})
        gps["latitude"] = float(lat)
        gps["longitude"] = float(lon)
        gps["altitude_m"] = float(alt_m)

    def generate_next_signed_capsule(self) -> Tuple[str, Dict[str, Any], Dict[str, Any]]:
        """
        Encodes current state into a delta capsule, signs it with HMAC-SHA256,
        and returns:
            (signed_capsule_json_string, delta_capsule_dict, metrics_dict)
        """
        delta_capsule, metrics = self.encoder.encode(self.current_state)
        signed_json_str = sign_capsule(delta_capsule, self.secret_key)
        return signed_json_str, delta_capsule, metrics

    def generate_simulation_sequence(self, num_steps: int = 8) -> List[Tuple[str, Dict[str, Any], Dict[str, Any]]]:
        """
        Generates a realistic clinical emergency sequence:
          Step 1: Baseline Keyframe (HR 75, normal, GREEN)
          Step 2: Mild exertion (HR 85, no other change) -> Delta only HR
          Step 3: Rising Heart Rate (HR 110, Tachycardia warning) -> Delta only HR
          Step 4: Acute Fall Detection! (fall_detected=True, triage RED) -> Delta fall & triage
          Step 5: Severe Tachycardia + Pain Command (HR 145, Eye Gaze 'PAIN') -> Delta HR & eye_gaze
          Step 6: Nurse Call Command (Eye Gaze 'CALL_NURSE') -> Delta eye_gaze
          Step 7: Water Request (Eye Gaze 'LEFT' + 'WATER') -> Delta eye_gaze
          Step 8: Ambulance GPS Transit (GPS updated) -> Delta gps
        """
        results = []

        # Step 1: Initial Keyframe
        self.set_vitals(heart_rate=75, spo2=98)
        self.set_eye_gaze("CENTER", 0, "NONE")
        self.clear_fall_event()
        results.append(self.generate_next_signed_capsule())

        # Step 2: Mild HR rise
        if num_steps >= 2:
            self.set_vitals(heart_rate=85)
            results.append(self.generate_next_signed_capsule())

        # Step 3: Rising Heart Rate
        if num_steps >= 3:
            self.set_vitals(heart_rate=110)
            self.current_state["triage_color"] = "YELLOW"
            results.append(self.generate_next_signed_capsule())

        # Step 4: Acute Fall Event Triggered
        if num_steps >= 4:
            self.trigger_fall_event("RED")
            self.set_vitals(heart_rate=130)
            results.append(self.generate_next_signed_capsule())

        # Step 5: Tachycardia + PAIN command
        if num_steps >= 5:
            self.set_vitals(heart_rate=145)
            self.set_eye_gaze("CENTER", 3, "PAIN")
            results.append(self.generate_next_signed_capsule())

        # Step 6: CALL_NURSE command
        if num_steps >= 6:
            self.set_eye_gaze("CENTER", 2, "CALL_NURSE")
            results.append(self.generate_next_signed_capsule())

        # Step 7: Gaze LEFT + WATER command
        if num_steps >= 7:
            self.set_eye_gaze("LEFT", 1, "WATER")
            results.append(self.generate_next_signed_capsule())

        # Step 8: GPS Transit movement
        if num_steps >= 8:
            self.set_gps(12.9750, 77.6000, 925.0)
            results.append(self.generate_next_signed_capsule())

        return results
