"""
Training and INT8 Quantization Export Pipeline for TinyML Network Anomaly Classifier.
Trains an ultra-lightweight MLP on synthetic telemetry features, achieves >95% accuracy,
and exports the model to an INT8 quantized TFLite model ('model.tflite').
"""

import os
import json
import time
import numpy as np
from pathlib import Path

from .dataset import generate_synthetic_telemetry, compute_normalization_parameters, CLASS_NAMES
from .model import build_lightweight_mlp


def train_and_export_tflite(
    model_output_path: str = "ml/network_anomaly/model.tflite",
    norm_params_path: str = "ml/network_anomaly/norm_params.json",
    num_samples_per_class: int = 5000,
    epochs: int = 20,
    batch_size: int = 64,
):
    import tensorflow as tf
    from tensorflow import keras

    print("=" * 70)
    print(">>> 1. Generating synthetic network telemetry training dataset...")
    X, y = generate_synthetic_telemetry(num_samples_per_class=num_samples_per_class, random_seed=42)
    print(f"Total samples: {len(X)} across 3 classes (HEALTHY, DEGRADED, CRITICAL)")

    # Compute & save normalization parameters
    norm_params = compute_normalization_parameters(X)
    mean = np.array(norm_params["mean"], dtype=np.float32)
    std = np.array(norm_params["std"], dtype=np.float32)

    Path(norm_params_path).parent.mkdir(parents=True, exist_ok=True)
    with open(norm_params_path, "w") as f:
        json.dump(norm_params, f, indent=2)
    print(f"Saved normalization parameters to {norm_params_path}")

    # Standardize input features
    X_norm = (X - mean) / std

    # Train / Val / Test split (70% / 15% / 15%)
    n = len(X_norm)
    n_train = int(0.70 * n)
    n_val = int(0.15 * n)

    X_train, y_train = X_norm[:n_train], y[:n_train]
    X_val, y_val = X_norm[n_train:n_train + n_val], y[n_train:n_train + n_val]
    X_test, y_test = X_norm[n_train + n_val:], y[n_train + n_val:]

    print(f"Dataset split: Train={len(X_train)}, Val={len(X_val)}, Test={len(X_test)}")

    print("\n" + "=" * 70)
    print(">>> 2. Building and training lightweight TinyML MLP classifier...")
    model = build_lightweight_mlp(input_dim=4, num_classes=3)
    model.summary()

    callbacks = [
        keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-5),
    ]

    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1,
    )

    print("\n" + "=" * 70)
    print(">>> 3. Evaluating Model Accuracy on Test Set...")
    loss, accuracy = model.evaluate(X_test, y_test, verbose=0)
    print(f"Keras Test Loss: {loss:.4f}")
    print(f"Keras Test Accuracy: {accuracy * 100:.2f}% (Target: >95.0%)")

    if accuracy < 0.95:
        raise RuntimeError(f"Model failed to achieve target accuracy >95%! Achieved: {accuracy * 100:.2f}%")

    # Save Keras Model
    keras_path = str(Path(model_output_path).with_suffix(".keras"))
    model.save(keras_path)
    print(f"Saved Keras model to {keras_path}")

    print("\n" + "=" * 70)
    print(">>> 4. Quantizing Model to INT8 TFLite ('model.tflite')...")

    # Representative dataset generator for INT8 calibration
    def representative_dataset_gen():
        for i in range(min(500, len(X_train))):
            sample = X_train[i:i+1].astype(np.float32)
            yield [sample]

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset_gen
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS_INT8,
        tf.lite.OpsSet.TFLITE_BUILTINS,
    ]

    tflite_quantized_model = converter.convert()

    # Save TFLite model
    Path(model_output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(model_output_path, "wb") as f:
        f.write(tflite_quantized_model)

    model_size_kb = len(tflite_quantized_model) / 1024.0
    print(f"Successfully exported INT8 TFLite model to: {model_output_path}")
    print(f"TFLite model size: {model_size_kb:.2f} KB (Ultra-compact TinyML footprint)")

    print("\n" + "=" * 70)
    print(">>> 5. Validating INT8 TFLite Model Inference Accuracy & Latency...")
    # Validate with interpreter
    interpreter = tf.lite.Interpreter(model_content=tflite_quantized_model)
    interpreter.allocate_tensors()

    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()

    correct_predictions = 0
    num_eval = min(1000, len(X_test))

    latencies = []
    for i in range(num_eval):
        sample = X_test[i:i+1].astype(np.float32)
        start_t = time.perf_counter()
        interpreter.set_tensor(input_details[0]["index"], sample)
        interpreter.invoke()
        output_data = interpreter.get_tensor(output_details[0]["index"])
        dur = (time.perf_counter() - start_t) * 1000.0  # ms
        latencies.append(dur)

        pred_class = int(np.argmax(output_data))
        if pred_class == y_test[i]:
            correct_predictions += 1

    tflite_acc = (correct_predictions / num_eval) * 100.0
    avg_latency = float(np.mean(latencies))
    p95_latency = float(np.percentile(latencies, 95))

    print(f"INT8 TFLite Test Accuracy: {tflite_acc:.2f}% (Target: >95.0%)")
    print(f"Average Inference Latency: {avg_latency:.3f} ms (Target: <5.0 ms)")
    print(f"95th Percentile Latency: {p95_latency:.3f} ms")

    report = {
        "accuracy_pct": round(tflite_acc, 2),
        "keras_accuracy_pct": round(accuracy * 100, 2),
        "avg_latency_ms": round(avg_latency, 3),
        "p95_latency_ms": round(p95_latency, 3),
        "model_size_kb": round(model_size_kb, 2),
        "classes": CLASS_NAMES,
        "input_features": norm_params["feature_names"],
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    report_path = str(Path(model_output_path).parent / "training_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"Saved training report to: {report_path}")
    print("=" * 70)
    return report


if __name__ == "__main__":
    train_and_export_tflite()
