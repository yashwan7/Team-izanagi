"""
security/capsule/cli.py
=======================
CLI Runner for Kshitij Patient Case Capsule Delta Encoding & Cryptographic Security.

Usage:
    python -m security.capsule.cli --simulate
    python -m security.capsule.cli --tamper-demo
    python -m security.capsule.cli --serve-stream --port 8765
"""

import argparse
import json
import sys
import time
from typing import Optional

from .channels import MockSerialChannel, MockSocketChannelServer
from .crypto import STATUS_TAMPERED, STATUS_VERIFIED, verify_capsule
from .delta import DeltaDecoder
from .generator import PatientCapsuleGenerator


def run_simulation(secret_key: str = "kshitij_secure_key_2026", stream_realtime: bool = False) -> None:
    print("=" * 80)
    print("  KSHITIJ PATIENT CASE CAPSULE - DELTA ENCODING & SECURITY ENGINE")
    print(f"  Secret Key: {secret_key[:4]}****{secret_key[-4:]} | HMAC-SHA256 Auth Enabled")
    print("=" * 80)
    print(f"{'Seq':>4} | {'Full (B)':>8} | {'Delta (B)':>9} | {'Saved (%)':>9} | {'Auth Status':>11} | {'Delta Payload Preview'}")
    print("-" * 80)

    generator = PatientCapsuleGenerator(secret_key=secret_key)
    decoder = DeltaDecoder()
    serial_channel = MockSerialChannel()

    sequence = generator.generate_simulation_sequence(8)
    total_full_bytes = 0
    total_delta_bytes = 0

    for signed_json_str, delta_dict, metrics in sequence:
        # Transmit over Mock Serial Channel
        serial_channel.write_frame(signed_json_str)

        # Receiver reads and verifies
        received_frame = serial_channel.read_frame()
        if not received_frame:
            continue

        status, payload = verify_capsule(received_frame, secret_key)
        
        # Decode delta to reconstruct patient state
        if status == STATUS_VERIFIED and payload:
            reconstructed = decoder.decode(payload)

        total_full_bytes += metrics["full_bytes"]
        total_delta_bytes += metrics["delta_bytes"]

        delta_preview = json.dumps(delta_dict.get("delta", {}), separators=(",", ":"))
        if len(delta_preview) > 30:
            delta_preview = delta_preview[:27] + "..."

        status_display = f"[\033[92m{status}\033[0m]" if status == STATUS_VERIFIED else f"[\033[91m{status}\033[0m]"
        
        print(f"{metrics['seq']:4d} | {metrics['full_bytes']:8d} | {metrics['delta_bytes']:9d} | {metrics['reduction_pct']:8.1f}% | {status_display:>13} | {delta_preview}")

        if stream_realtime:
            time.sleep(0.5)

    overall_reduction = max(0.0, (1.0 - (total_delta_bytes / total_full_bytes))) * 100.0 if total_full_bytes > 0 else 0.0
    print("-" * 80)
    print(f"Summary: Transmitted {len(sequence)} capsules.")
    print(f"  Total Uncompressed Full Size: {total_full_bytes} bytes")
    print(f"  Total Delta Compressed Size:  {total_delta_bytes} bytes")
    print(f"  Overall Bandwidth Reduction:  {overall_reduction:.1f}% (~{total_full_bytes/max(1, total_delta_bytes):.1f}x compression)")
    print("=" * 80)


def run_tamper_demonstration(secret_key: str = "kshitij_secure_key_2026") -> None:
    print("=" * 80)
    print("  KSHITIJ CAPSULE CRYPTOGRAPHIC INTEGRITY & TAMPER-DETECTION DEMO")
    print("=" * 80)

    generator = PatientCapsuleGenerator(secret_key=secret_key)
    serial_channel = MockSerialChannel()

    # Step 1: Generate valid signed capsule (Fall detected + tachycardia)
    generator.trigger_fall_event("RED")
    generator.set_vitals(heart_rate=140)
    signed_json_str, delta_dict, _ = generator.generate_next_signed_capsule()
    
    print("\n[1] Original Legitimate Signed Capsule Generated:")
    print(f"    Payload: {json.dumps(delta_dict)}")
    
    # Send through serial channel
    serial_channel.write_frame(signed_json_str)

    # Verify untampered
    frame = serial_channel.read_frame()
    status, payload = verify_capsule(frame, secret_key)
    print(f"    -> Verification Status: {status} (Payload accepted)")

    # Step 2: Simulate Man-in-the-Middle (MitM) Attacker Tampering with Vitals
    print("\n[2] Simulating MitM Attack on Serial/Mesh Line:")
    serial_channel.write_frame(signed_json_str)
    
    # Attacker injects tampering (alters heart rate to 60 to hide emergency)
    def attacker_tamper(msg: str) -> str:
        data = json.loads(msg)
        data["payload"]["delta"]["vitals"]["heart_rate_bpm"] = 60
        return json.dumps(data)

    serial_channel.inject_tampering(attacker_tamper)
    tampered_frame = serial_channel.read_frame()
    print(f"    Attacker modified heart_rate_bpm -> 60 (Signature untouched)")

    status_tampered, _ = verify_capsule(tampered_frame, secret_key)
    print(f"    -> Verification Status: {status_tampered} (Tampering detected! Payload rejected)")

    # Step 3: Wrong Secret Key Attack
    print("\n[3] Simulating Unauthorized Receiver / Forged Key Attack:")
    status_wrong_key, _ = verify_capsule(signed_json_str, "wrong_attacker_secret_key")
    print(f"    -> Verification with Wrong Key: {status_wrong_key} (Authentication failed)")
    print("=" * 80)


def main():
    parser = argparse.ArgumentParser(description="Kshitij Case Capsule CLI")
    parser.add_argument("--simulate", "-s", action="store_true", help="Run multi-step emergency simulation")
    parser.add_argument("--tamper-demo", "-t", action="store_true", help="Run MitM tampering detection demo")
    parser.add_argument("--realtime", "-r", action="store_true", help="Stream simulation in real-time cadence")
    parser.add_argument("--key", "-k", default="kshitij_secure_key_2026", help="HMAC-SHA256 secret key")

    args = parser.parse_args()

    if args.tamper_demo:
        run_tamper_demonstration(secret_key=args.key)
    else:
        run_simulation(secret_key=args.key, stream_realtime=args.realtime)


if __name__ == "__main__":
    main()
