"""
security/capsule/delta.py
=========================
Delta Encoding and Decoding Engine for Kshitij Patient Case Capsules.

Reduces telemetry payload size by ~85-95% over bandwidth-constrained mesh,
BLE, and tactical radio links by transmitting ONLY modified delta fields
relative to an evolving patient baseline dictionary.
"""

from copy import deepcopy
import json
from typing import Any, Dict, Optional, Tuple, Union


DEFAULT_BASELINE: Dict[str, Any] = {
    "patient_id": "KZ-PATIENT-001",
    "status": "MONITORING",
    "triage_color": "GREEN",
    "fall_detected": False,
    "vitals": {
        "heart_rate_bpm": 75,
        "spo2_percent": 98,
        "systolic_bp": 120,
        "diastolic_bp": 80,
        "temperature_c": 36.8,
        "respiratory_rate": 16,
    },
    "gps": {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "altitude_m": 920.0,
        "accuracy_m": 2.5,
    },
    "eye_gaze": {
        "direction": "CENTER",
        "blink_count": 0,
        "last_command": "NONE",
    },
}


def compute_dict_delta(baseline: Dict[str, Any], current: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively computes the diff between baseline and current state dictionary.
    Returns a minimal dictionary containing only keys whose values have changed.
    """
    delta: Dict[str, Any] = {}

    for key, curr_val in current.items():
        if key not in baseline:
            # Newly added field
            delta[key] = deepcopy(curr_val)
        else:
            base_val = baseline[key]
            if isinstance(curr_val, dict) and isinstance(base_val, dict):
                sub_delta = compute_dict_delta(base_val, curr_val)
                if sub_delta:
                    delta[key] = sub_delta
            else:
                # Compare primitive values (int, float, str, bool, list)
                if curr_val != base_val:
                    delta[key] = deepcopy(curr_val)

    return delta


def apply_dict_delta(baseline: Dict[str, Any], delta: Dict[str, Any]) -> Dict[str, Any]:
    """
    Applies a delta dictionary onto a baseline dictionary to reconstruct the full state.
    """
    reconstructed = deepcopy(baseline)

    for key, delta_val in delta.items():
        if isinstance(delta_val, dict) and key in reconstructed and isinstance(reconstructed[key], dict):
            reconstructed[key] = apply_dict_delta(reconstructed[key], delta_val)
        else:
            reconstructed[key] = deepcopy(delta_val)

    return reconstructed


class DeltaEncoder:
    """
    Stateful Delta Encoder maintaining patient baseline state.
    """

    def __init__(self, initial_baseline: Optional[Dict[str, Any]] = None):
        if initial_baseline is not None:
            self.baseline = deepcopy(initial_baseline)
        else:
            self.baseline = deepcopy(DEFAULT_BASELINE)

        self.sequence_number = 0

    def encode(self, current_state: Dict[str, Any], include_metadata: bool = True) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Encodes the current full state into a minimal delta capsule.
        Updates internal baseline to current_state.

        Returns:
            (delta_capsule_dict, metrics_dict)
        """
        self.sequence_number += 1
        delta_body = compute_dict_delta(self.baseline, current_state)

        # Always preserve patient_id and sequence_number in delta capsule header
        delta_capsule: Dict[str, Any] = {
            "patient_id": current_state.get("patient_id", self.baseline.get("patient_id", "UNKNOWN")),
            "seq": self.sequence_number,
            "delta": delta_body,
        }

        if include_metadata:
            delta_capsule["is_keyframe"] = (self.sequence_number == 1 or not delta_body)

        # Calculate size reduction metrics
        full_json_str = json.dumps(current_state, separators=(",", ":"))
        delta_json_str = json.dumps(delta_capsule, separators=(",", ":"))

        full_bytes = len(full_json_str.encode("utf-8"))
        delta_bytes = len(delta_json_str.encode("utf-8"))
        reduction_pct = max(0.0, (1.0 - (delta_bytes / full_bytes))) * 100.0 if full_bytes > 0 else 0.0

        metrics = {
            "seq": self.sequence_number,
            "full_bytes": full_bytes,
            "delta_bytes": delta_bytes,
            "reduction_pct": round(reduction_pct, 2),
            "modified_fields_count": len(delta_body),
        }

        # Advance baseline to current state
        self.baseline = deepcopy(current_state)

        return delta_capsule, metrics

    def reset(self, new_baseline: Optional[Dict[str, Any]] = None) -> None:
        if new_baseline is not None:
            self.baseline = deepcopy(new_baseline)
        else:
            self.baseline = deepcopy(DEFAULT_BASELINE)
        self.sequence_number = 0


class DeltaDecoder:
    """
    Stateful Delta Decoder that reconstructs full patient states from incoming delta capsules.
    """

    def __init__(self, initial_baseline: Optional[Dict[str, Any]] = None):
        if initial_baseline is not None:
            self.baseline = deepcopy(initial_baseline)
        else:
            self.baseline = deepcopy(DEFAULT_BASELINE)

        self.last_sequence_number = 0

    def decode(self, delta_capsule: Union[str, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Decodes incoming delta capsule and returns the full reconstructed patient state dictionary.
        """
        if isinstance(delta_capsule, str):
            capsule_dict = json.loads(delta_capsule)
        else:
            capsule_dict = delta_capsule

        seq = capsule_dict.get("seq", self.last_sequence_number + 1)
        self.last_sequence_number = seq

        delta_body = capsule_dict.get("delta", {})
        reconstructed = apply_dict_delta(self.baseline, delta_body)

        # Ensure top-level patient_id is updated
        if "patient_id" in capsule_dict:
            reconstructed["patient_id"] = capsule_dict["patient_id"]

        # Advance internal baseline
        self.baseline = deepcopy(reconstructed)

        return reconstructed

    def reset(self, new_baseline: Optional[Dict[str, Any]] = None) -> None:
        if new_baseline is not None:
            self.baseline = deepcopy(new_baseline)
        else:
            self.baseline = deepcopy(DEFAULT_BASELINE)
        self.last_sequence_number = 0
