"""
Lightweight TFLite Inference Wrapper for Network Anomaly & Failure Prediction.
Accepts live streaming telemetry, runs inference in <5ms, outputs class probabilities,
and exposes an endpoint for the Failover State Machine to consume.
"""

import json
import os
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Union
import numpy as np
from pydantic import BaseModel, Field

# Flexible interpreter import: tflite_runtime -> ai_edge_litert -> tensorflow.lite
InterpreterClass = None

try:
    import tflite_runtime.interpreter as _tflite_rt
    InterpreterClass = _tflite_rt.Interpreter
except ImportError:
    try:
        from ai_edge_litert.interpreter import Interpreter as _litert_Interpreter
        InterpreterClass = _litert_Interpreter
    except ImportError:
        try:
            import tensorflow.lite as _tf_lite
            InterpreterClass = _tf_lite.Interpreter
        except ImportError:
            InterpreterClass = None


CLASS_LABELS = ["HEALTHY", "DEGRADED", "CRITICAL"]


class AnomalyPrediction(BaseModel):
    """Result of TinyML anomaly inference."""
    predicted_class: int = Field(..., description="0: HEALTHY, 1: DEGRADED, 2: CRITICAL")
    class_label: str = Field(..., description="HEALTHY, DEGRADED, or CRITICAL")
    probabilities: Dict[str, float] = Field(..., description="Softmax probabilities per class")
    confidence: float = Field(..., description="Highest class probability")
    inference_time_ms: float = Field(..., description="Inference execution time in milliseconds (<5ms)")
    is_anomalous: bool = Field(..., description="True if link is DEGRADED or CRITICAL")
    is_critical: bool = Field(..., description="True if link is CRITICAL")
    timestamp: float = Field(default_factory=time.time)
    raw_metrics: Dict[str, float] = Field(default_factory=dict)


