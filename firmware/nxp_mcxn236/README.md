# FRDM-MCXN236 Nirantara ML deployment

This is the bare-metal NXP MCUXpresso SDK/TensorFlow Lite Micro deployment of
the fixed Nirantara network-state INT8 model.

## Model and preprocessing

The model accepts 22 signed INT8 features and produces three signed INT8 class
scores. The classes are `CRITICAL`, `DEGRADING`, and `HEALTHY`. Its graph uses
only four `FULLY_CONNECTED` operators and one `SOFTMAX`; the firmware registers
only those two operator types in `MicroMutableOpResolver<2>`.

The model is stored as `const` data in `src/model_data.cc`, linked into the
MCXN236 internal program Flash. Runtime tensors and the 32,768-byte,
16-byte-aligned tensor arena are in SRAM. The verified arena usage is 13,572
bytes. External QSPI is not used.

## Build

Use MCUXpresso SDK 26.6 (or a compatible assembled SDK) and provide its root
when configuring:

```bash
cmake -S firmware/nxp_mcxn236 -B /tmp/mcxn236-build -G Ninja \
  -DMCUX_SDK_ROOT=/path/to/mcux-sdk \
  -DCMAKE_C_COMPILER=arm-none-eabi-gcc \
  -DCMAKE_CXX_COMPILER=arm-none-eabi-g++ \
  -DCMAKE_ASM_COMPILER=arm-none-eabi-gcc
ninja -C /tmp/mcxn236-build
```

The project expects the SDK TensorFlow Lite Micro archive at
`middleware/eiq/tensorflow-lite/lib/cm33/armgcc/libtflm.a` and the MCXN236
device/board sources supplied by that SDK. The generated raw application image
is `secure_ota_guardian_mcxn236.raw.bin`; build directories and binaries are
not part of this repository.

The default ML configuration uses the full 1 MiB internal application Flash:

```text
application origin: 0x00000400
application capacity: 1,047,552 bytes
verified raw application image: 633,756 bytes
remaining raw application Flash: 413,796 bytes
```

The existing dual 512 KiB MCUboot contract is retained as a separate linker
variant for reference, but cannot contain this application. See
`docs/mcuboot_single_slot_partition.md` for the required bootloader changes.

## Signing and boot

Do not put a private signing key in this repository. Set
`MCUBOOT_SIGN_KEY` to an existing local key and set `IMGTOOL` if `imgtool.py`
is not on `PATH`:

```bash
MCUBOOT_SIGN_KEY=/secure/local/sign-ecdsa-p256-priv.pem \
IMGTOOL=/secure/local/imgtool.py \
  firmware/nxp_mcxn236/scripts/sign_mcuboot_single_slot_image.sh \
  /tmp/mcxn236-build/secure_ota_guardian_mcxn236.raw.bin \
  1.0.0 /tmp/secure_ota_guardian_mcxn236.signed.bin
```

The single-slot image uses a 0x400-byte header, 16-byte alignment, a 0x100000
slot, 128 maximum sectors, padding, and confirmation for the initial image.
The signature key itself is intentionally excluded.

## Verified hardware result

The following result was recorded on a physical FRDM-MCXN236 after a normal
reset. MCUboot recognized the signed image, validated its ECDSA signature, and
chain-loaded the application before the ML output appeared on UART at 115200:

```text
Bootloader chainload address offset: 0x0
Reset_Handler address offset: 0x400
Jumping to the image
[ML] class=DEGRADING arena=13572 bytes output_int8=[-128,75,-75] cycles=1545556 us=10303
```

This is a hardware measurement, not a host simulation. At the recorded
MCXN236 clock, the measured inference time is 10.303 ms. The host test result
and model accuracy are documented separately in `ml/nirantara_network/`.
