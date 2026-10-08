import numpy as np
import pandas as pd
import tensorflow as tf

from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score


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

label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)

groups = df[GROUP]


# ============================================================
# 2. SAME SPLIT
# ============================================================

gss1 = GroupShuffleSplit(
    n_splits=1,
    test_size=0.20,
    random_state=42
)

train_idx, temp_idx = next(
    gss1.split(X, y_encoded, groups)
)

X_temp = X.iloc[temp_idx].values
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

X_test = X_temp[test_idx]
y_test = y_temp[test_idx]


# ============================================================
# 3. SAME SCALING
# ============================================================

scaler_mean = np.load("scaler_mean.npy")
scaler_scale = np.load("scaler_scale.npy")

X_test = (
    X_test - scaler_mean
) / scaler_scale

X_test = X_test.astype(np.float32)


# ============================================================
# 4. LOAD INT8 MODEL
# ============================================================

MODEL_FILE = "nirantara_network_model_int8.tflite"

interpreter = tf.lite.Interpreter(
    model_path=MODEL_FILE
)

interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

input_info = input_details[0]
output_info = output_details[0]

input_scale, input_zero_point = input_info["quantization"]
output_scale, output_zero_point = output_info["quantization"]

print("================================")
print("INT8 MODEL INFORMATION")
print("================================")

print("Input shape:", input_info["shape"])
print("Input dtype:", input_info["dtype"])
print("Input scale:", input_scale)
print("Input zero point:", input_zero_point)

print()

print("Output shape:", output_info["shape"])
print("Output dtype:", output_info["dtype"])
print("Output scale:", output_scale)
print("Output zero point:", output_zero_point)


# ============================================================
# 5. RUN INT8 INFERENCE
# ============================================================

predictions = []

for sample in X_test:

    sample = sample.reshape(1, -1)

    # Float → INT8
    quantized_input = np.round(
        sample / input_scale
    ) + input_zero_point

    quantized_input = np.clip(
        quantized_input,
        -128,
        127
    ).astype(np.int8)

    interpreter.set_tensor(
        input_info["index"],
        quantized_input
    )

    interpreter.invoke()

    quantized_output = interpreter.get_tensor(
        output_info["index"]
    )

    # INT8 → float
    output = (
        quantized_output.astype(np.float32)
        - output_zero_point
    ) * output_scale

    predicted_class = np.argmax(output, axis=1)[0]

    predictions.append(predicted_class)


predictions = np.array(predictions)


# ============================================================
# 6. RESULTS
# ============================================================

accuracy = accuracy_score(
    y_test,
    predictions
)

print()
print("================================")
print("INT8 TEST RESULTS")
print("================================")

print(
    "INT8 TEST ACCURACY:",
    round(accuracy, 6)
)

print()

print("Classification Report:")
print(
    classification_report(
        y_test,
        predictions,
        target_names=label_encoder.classes_
    )
)

print("Confusion Matrix:")
print(
    confusion_matrix(
        y_test,
        predictions
    )
)

print()
print("================================")
print("FP32 vs INT8")
print("================================")

print("FP32 accuracy : ~0.977")
print("INT8 accuracy :", round(accuracy, 6))
print(
    "Accuracy drop :",
    round(0.977 - accuracy, 6)
)