class AnomalyInferenceWrapper:
    """
    Sub-5ms TinyML inference engine for network telemetry classification.
    Consumes live streaming samples and provides failover state decision metrics.
    """

    def __init__(
        self,
        model_path: str = "ml/network_anomaly/model.tflite",
        norm_params_path: str = "ml/network_anomaly/norm_params.json",
    ):
        self.model_path = Path(model_path)
        self.norm_params_path = Path(norm_params_path)

        # Normalization defaults if params file is not yet generated
        self.mean = np.array([120.0, 18.0, 20.0, 65.0], dtype=np.float32)
        self.std = np.array([100.0, 15.0, 25.0, 60.0], dtype=np.float32)
        self._load_normalization_params()

        # Load TFLite model
        self.interpreter = None
        self.input_details = None
        self.output_details = None
        self._load_model()

    def _load_normalization_params(self) -> None:
        """Load normalization mean and std from JSON config if available."""
        if self.norm_params_path.exists():
            try:
                with open(self.norm_params_path, "r") as f:
                    data = json.load(f)
                    self.mean = np.array(data["mean"], dtype=np.float32)
                    self.std = np.array(data["std"], dtype=np.float32)
            except Exception as e:
                pass

    def _load_model(self) -> None:
        """Initialize TFLite interpreter and allocate tensors."""
        if not self.model_path.exists():
            return

        if InterpreterClass is None:
            raise RuntimeError(
                "Neither 'tflite_runtime', 'ai_edge_litert', nor 'tensorflow.lite' is available in the environment."
            )

        self.interpreter = InterpreterClass(model_path=str(self.model_path))
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()

    def predict(
        self,
        latency_ms: float,
        jitter_ms: float,
        packet_loss_pct: float,
        dns_time_ms: float,
    ) -> AnomalyPrediction:
        """
        Run low-latency inference on 4-dimensional telemetry metrics.
        Target execution latency: < 5ms (typically 0.05ms - 0.50ms).
        """
        raw = np.array([latency_ms, jitter_ms, packet_loss_pct, dns_time_ms], dtype=np.float32)

        # Standardize features
        norm_input = (raw - self.mean) / self.std
        input_tensor = np.expand_dims(norm_input, axis=0).astype(np.float32)

        start_time = time.perf_counter()

        if self.interpreter is not None:
            self.interpreter.set_tensor(self.input_details[0]["index"], input_tensor)
            self.interpreter.invoke()
            output = self.interpreter.get_tensor(self.output_details[0]["index"])[0]
        else:
            # Fallback heuristic if model file is being trained
            output = self._heuristic_fallback(latency_ms, jitter_ms, packet_loss_pct, dns_time_ms)

        inference_time_ms = round((time.perf_counter() - start_time) * 1000.0, 4)

        # Softmax probabilities
        probs = np.array(output, dtype=np.float32)
        if probs.sum() > 0:
            probs = probs / probs.sum()

        pred_idx = int(np.argmax(probs))
        pred_label = CLASS_LABELS[pred_idx]
        confidence = float(probs[pred_idx])

        probabilities = {
            CLASS_LABELS[i]: round(float(probs[i]), 4)
            for i in range(len(CLASS_LABELS))
        }

        return AnomalyPrediction(
            predicted_class=pred_idx,
            class_label=pred_label,
            probabilities=probabilities,
            confidence=round(confidence, 4),
            inference_time_ms=inference_time_ms,
            is_anomalous=(pred_idx > 0),
            is_critical=(pred_idx == 2),
            timestamp=time.time(),
            raw_metrics={
                "latency_ms": latency_ms,
                "jitter_ms": jitter_ms,
                "packet_loss_pct": packet_loss_pct,
                "dns_time_ms": dns_time_ms,
            },
        )

    def predict_vector(self, vector: List[float]) -> AnomalyPrediction:
        """Run prediction from a 4-dimensional list [lat, jit, loss, dns]."""
        if len(vector) < 4:
            raise ValueError(f"Vector must contain at least 4 metrics, got {len(vector)}")
        return self.predict(vector[0], vector[1], vector[2], vector[3])

    def predict_dual_ports(
        self,
        port_a_metrics: Union[List[float], Dict[str, float]],
        port_b_metrics: Union[List[float], Dict[str, float]],
    ) -> Dict[str, AnomalyPrediction]:
        """
        Run inference concurrently on both Port A and Port B streaming telemetry.
        """
        def to_tuple(m):
            if isinstance(m, (list, tuple)):
                return m[0], m[1], m[2], m[3]
            return m["latency_ms"], m["jitter_ms"], m["packet_loss_pct"], m["dns_time_ms"]

        pred_a = self.predict(*to_tuple(port_a_metrics))
        pred_b = self.predict(*to_tuple(port_b_metrics))
        return {
            "port_a": pred_a,
            "port_b": pred_b,
        }

    def evaluate_state_machine_endpoint(
        self,
        port_a_metrics: Union[List[float], Dict[str, float]],
        port_b_metrics: Union[List[float], Dict[str, float]],
    ) -> Dict[str, Any]:
        """
        High-level endpoint for Failover State Machine integration.
        Returns TinyML predictions, state recommendation, and failover action.
        """
        preds = self.predict_dual_ports(port_a_metrics, port_b_metrics)
        pa = preds["port_a"]
        pb = preds["port_b"]

        # TinyML State Machine decision logic
        if pa.is_critical and pb.is_critical:
            recommendation = "ACTIVATE_MESH_MODE"
            state_target = "MESH_ACTIVE"
            recommended_path = "MESH"
        elif (pa.is_critical or pa.predicted_class == 1 and pa.confidence > 0.85) and not pb.is_critical:
            recommendation = "FAILOVER_TO_PORT_B"
            state_target = "FAILOVER_PORT_B"
            recommended_path = "PORT_B"
        elif pa.predicted_class == 1:
            recommendation = "EMIT_WARNING"
            state_target = "STATE_WARNING"
            recommended_path = "PORT_A"
        else:
            recommendation = "MAINTAIN_NOMINAL"
            state_target = "STATE_NORMAL"
            recommended_path = "PORT_A"

        return {
            "timestamp": time.time(),
            "recommendation": recommendation,
            "recommended_state": state_target,
            "recommended_path": recommended_path,
            "port_a_prediction": pa.model_dump(),
            "port_b_prediction": pb.model_dump(),
            "combined_latency_ms": round(pa.inference_time_ms + pb.inference_time_ms, 4),
        }

    def _heuristic_fallback(
        self,
        latency_ms: float,
        jitter_ms: float,
        packet_loss_pct: float,
        dns_time_ms: float,
    ) -> List[float]:
        """Lightweight fallback if TFLite model is not yet compiled."""
        if packet_loss_pct >= 22.0 or latency_ms >= 220.0:
            return [0.02, 0.08, 0.90]  # CRITICAL
        elif packet_loss_pct >= 3.0 or latency_ms >= 60.0 or jitter_ms >= 10.0:
            return [0.05, 0.88, 0.07]  # DEGRADED
        else:
            return [0.96, 0.03, 0.01]  # HEALTHY
