# Nirantara INT8 model inspection

Source model:

`/Users/yashwanth/mcxn236-ml/nirantara_network_model_int8.tflite`

- File size: 548,336 bytes
- SHA-256: `e4875d1643ebb1ac08284e64e41f5307b068eca018527a4291cb14f7787aae9d`
- Input tensor: `serving_default_input_layer:0`, `int8`, shape signature `[-1, 22]`, allocated shape `[1, 22]`
- Input quantization: scale `0.11253108829259872`, zero point `74`
- Output tensor: `StatefulPartitionedCall_1:0`, `int8`, shape signature `[-1, 3]`, allocated shape `[1, 3]`
- Output quantization: scale `0.00390625`, zero point `-128`
- Operators: `FULLY_CONNECTED`, `FULLY_CONNECTED`, `FULLY_CONNECTED`, `FULLY_CONNECTED`, `SOFTMAX`
- Model array: `src/model_data.cc`, read-only and linked into internal program Flash
- TFLM tensor arena allocation: `32,768` bytes in SRAM, aligned to 16 bytes
- Verified arena used by `AllocateTensors()`: `13,572` bytes

The three class labels are `CRITICAL`, `DEGRADING`, and `HEALTHY`. The
preprocessing implementation uses the supplied scaler arrays and the model's
input quantization without modifying the model. The deterministic demo vector
is the first telemetry row after that preprocessing and quantizes to:

```text
[59, 70, 69, 71, 68, 73, 70, 70, 74, 88, 71,
 94, 81, 75, 68, 86, 98, 71, 87, 75, 74, 74]
```

The host TFLite interpreter predicts `DEGRADING` with output int8
`[-128, 75, -75]` for that vector. The firmware prints the same output and
the class name after invoking TFLM on the board.
