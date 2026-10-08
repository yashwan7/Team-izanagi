"""
Synthetic network telemetry dataset generator for TinyML anomaly classification.
Generates balanced feature vectors across HEALTHY (0), DEGRADED (1), and CRITICAL (2) network states.
Features: [latency_ms, jitter_ms, packet_loss_pct, dns_time_ms].
"""

import numpy as np
from typing import Tuple, Dict, Any


CLASS_NAMES = ["HEALTHY", "DEGRADED", "CRITICAL"]
LABEL_HEALTHY = 0
LABEL_DEGRADED = 1
LABEL_CRITICAL = 2


def generate_synthetic_telemetry(
    num_samples_per_class: int = 5000,
    random_seed: int = 42,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic telemetry samples for network state classification.

    :param num_samples_per_class: Number of samples per class
    :param random_seed: Seed for reproducibility
    :return: (X, y) where X shape is (N, 4) and y shape is (N,)
    """
    np.random.seed(random_seed)

    # 1. HEALTHY (0): Nominal physical link performance
    # Latency: ~22ms (10-40ms), Jitter: ~2.5ms (0.5-6ms), Loss: ~0.2% (0-1.2%), DNS: ~12ms (4-25ms)
    healthy_lat = np.random.normal(loc=22.0, scale=6.0, size=num_samples_per_class)
    healthy_lat = np.clip(healthy_lat, 8.0, 45.0)

    healthy_jit = np.random.normal(loc=2.5, scale=1.0, size=num_samples_per_class)
    healthy_jit = np.clip(healthy_jit, 0.5, 6.0)

    healthy_loss = np.random.exponential(scale=0.2, size=num_samples_per_class)
    healthy_loss = np.clip(healthy_loss, 0.0, 1.2)

    healthy_dns = np.random.normal(loc=12.0, scale=3.5, size=num_samples_per_class)
    healthy_dns = np.clip(healthy_dns, 3.0, 25.0)

    X_healthy = np.column_stack([healthy_lat, healthy_jit, healthy_loss, healthy_dns])
    y_healthy = np.full(num_samples_per_class, LABEL_HEALTHY, dtype=np.int32)

    # 2. DEGRADED (1): Congestion, bufferbloat, minor packet drops
    # Latency: ~120ms (60-200ms), Jitter: ~18ms (8-35ms), Loss: ~8% (3-20%), DNS: ~65ms (30-110ms)
    deg_lat = np.random.normal(loc=120.0, scale=28.0, size=num_samples_per_class)
    deg_lat = np.clip(deg_lat, 55.0, 205.0)

    deg_jit = np.random.normal(loc=18.0, scale=5.5, size=num_samples_per_class)
    deg_jit = np.clip(deg_jit, 7.5, 36.0)

    deg_loss = np.random.uniform(low=2.5, high=18.5, size=num_samples_per_class)
    deg_loss = np.clip(deg_loss, 2.0, 20.0)

    deg_dns = np.random.normal(loc=65.0, scale=16.0, size=num_samples_per_class)
    deg_dns = np.clip(deg_dns, 28.0, 115.0)

    X_degraded = np.column_stack([deg_lat, deg_jit, deg_loss, deg_dns])
    y_degraded = np.full(num_samples_per_class, LABEL_DEGRADED, dtype=np.int32)

    # 3. CRITICAL (2): Severe link failure, physical brownout, black hole
    # Latency: ~350ms (220-750ms), Jitter: ~50ms (30-150ms), Loss: ~48% (24-100%), DNS: ~220ms (120-500ms)
    crit_lat = np.random.exponential(scale=120.0, size=num_samples_per_class) + 220.0
    crit_lat = np.clip(crit_lat, 215.0, 800.0)

    crit_jit = np.random.exponential(scale=30.0, size=num_samples_per_class) + 32.0
    crit_jit = np.clip(crit_jit, 30.0, 180.0)

    crit_loss = np.random.uniform(low=24.0, high=98.0, size=num_samples_per_class)
    crit_loss = np.clip(crit_loss, 22.0, 100.0)

    crit_dns = np.random.exponential(scale=80.0, size=num_samples_per_class) + 120.0
    crit_dns = np.clip(crit_dns, 118.0, 600.0)

    X_critical = np.column_stack([crit_lat, crit_jit, crit_loss, crit_dns])
    y_critical = np.full(num_samples_per_class, LABEL_CRITICAL, dtype=np.int32)

    # Concatenate and shuffle
    X = np.vstack([X_healthy, X_degraded, X_critical]).astype(np.float32)
    y = np.concatenate([y_healthy, y_degraded, y_critical]).astype(np.int32)

    indices = np.arange(len(X))
    np.random.shuffle(indices)

    return X[indices], y[indices]


def compute_normalization_parameters(X: np.ndarray) -> Dict[str, Any]:
    """Calculate mean and std deviations for standard normalization."""
    mean = np.mean(X, axis=0)
    std = np.std(X, axis=0)
    std[std == 0.0] = 1.0  # Prevent division by zero

    return {
        "mean": mean.tolist(),
        "std": std.tolist(),
        "feature_names": ["latency_ms", "jitter_ms", "packet_loss_pct", "dns_time_ms"],
        "class_labels": CLASS_NAMES,
    }
