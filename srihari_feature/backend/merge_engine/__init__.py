"""
Kshitij Backend Sync & Merge Engine Package
Handles offline delta merging, duplicate deduplication, medication conflict resolution,
and Ollama Llama 3.2 chronological incident timeline synthesis.
"""

from .models import CaseCapsule, TimelineIncident, MedicationEntry, NetworkStatus, TriageEvaluationResponse
from .engine import SyncAndMergeEngine, merge_engine
from .security import sign_capsule, verify_capsule

__all__ = [
    "CaseCapsule",
    "TimelineIncident",
    "MedicationEntry",
    "NetworkStatus",
    "TriageEvaluationResponse",
    "SyncAndMergeEngine",
    "merge_engine",
    "sign_capsule",
    "verify_capsule",
]
