# Nirantara network-state INT8 model

This directory contains the exact trained artifact used by the MCXN236
deployment. The deployable model is not regenerated, retrained, or
requantized as part of the firmware build.

## Model

- Input: signed INT8 tensor with allocated shape `[1, 22]`
- Input quantization: scale `0.11253108829259872`, zero point `74`
- Output: signed INT8 tensor with allocated shape `[1, 3]`
- Output quantization: scale `0.00390625`, zero point `-128`
- Classes, in output order: `CRITICAL`, `DEGRADING`, `HEALTHY`
- Operators: four `FULLY_CONNECTED` operators followed by `SOFTMAX`
- INT8 model size: 548,336 bytes
- INT8 model SHA-256: `e4875d1643ebb1ac08284e64e41f5307b068eca018527a4291cb14f7787aae9d`

`model_metadata.json` defines the 22 feature names and class labels. The two
`.npy` files are the preprocessing scaler mean and scale used before INT8
quantization. The embedded firmware contains the same model as a const
read-only byte array in `firmware/nxp_mcxn236/src/model_data.cc`.

## Reproduction

The scripts use the original training/evaluation workflow and expect the
synthetic telemetry CSV at the path configured in each script. The 120,000-row
CSV is intentionally not committed: it is approximately 29 MB, its licensing
has not been established, and it is not required to run the deployed model.
Supply that dataset separately when reproducing training or conversion.

```bash
python3 train.py
python3 convert_int8.py
python3 test_int8.py
```

The conversion script requires the trained Keras artifact, scaler assets, and
the dataset. The checked-in Keras artifact is included only as the conversion
input; the firmware uses the checked-in INT8 TFLite artifact.
