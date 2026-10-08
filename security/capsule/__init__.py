"""
security/capsule package
========================
Data serialization, delta encoding, and HMAC-SHA256 cryptographic security
for Kshitij patient Case Capsules.
"""

from .delta import (
    DEFAULT_BASELINE,
    DeltaDecoder,
    DeltaEncoder,
    apply_dict_delta,
    compute_dict_delta,
)
from .crypto import (
    STATUS_TAMPERED,
    STATUS_VERIFIED,
    VerificationStatus,
    canonicalize_json,
    generate_hmac_sha256,
    sign_capsule,
    verify_capsule,
)
from .channels import MockSerialChannel, MockSocketChannelServer
from .generator import PatientCapsuleGenerator

__all__ = [
    "DeltaEncoder",
    "DeltaDecoder",
    "DEFAULT_BASELINE",
    "compute_dict_delta",
    "apply_dict_delta",
    "sign_capsule",
    "verify_capsule",
    "generate_hmac_sha256",
    "canonicalize_json",
    "STATUS_VERIFIED",
    "STATUS_TAMPERED",
    "VerificationStatus",
    "MockSerialChannel",
    "MockSocketChannelServer",
    "PatientCapsuleGenerator",
]
