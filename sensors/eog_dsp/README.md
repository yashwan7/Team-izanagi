# Kshitij EOG (Electrooculography) DSP & Command Module

Real-time biopotential digital signal processing (DSP) engine and assistive command classifier for the **Kshitij Capsule** bio-interface.

---

## 🚀 Overview

This module processes dual-channel EOG electrode biopotential streams sampled at **100 Hz**:
1. **Vertical Channel (vEOG)**: Monitors vertical eyelid deflection biopotentials for blinks.
2. **Horizontal Channel (hEOG)**: Monitors horizontal corneal-retinal dipole step potentials for lateral eye gaze tracking (`LEFT`, `RIGHT`, `CENTER`).

---

## 🧠 DSP Architecture & Pipeline

```
               +-----------------------------------------------------------+
               |  Raw Biopotential Stream @ 100 Hz (vEOG & hEOG)           |
               +-----------------------------------------------------------+
                                             |
                     +-----------------------+-----------------------+
                     |                                               |
                     v                                               v
   +------------------------------------+          +------------------------------------+
   | Vertical Channel (vEOG)            |          | Horizontal Channel (hEOG)          |
   | 4th-Order IIR Butterworth Bandpass |          | 4th-Order IIR Butterworth Lowpass  |
   | (0.1 Hz to 10.0 Hz)                |          | (10.0 Hz Cutoff)                   |
   |                                    |          |                                    |
   | • Attenuates DC drift (< 0.1 Hz)   |          | • Preserves DC step-voltage levels |
   | • Eliminates 50Hz/60Hz mains hum   |          | • Eliminates 50Hz/60Hz mains hum   |
   +------------------------------------+          +------------------------------------+
                     |                                               |
                     v                                               v
   +------------------------------------+          +------------------------------------+
   | Blink Detector                     |          | Gaze Direction Detector            |
   | Pulse-width validation:            |          | Step-voltage shift analysis:       |
   | 100ms <= duration <= 400ms         |          | • Shift >= +60 uV -> 'LEFT'        |
   | Rejects EMG spikes (<100ms) &      |          | • Shift <= -60 uV -> 'RIGHT'       |
   | prolonged drift (>400ms)           |          | • Neutral -> 'CENTER'              |
   +------------------------------------+          +------------------------------------+
                     \                                               /
                      \                                             /
                       v                                           v
               +-----------------------------------------------------------+
               | EOG Command State Machine Engine                          |
               |                                                           |
               | • 2 Blinks within 1.5s       --> 'CALL_NURSE'             |
               | • 3 Blinks within 1.5s       --> 'PAIN'                   |
               | • Gaze 'LEFT'  + 1 Blink     --> 'WATER'                  |
               | • Gaze 'RIGHT' + 1 Blink     --> 'BATHROOM'               |
               +-----------------------------------------------------------+
```

---

## 🎛️ Digital Filter Design

The filter uses cascaded **Second-Order Sections (Biquads)** in Direct Form II Transposed structure for numerical stability:
- **Vertical Bandpass (0.1 Hz - 10.0 Hz)**:
  - 2 $\times$ 2nd-order Highpass sections ($f_c = 0.1\text{ Hz}$, $Q_1 = 0.5412$, $Q_2 = 1.3066$)
  - 2 $\times$ 2nd-order Lowpass sections ($f_c = 10.0\text{ Hz}$, $Q_1 = 0.5412$, $Q_2 = 1.3066$)
  - **Attenuation**: $> 40\text{ dB}$ at $0.01\text{ Hz}$ (DC drift), $> 60\text{ dB}$ at $50\text{ Hz}$ (Mains hum).
- **Horizontal Lowpass (10.0 Hz)**:
  - 2 $\times$ 2nd-order Lowpass sections ($f_c = 10.0\text{ Hz}$) to preserve DC saccadic step levels.

---

## 🖥️ CLI Usage

Run simulated raw EOG stream scenarios:

```bash
# 1. 2 Blinks within 1.5s -> CALL_NURSE
python -m sensors.eog_dsp.cli --scenario nurse

# 2. 3 Blinks within 1.5s -> PAIN
python -m sensors.eog_dsp.cli --scenario pain

# 3. Gaze LEFT + 1 Blink -> WATER
python -m sensors.eog_dsp.cli --scenario water

# 4. Gaze RIGHT + 1 Blink -> BATHROOM
python -m sensors.eog_dsp.cli --scenario bathroom

# 5. Artifact rejection test (EMG spike & slow drift)
python -m sensors.eog_dsp.cli --scenario artifacts

# 6. Stream in real-time (100 Hz cadence with live ASCII meter)
python -m sensors.eog_dsp.cli --scenario nurse --realtime

# 7. Output JSON stream for IPC / robotics bridge
python -m sensors.eog_dsp.cli --scenario water --json
```

---

## 🧪 Running Unit Tests

```bash
python -m unittest sensors.eog_dsp.test_eog_dsp -v
```

---

## 📦 C++ Firmware Integration

Both header (`eog_dsp.hpp`) and implementation (`eog_dsp.cpp`) are provided with zero external dependencies (C++17 standard library only) for direct integration into embedded firmware or RTOS capsules.
