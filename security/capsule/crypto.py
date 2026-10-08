"""
security/capsule/crypto.py
==========================
HMAC-SHA256 Cryptographic Authentication & Integrity Engine for Kshitij Case Capsules.

Protects against:
  - Man-in-the-Middle (MitM) payload tampering / spoofing
  - Tactical radio message corruption
  - Unauthorized injection of fake vitals or distress alerts
"""

from enum import Enum
import hashlib
import hmac
import json
import time
from typing import Any, Dict, Optional, Tuple, Union


class VerificationStatus(str, Enum):
    VERIFIED = "VERIFIED"
    TAMPERED = "TAMPERED"


STATUS_VERIFIED = VerificationStatus.VERIFIED.value
STATUS_TAMPERED = VerificationStatus.TAMPERED.value


def canonicalize_json(data: Any) -> bytes:
    """
    Produces deterministic canonical JSON byte representation with sorted keys
    and compact delimiters (no extraneous whitespace).
    """
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def generate_hmac_sha256(payload_bytes: bytes, secret_key: Union[str, bytes]) -> str:
    """
    Computes HMAC-SHA256 hex digest over payload bytes using secret_key.
    """
    if isinstance(secret_key, str):
        key_bytes = secret_key.encode("utf-8")
    else:
        key_bytes = bytes(secret_key)

    h = hmac.new(key_bytes, payload_bytes, hashlib.sha256)
    return h.hexdigest()


def sign_capsule(
    capsule_json: Union[str, Dict[str, Any]],
    secret_key: Union[str, bytes],
    include_timestamp: bool = True
) -> str:
    """
    Signs a Case Capsule dictionary or JSON string with an appended HMAC-SHA256 signature.

    Envelope structure:
    {
        "payload": { ... capsule delta or full content ... },
        "signature": "<64-character hex HMAC-SHA256>",
        "algorithm": "HMAC-SHA256",
        "signed_at": 1718000000.123
    }

    Returns:
        Serialized JSON string of the signed envelope.
    """
    if isinstance(capsule_json, str):
        payload_data = json.loads(capsule_json)
    else:
        payload_data = capsule_json

    canonical_payload = canonicalize_json(payload_data)
    sig_hex = generate_hmac_sha256(canonical_payload, secret_key)

    envelope: Dict[str, Any] = {
        "payload": payload_data,
        "signature": sig_hex,
        "algorithm": "HMAC-SHA256",
    }

    if include_timestamp:
        envelope["signed_at"] = time.time()

    return json.dumps(envelope, separators=(",", ":"))


def verify_capsule(
    signed_capsule_json: Union[str, Dict[str, Any]],
    secret_key: Union[str, bytes]
) -> Tuple[str, Optional[Dict[str, Any]]]:
    """
    Verifies the cryptographic integrity of a signed capsule envelope.

    Returns:
        ("VERIFIED", payload_dict) if signature matches.
        ("TAMPERED", None) if signature is invalid, payload was altered, or format is corrupted.
    """
    try:
        if isinstance(signed_capsule_json, str):
            envelope = json.loads(signed_capsule_json)
        elif isinstance(signed_capsule_json, dict):
            envelope = signed_capsule_json
        else:
            return STATUS_TAMPERED, None

        if not isinstance(envelope, dict):
            return STATUS_TAMPERED, None

        if "payload" not in envelope or "signature" not in envelope:
            return STATUS_TAMPERED, None

        payload_data = envelope["payload"]
        provided_signature = str(envelope["signature"]).strip()

        # Re-compute expected signature over canonical payload
        canonical_payload = canonicalize_json(payload_data)
        expected_signature = generate_hmac_sha256(canonical_payload, secret_key)

        # Constant-time comparison to prevent timing side-channel attacks
        if hmac.compare_digest(provided_signature.lower(), expected_signature.lower()):
            return STATUS_VERIFIED, payload_data
        else:
            return STATUS_TAMPERED, None

    except Exception:
        return STATUS_TAMPERED, None
