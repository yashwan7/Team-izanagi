import hmac
import hashlib
import json
from typing import Dict, Any, Tuple

DEFAULT_SECRET_KEY = "kshitij_secure_hmac_key_2026"

def serialize_for_signature(data: Dict[str, Any]) -> bytes:
    """
    Deterministically serialize capsule data excluding the hmac signature and verification status.
    """
    clean_dict = {k: v for k, v in data.items() if k not in ("hmac_signature", "verification_status")}
    serialized_str = json.dumps(clean_dict, sort_keys=True, separators=(',', ':'))
    return serialized_str.encode('utf-8')

def sign_capsule(capsule_dict: Dict[str, Any], secret_key: str = DEFAULT_SECRET_KEY) -> Dict[str, Any]:
    """
    Compute HMAC-SHA256 and append signature.
    """
    payload_bytes = serialize_for_signature(capsule_dict)
    signature = hmac.new(secret_key.encode('utf-8'), payload_bytes, hashlib.sha256).hexdigest()
    capsule_copy = dict(capsule_dict)
    capsule_copy["hmac_signature"] = signature
    capsule_copy["verification_status"] = "VERIFIED"
    return capsule_copy

def verify_capsule(capsule_dict: Dict[str, Any], secret_key: str = DEFAULT_SECRET_KEY) -> Tuple[str, bool]:
    """
    Verify HMAC-SHA256 signature against payload.
    Returns ('VERIFIED' | 'TAMPERED', is_valid)
    """
    expected_sig = capsule_dict.get("hmac_signature")
    if not expected_sig:
        return "UNVERIFIED", False

    payload_bytes = serialize_for_signature(capsule_dict)
    computed_sig = hmac.new(secret_key.encode('utf-8'), payload_bytes, hashlib.sha256).hexdigest()
    
    if hmac.compare_digest(computed_sig, expected_sig):
        return "VERIFIED", True
    else:
        return "TAMPERED", False
