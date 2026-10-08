import numpy as np
import pandas as pd
import tensorflow as tf

from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import GroupShuffleSplit


# ============================================================
# 1. LOAD DATA
# ============================================================

CSV_FILE = "nirantara_integrated_synthetic_telemetry_120k.csv"

df = pd.read_csv(CSV_FILE)

TARGET = "network_state"
GROUP = "episode_id"

X = df.drop(columns=[TARGET, GROUP])
X = X.select_dtypes(include=[np.number])

y = df[TARGET]

print("Input features:", X.shape[1])
print("Total samples:", len(X))


# ============================================================
# 2. SAME TRAIN/VAL/TEST SPLIT AS TRAINING
# ============================================================

label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)

groups = df[GROUP]

gss1 = GroupShuffleSplit(
    n_splits=1,
    test_size=0.20,
    random_state=42
)

train_idx, temp_idx = next(
    gss1.split(X, y_encoded, groups)
)

X_train = X.iloc[train_idx].values
X_temp = X.iloc[temp_idx].values

y_train = y_encoded[train_idx]
y_temp = y_encoded[temp_idx]

groups_temp = groups.iloc[temp_idx]

gss2 = GroupShuffleSplit(
    n_splits=1,
    test_size=0.50,
    random_state=42
)

val_idx, test_idx = next(
    gss2.split(X_temp, y_temp, groups_temp)
)

X_val = X_temp[val_idx]
X_test = X_temp[test_idx]


# ============================================================
# 3. LOAD THE SAME SCALER USED DURING TRAINING
# ============================================================

scaler_mean = np.load("scaler_mean.npy")
scaler_scale = np.load("scaler_scale.npy")

X_train_scaled = (
    X_train - scaler_mean
) / scaler_scale

X_val_scaled = (
    X_val - scaler_mean
) / scaler_scale

X_test_scaled = (
    X_test - scaler_mean
) / scaler_scale


X_train_scaled = X_train_scaled.astype(np.float32)
X_val_scaled = X_val_scaled.astype(np.float32)
X_test_scaled = X_test_scaled.astype(np.float32)


print("Scaled input shape:", X_train_scaled.shape)


# ============================================================
# 4. LOAD TRAINED MODEL
# ============================================================

model = tf.keras.models.load_model(
    "nirantara_network_model.keras"
)

print("\nModel parameters:", model.count_params())


# ============================================================
# 5. REPRESENTATIVE DATASET
# ============================================================

# 500 REAL samples from training data
calibration_data = X_train_scaled[:500]


def representative_dataset():
    for sample in calibration_data:
        sample = sample.reshape(1, -1).astype(np.float32)
        yield [sample]


# ============================================================
# 6. FULL INT8 QUANTIZATION
# ============================================================

converter = tf.lite.TFLiteConverter.from_keras_model(model)

converter.optimizations = [
    tf.lite.Optimize.DEFAULT
]

converter.representative_dataset = representative_dataset

converter.target_spec.supported_ops = [
    tf.lite.OpsSet.TFLITE_BUILTINS_INT8
]

converter.inference_input_type = tf.int8
converter.inference_output_type = tf.int8


print("\nConverting to full INT8...")

tflite_model = converter.convert()


# ============================================================
# 7. SAVE MODEL
# ============================================================

OUTPUT_FILE = "nirantara_network_model_int8.tflite"

with open(OUTPUT_FILE, "wb") as f:
    f.write(tflite_model)


# ============================================================
# 8. PRINT SIZE
# ============================================================

size_bytes = len(tflite_model)
size_kb = size_bytes / 1024
size_mb = size_kb / 1024

print("\n================================")
print("INT8 MODEL CREATED")
print("================================")

print("File:", OUTPUT_FILE)
print("Size:", size_bytes, "bytes")
print("Size:", round(size_kb, 2), "KB")
print("Size:", round(size_mb, 3), "MB")

print("\nInput type: INT8")
print("Output type: INT8")
