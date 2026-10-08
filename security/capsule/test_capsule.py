"""
security/capsule/test_capsule.py
================================
Unit Test Suite for Kshitij Case Capsule Delta Encoding & Cryptographic Security.

Tests:
  1. Delta computation & nested field diffing.
  2. State reconstruction via DeltaDecoder.
  3. Size reduction benchmark (~80-95% bandwidth saving on single-field updates).
  4. HMAC-SHA256 signature generation and canonical verification (VERIFIED).
  5. Tamper detection on modified payload / signature / wrong key (TAMPERED).
  6. Mock patient telemetry generator & event simulation.
  7. MockSerialChannel transmission & verification.
"""

from copy import deepcopy
import json
import unittest

from security.capsule.channels import MockSerialChannel
from security.capsule.crypto import (
    STATUS_TAMPERED,
    STATUS_VERIFIED,
    canonicalize_json,
    generate_hmac_sha256,
    sign_capsule,
    verify_capsule,
)
from security.capsule.delta import (
    DEFAULT_BASELINE,
    DeltaDecoder,
    DeltaEncoder,
    apply_dict_delta,
    compute_dict_delta,
)
from security.capsule.generator import PatientCapsuleGenerator


class TestDeltaEncoding(unittest.TestCase):
    def setUp(self):
        self.encoder = DeltaEncoder()
        self.decoder = DeltaDecoder()

    def test_zero_change_delta(self):
        """When state is unchanged, delta dictionary should be empty."""
        state = deepcopy(self.encoder.baseline)
        delta_capsule, metrics = self.encoder.encode(state)
        self.assertEqual(delta_capsule["delta"], {})
        self.assertEqual(metrics["modified_fields_count"], 0)

    def test_single_vital_change_delta_size_reduction(self):
        """When only heart rate changes, delta should only contain that subkey."""
        state = deepcopy(self.encoder.baseline)
        state["vitals"]["heart_rate_bpm"] = 125  # Tachycardia

        delta_capsule, metrics = self.encoder.encode(state)
        self.assertEqual(delta_capsule["delta"], {"vitals": {"heart_rate_bpm": 125}})

        # Delta size should be vastly smaller than full state JSON
        self.assertGreater(metrics["reduction_pct"], 60.0)

    def test_nested_diff_and_reconstruction(self):
        """Verify that decoding a series of deltas reconstructs full state perfectly."""
        encoder = DeltaEncoder()
        decoder = DeltaDecoder()

        # Step 1: Modify GPS & Triage
        s1 = deepcopy(encoder.baseline)
        s1["gps"]["latitude"] = 13.0827
        s1["triage_color"] = "YELLOW"
        d1, _ = encoder.encode(s1)
        r1 = decoder.decode(d1)
        self.assertEqual(r1, s1)

        # Step 2: Fall Detection & Eye Gaze Command
        s2 = deepcopy(s1)
        s2["fall_detected"] = True
        s2["status"] = "EMERGENCY_FALL"
        s2["triage_color"] = "RED"
        s2["eye_gaze"]["last_command"] = "CALL_NURSE"
        d2, _ = encoder.encode(s2)
        r2 = decoder.decode(d2)
        self.assertEqual(r2, s2)


class TestCryptographicSecurity(unittest.TestCase):
    def setUp(self):
        self.secret_key = "kz_test_secret_key_8971"
        self.payload = {
            "patient_id": "KZ-PATIENT-001",
            "seq": 4,
            "delta": {"vitals": {"heart_rate_bpm": 145}, "status": "EMERGENCY"},
        }

    def test_sign_and_verify_valid(self):
        """Signed capsule with correct key must return VERIFIED."""
        signed_json = sign_capsule(self.payload, self.secret_key)
        status, verified_payload = verify_capsule(signed_json, self.secret_key)

        self.assertEqual(status, STATUS_VERIFIED)
        self.assertEqual(verified_payload, self.payload)

    def test_tampered_payload_rejected(self):
        """If an attacker alters a vital in the payload, verify must return TAMPERED."""
        signed_json = sign_capsule(self.payload, self.secret_key)
        envelope = json.loads(signed_json)

        # Attacker tampers with heart rate (modifies from 145 to 70)
        envelope["payload"]["delta"]["vitals"]["heart_rate_bpm"] = 70
        tampered_json = json.dumps(envelope)

        status, payload = verify_capsule(tampered_json, self.secret_key)
        self.assertEqual(status, STATUS_TAMPERED)
        self.assertIsNone(payload)

    def test_tampered_signature_rejected(self):
        """If signature bits are flipped, verify must return TAMPERED."""
        signed_json = sign_capsule(self.payload, self.secret_key)
        envelope = json.loads(signed_json)

        # Flip signature characters
        envelope["signature"] = "0" * 64
        tampered_json = json.dumps(envelope)

        status, payload = verify_capsule(tampered_json, self.secret_key)
        self.assertEqual(status, STATUS_TAMPERED)
        self.assertIsNone(payload)

    def test_wrong_secret_key_rejected(self):
        """Verifying with an incorrect secret key must return TAMPERED."""
        signed_json = sign_capsule(self.payload, self.secret_key)
        status, payload = verify_capsule(signed_json, "wrong_attacker_key_666")

        self.assertEqual(status, STATUS_TAMPERED)
        self.assertIsNone(payload)

    def test_corrupt_json_rejected(self):
        """Corrupt or non-JSON payloads must safely return TAMPERED."""
        status, payload = verify_capsule("{malformed_json: true,", self.secret_key)
        self.assertEqual(status, STATUS_TAMPERED)
        self.assertIsNone(payload)


class TestMockGeneratorAndChannels(unittest.TestCase):
    def setUp(self):
        self.secret_key = "kz_secret_transport_key"
        self.generator = PatientCapsuleGenerator(secret_key=self.secret_key)
        self.channel = MockSerialChannel()
        self.decoder = DeltaDecoder()

    def test_emergency_simulation_transmission_loop(self):
        """Generate simulation sequence, transmit over MockSerialChannel, and verify all frames."""
        sequence = self.generator.generate_simulation_sequence(8)
        self.assertEqual(len(sequence), 8)

        for signed_json_str, expected_delta, metrics in sequence:
            # Send
            bytes_sent = self.channel.write_frame(signed_json_str)
            self.assertGreater(bytes_sent, 0)

            # Receive
            received_frame = self.channel.read_frame(timeout_s=0.5)
            self.assertIsNotNone(received_frame)

            # Verify cryptographic signature
            status, payload = verify_capsule(received_frame, self.secret_key)
            self.assertEqual(status, STATUS_VERIFIED)

            # Reconstruct patient state
            reconstructed = self.decoder.decode(payload)
            self.assertIn("patient_id", reconstructed)
            self.assertIn("vitals", reconstructed)

    def test_serial_tamper_injection(self):
        """Assert that injected tampering on the serial line is intercepted."""
        signed_json_str, _, _ = self.generator.generate_next_signed_capsule()
        self.channel.write_frame(signed_json_str)

        # Inject tampering in transit
        self.channel.inject_tampering()

        tampered_frame = self.channel.read_frame()
        status, payload = verify_capsule(tampered_frame, self.secret_key)
        self.assertEqual(status, STATUS_TAMPERED)
        self.assertIsNone(payload)


if __name__ == "__main__":
    unittest.main()
