# NXP FRDM-MCXN236 OLED Display Hardware Guide (Header J8)

This module interfaces the **Kshitij Failover State Machine & TinyML Anomaly Predictor** with a physical **0.96" SSD1306 OLED Display (128x64 I2C)** connected to the **FRDM-MCXN236** development board.

---

## 📌 Hardware Pinout & Wiring (Header J8)

On the **FRDM-MCXN236** (Table 23 of NXP Board User Manual UM12041), connector **J8** is the 28-pin FlexIO/Display header. Connect the 4 OLED pins to Pins 1–4:

| OLED Pin | J8 Pin | FRDM-MCXN236 Net | GPIO / Peripheral | Description |
| :--- | :--- | :--- | :--- | :--- |
| **VCC** (or VDD) | **Pin 1** | `VDD_BOARD` | Power (3.3V) | Board 3.3V supply |
| **GND** | **Pin 2** | `GND` | Ground | System Ground |
| **SCL** (Clock) | **Pin 3** | `FC2_I2C_SCL` | `P4_1` | Flexcomm 2 I2C Clock |
| **SDA** (Data) | **Pin 4** | `FC2_I2C_SDA` | `P4_0` | Flexcomm 2 I2C Data |

*Note: The SSD1306 OLED runs at 3.3V logic levels, perfectly matching the MCXN236 3.3V domain.*

---

## 🚀 How to Run the Hardware Display

### Step 1: Upload Firmware to FRDM-MCXN236
1. Open [`frdm_mcxn236_oled.ino`](./frdm_mcxn236_oled.ino) in Arduino IDE or MCUXpresso.
2. Select your board (`NXP FRDM-MCXN236`) and port (`COM5`).
3. Compile and flash to the board. The OLED will show the initial **"KSHITIJ ENGINE / OLED J8 ACTIVE"** welcome banner.

### Step 2: Start the Live ML Serial Streamer
Run the Python bridge from the repository root:
```bash
python core/failover/oled_bridge.py --port COM5
```

The bridge reads the live TinyML model inference results from the failover engine and streams telemetry over `COM5` (115200 baud).

### Features Displayed on the OLED:
- **TinyML State**: `HEALTHY (0)` | `! DEGRADED (1) !` | `!! CRITICAL (2) !!`
- **Active Path**: `PORT_A` (Primary WAN) or `PORT_B` (Cellular Hot Standby) or `MESH`
- **Link Telemetry**: RTT Latency (ms), Jitter (ms), Packet Loss (%)
- **Degradation Bar Meter**: Real-time sliding window health score (0.00 – 1.00)
- **Flashing Visual Alarm**: Inverts borders when entering `CRITICAL` or `MESH_ACTIVE` mode.
