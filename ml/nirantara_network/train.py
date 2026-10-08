import os
import json
import numpy as np
import pandas as pd
import tensorflow as tf

from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix

# ============================================================
# 1. LOAD DATA
# ============================================================

CSV_FILE = "nirantara_integrated_synthetic_telemetry_120k.csv"

df = pd.read_csv(CSV_FILE)

print("\nDataset shape:", df.shape)
print("\nColumns:")
print(df.columns.tolist())

# ============================================================
# 2. TARGET
# ============================================================

TARGET = "network_state"

# We don't want these columns as ML inputs
DROP_COLUMNS = [
    TARGET,
    "episode_id"
]

# Keep only numeric columns
feature_df = df.drop(columns=DROP_COLUMNS, errors="ignore")

numeric_columns = feature_df.select_dtypes(
    include=[np.number]
).columns.tolist()

X = feature_df[numeric_columns].copy()

y_text = df[TARGET].astype(str)

# ============================================================
# 3. ENCODE TARGET
# ============================================================

label_encoder = LabelEncoder()

y = label_encoder.fit_transform(y_text)

print("\nClasses:")
for i, name in enumerate(label_encoder.classes_):
    print(i, "=", name)

# ============================================================
# 4. TRAIN / VALIDATION / TEST SPLIT
# ============================================================

groups = df["episode_id"]

# First: 80% train, 20% temporary
split1 = GroupShuffleSplit(
    n_splits=1,
    test_size=0.20,
    random_state=42
)

train_idx, temp_idx = next(
    split1.split(X, y, groups)
)

# Second: split temporary into validation/test
split2 = GroupShuffleSplit(
    n_splits=1,
    test_size=0.50,
    random_state=42
)

val_relative, test_relative = next(
    split2.split(
        X.iloc[temp_idx],
        y[temp_idx],
        groups.iloc[temp_idx]
    )
)

val_idx = temp_idx[val_relative]
test_idx = temp_idx[test_relative]

X_train = X.iloc[train_idx]
X_val = X.iloc[val_idx]
X_test = X.iloc[test_idx]

y_train = y[train_idx]
y_val = y[val_idx]
y_test = y[test_idx]

print("\nSplit:")
print("Train:", len(X_train))
print("Validation:", len(X_val))
print("Test:", len(X_test))

# ============================================================
# 5. NORMALIZATION
# ============================================================

scaler = StandardScaler()

X_train = scaler.fit_transform(X_train)
X_val = scaler.transform(X_val)
X_test = scaler.transform(X_test)

X_train = X_train.astype(np.float32)
X_val = X_val.astype(np.float32)
X_test = X_test.astype(np.float32)

# ============================================================
# 6. BUILD ~0.8M PARAMETER MODEL
# ============================================================

model = tf.keras.Sequential([
    tf.keras.layers.Input(
        shape=(X_train.shape[1],)
    ),

    tf.keras.layers.Dense(
        640,
        activation="relu"
    ),

    tf.keras.layers.Dense(
        640,
        activation="relu"
    ),

    tf.keras.layers.Dense(
        128,
        activation="relu"
    ),

    tf.keras.layers.Dense(
        len(label_encoder.classes_),
        activation="softmax"
    )
])

model.compile(
    optimizer=tf.keras.optimizers.Adam(
        learning_rate=0.001
    ),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)

print("\nMODEL")
model.summary()

# ============================================================
# 7. TRAIN
# ============================================================

callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor="val_loss",
        patience=8,
        restore_best_weights=True
    )
]

history = model.fit(
    X_train,
    y_train,
    validation_data=(X_val, y_val),
    epochs=50,
    batch_size=256,
    callbacks=callbacks,
    verbose=1
)

# ============================================================
# 8. TEST
# ============================================================

test_loss, test_accuracy = model.evaluate(
    X_test,
    y_test,
    verbose=0
)

print("\n================================")
print("TEST ACCURACY:", test_accuracy)
print("================================")

# ============================================================
# 9. CLASSIFICATION REPORT
# ============================================================

predictions = model.predict(
    X_test,
    verbose=0
)

predicted_classes = np.argmax(
    predictions,
    axis=1
)

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        predicted_classes,
        target_names=label_encoder.classes_
    )
)

print("\nConfusion Matrix:")
print(
    confusion_matrix(
        y_test,
        predicted_classes
    )
)

# ============================================================
# 10. SAVE KERAS MODEL
# ============================================================

model.save(
    "nirantara_network_model.keras"
)

print("\nSaved:")
print("nirantara_network_model.keras")

# ============================================================
# 11. SAVE PREPROCESSING INFORMATION
# ============================================================

np.save(
    "scaler_mean.npy",
    scaler.mean_
)

np.save(
    "scaler_scale.npy",
    scaler.scale_
)

with open(
    "model_metadata.json",
    "w"
) as f:

    json.dump(
        {
            "features": numeric_columns,
            "classes": label_encoder.classes_.tolist(),
            "input_size": len(numeric_columns)
        },
        f,
        indent=2
    )

print("Saved preprocessing files.")
