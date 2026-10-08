"""
Lightweight TinyML Model Architectures for Network Anomaly Classification.
Provides both an ultra-low-latency MLP and a temporal LSTM architecture.
Classes: HEALTHY (0), DEGRADED (1), CRITICAL (2).
"""

from typing import Tuple


def build_lightweight_mlp(
    input_dim: int = 4,
    num_classes: int = 3,
    learning_rate: float = 0.001,
):
    """
    Build an ultra-lightweight Multi-Layer Perceptron (MLP) for TinyML deployment.
    Architecture:
      Input (4) -> Dense(32, ReLU) -> BatchNormalization -> Dropout(0.1)
                -> Dense(16, ReLU) -> Dense(3, Softmax)
    Designed for sub-millisecond INT8 inference on constrained hardware.
    """
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers

    model = keras.Sequential([
        layers.Input(shape=(input_dim,), name="telemetry_input"),
        layers.Dense(32, activation="relu", name="dense_features"),
        layers.BatchNormalization(name="batch_norm"),
        layers.Dropout(0.1, name="dropout"),
        layers.Dense(16, activation="relu", name="dense_compression"),
        layers.Dense(num_classes, activation="softmax", name="class_probabilities"),
    ], name="tinyml_anomaly_mlp")

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def build_temporal_lstm(
    timesteps: int = 10,
    num_features: int = 4,
    num_classes: int = 3,
    learning_rate: float = 0.001,
):
    """
    Build a lightweight recurrent LSTM model for temporal sequential telemetry classification.
    """
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers

    model = keras.Sequential([
        layers.Input(shape=(timesteps, num_features), name="temporal_input"),
        layers.LSTM(16, return_sequences=False, name="recurrent_lstm"),
        layers.Dense(16, activation="relu", name="dense_post_lstm"),
        layers.Dense(num_classes, activation="softmax", name="class_probabilities"),
    ], name="tinyml_anomaly_lstm")

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model
