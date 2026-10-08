/**
 * Kshitij Dashboard - Client-side DSP & Security Engine
 * Real-time 100 Hz EOG biopotential filtering, Gaze tracking, Delta compression, and HMAC-SHA256 Auth.
 */

// ============================================================================
// 1. Digital Filter (4th-order IIR Butterworth in JS)
// ============================================================================
class BiquadSectionJS {
  constructor(b0, b1, b2, a1, a2) {
    this.b0 = b0; this.b1 = b1; this.b2 = b2;
    this.a1 = a1; this.a2 = a2;
    this.d1 = 0.0; this.d2 = 0.0;
  }
  process(x) {
    const y = this.b0 * x + this.d1;
    this.d1 = this.b1 * x - this.a1 * y + this.d2;
    this.d2 = this.b2 * x - this.a2 * y;
    return y;
  }
  reset() { this.d1 = 0.0; this.d2 = 0.0; }
}

function designLowpass(fc, fs, q) {
  const w0 = 2.0 * Math.PI * fc / fs;
  const alpha = Math.sin(w0) / (2.0 * q);
  const cos_w0 = Math.cos(w0);
  const b0 = (1.0 - cos_w0) / 2.0, b1 = 1.0 - cos_w0, b2 = (1.0 - cos_w0) / 2.0;
  const a0 = 1.0 + alpha, a1 = -2.0 * cos_w0, a2 = 1.0 - alpha;
  return new BiquadSectionJS(b0/a0, b1/a0, b2/a0, a1/a0, a2/a0);
}

function designHighpass(fc, fs, q) {
  const w0 = 2.0 * Math.PI * fc / fs;
  const alpha = Math.sin(w0) / (2.0 * q);
  const cos_w0 = Math.cos(w0);
  const b0 = (1.0 + cos_w0) / 2.0, b1 = -(1.0 + cos_w0), b2 = (1.0 + cos_w0) / 2.0;
  const a0 = 1.0 + alpha, a1 = -2.0 * cos_w0, a2 = 1.0 - alpha;
  return new BiquadSectionJS(b0/a0, b1/a0, b2/a0, a1/a0, a2/a0);
}

class ButterworthBandpassJS {
  constructor(lowcut = 0.1, highcut = 10.0, fs = 100.0) {
    const q1 = 1.0 / (2.0 * Math.cos(Math.PI / 8.0));
    const q2 = 1.0 / (2.0 * Math.cos(3.0 * Math.PI / 8.0));
    this.sections = [
      designHighpass(lowcut, fs, q1),
      designHighpass(lowcut, fs, q2),
      designLowpass(highcut, fs, q1),
      designLowpass(highcut, fs, q2)
    ];
  }
  process(x) {
    let out = x;
    for (const s of this.sections) out = s.process(out);
    return out;
  }
  reset() { this.sections.forEach(s => s.reset()); }
}

class ButterworthLowpassJS {
  constructor(cutoff = 10.0, fs = 100.0) {
    const q1 = 1.0 / (2.0 * Math.cos(Math.PI / 8.0));
    const q2 = 1.0 / (2.0 * Math.cos(3.0 * Math.PI / 8.0));
    this.sections = [
      designLowpass(cutoff, fs, q1),
      designLowpass(cutoff, fs, q2)
    ];
  }
  process(x) {
    let out = x;
    for (const s of this.sections) out = s.process(out);
    return out;
  }
  reset() { this.sections.forEach(s => s.reset()); }
}

// ============================================================================
// 2. Client-side HMAC-SHA256 Generator & Verifier
// ============================================================================
async function computeHmacSha256(messageStr, secretKeyStr) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKeyStr),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(messageStr));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// 3. Delta Engine
// ============================================================================
function computeDelta(baseline, current) {
  const delta = {};
  for (const [key, currVal] of Object.entries(current)) {
    if (!(key in baseline)) {
      delta[key] = JSON.parse(JSON.stringify(currVal));
    } else {
      const baseVal = baseline[key];
      if (typeof currVal === "object" && currVal !== null && typeof baseVal === "object" && baseVal !== null) {
        const sub = computeDelta(baseVal, currVal);
        if (Object.keys(sub).length > 0) delta[key] = sub;
      } else if (currVal !== baseVal) {
        delta[key] = currVal;
      }
    }
  }
  return delta;
}

// ============================================================================
// 4. Main Dashboard Application State & Loop
// ============================================================================
const state = {
  isRunning: true,
  isTamperInjected: false,
  secretKey: "kshitij_secure_key_2026",
  fs: 100,
  sampleIndex: 0,
  
  // DSP Filters
  vFilter: new ButterworthBandpassJS(0.1, 10.0, 100.0),
  hFilter: new ButterworthLowpassJS(10.0, 100.0),
  
  // Ring Buffers for Oscilloscope Traces
  bufferLength: 400,
  traces: {
    rawV: new Array(400).fill(0),
    filtV: new Array(400).fill(0),
    filtH: new Array(400).fill(0),
  },

  // EOG & Classifier State
  inPulse: false,
  pulseStartIdx: 0,
  blinkHistory: [],
  currentGaze: "CENTER",
  activeCommand: null,
  activeCommandTimer: null,

  // Scenario playback queue
  scenarioQueue: [],

  // Patient Baseline Dictionary
  baseline: {
    patient_id: "KZ-PATIENT-001",
    status: "MONITORING",
    triage_color: "GREEN",
    fall_detected: false,
    vitals: {
      heart_rate_bpm: 75,
      spo2_percent: 98,
      systolic_bp: 120,
      diastolic_bp: 80,
      temperature_c: 36.8,
      respiratory_rate: 16
    },
    gps: {
      latitude: 12.9716,
      longitude: 77.5946,
      altitude_m: 920.0
    },
    eye_gaze: {
      direction: "CENTER",
      blink_count: 0,
      last_command: "NONE"
    }
  },
  
  // Current patient state
  currentPatient: null
};

state.currentPatient = JSON.parse(JSON.stringify(state.baseline));

// ============================================================================
// 5. DOM Element References
// ============================================================================
const canvas = document.getElementById("eog-canvas");
const ctx = canvas.getContext("2d");

const eyeSocket = document.getElementById("eye-socket");
const eyePupil = document.getElementById("eye-pupil");
const gazeDisplayLabel = document.getElementById("gaze-display-label");

const activeCmdBadge = document.getElementById("active-cmd-badge");
const activeCmdName = document.getElementById("active-cmd-name");
const activeCmdDetails = document.getElementById("active-cmd-details");

const valHr = document.getElementById("val-hr");
const valSpo2 = document.getElementById("val-spo2");
const valBp = document.getElementById("val-bp");
const valTriage = document.getElementById("val-triage");
const fallAlertBanner = document.getElementById("fall-alert-banner");

const statFullBytes = document.getElementById("stat-full-bytes");
const statDeltaBytes = document.getElementById("stat-delta-bytes");
const statSavedPct = document.getElementById("stat-saved-pct");
const headerReductionStat = document.getElementById("header-reduction-stat");

const authStatusBadge = document.getElementById("auth-status-badge");
const authStatusText = document.getElementById("auth-status-text");
const cryptoDot = document.getElementById("crypto-dot");
const cryptoPillText = document.getElementById("crypto-pill-text");

const fullJsonViewer = document.getElementById("full-json-viewer");
const deltaJsonViewer = document.getElementById("delta-json-viewer");
const sigHashDisplay = document.getElementById("sig-hash-display");

const btnStreamToggle = document.getElementById("btn-stream-toggle");
const btnClearTraces = document.getElementById("btn-clear-traces");
const btnToggleTamper = document.getElementById("btn-toggle-tamper");

// ============================================================================
// 6. Oscilloscope Renderer
// ============================================================================
function renderOscilloscope() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Background Grid Lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  const stepX = w / 20;
  for (let x = 0; x < w; x += stepX) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  const midY = h / 2;
  ctx.strokeStyle = "rgba(0, 242, 254, 0.15)";
  ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(w, midY); ctx.stroke();

  // Helper to plot channel
  function drawTrace(data, color, scale, offsetY, glow) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = glow ? 2.2 : 1.2;
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    const len = data.length;
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const y = offsetY - (data[i] * scale);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 1. Raw vEOG (gray)
  drawTrace(state.traces.rawV, "#64748b", 0.35, midY, false);
  // 2. Filtered vEOG (cyan neon)
  drawTrace(state.traces.filtV, "#00f2fe", 0.45, midY, true);
  // 3. Filtered hEOG (purple neon)
  drawTrace(state.traces.filtH, "#a855f7", 0.45, midY, true);
}

// ============================================================================
// 7. Blink & Eye-Gaze Classifier
// ============================================================================
function triggerCommand(commandName, details) {
  state.activeCommand = commandName;
  activeCmdName.textContent = commandName;
  activeCmdDetails.textContent = details;
  activeCmdBadge.classList.add("triggered");

  // Sync to patient state
  state.currentPatient.eye_gaze.last_command = commandName;
  updatePatientSecurityEnvelope();

  if (state.activeCommandTimer) clearTimeout(state.activeCommandTimer);
  state.activeCommandTimer = setTimeout(() => {
    activeCmdBadge.classList.remove("triggered");
    activeCmdName.textContent = "IDLE / MONITORING";
    activeCmdDetails.textContent = "Ready for next biopotential input...";
  }, 3500);
}

function processEOGSample(rawV, rawH, t) {
  // DSP Filter
  const filtV = state.vFilter.process(rawV);
  const filtH = state.hFilter.process(rawH);

  // Push to oscilloscope buffer
  state.traces.rawV.shift(); state.traces.rawV.push(rawV);
  state.traces.filtV.shift(); state.traces.filtV.push(filtV);
  state.traces.filtH.shift(); state.traces.filtH.push(filtH);

  // 1. Gaze Direction Tracking
  let gaze = "CENTER";
  if (filtH >= 60.0) gaze = "LEFT";
  else if (filtH <= -60.0) gaze = "RIGHT";

  if (state.currentGaze !== gaze) {
    state.currentGaze = gaze;
    gazeDisplayLabel.innerHTML = `GAZE: <strong>${gaze}</strong>`;
    
    // Animate eye pupil
    if (gaze === "LEFT") eyePupil.style.transform = "translateX(-28px)";
    else if (gaze === "RIGHT") eyePupil.style.transform = "translateX(28px)";
    else eyePupil.style.transform = "translateX(0px)";

    state.currentPatient.eye_gaze.direction = gaze;
    updatePatientSecurityEnvelope();
  }

  // 2. Pulse Blink Detection (100ms - 400ms duration)
  const THRESHOLD = 50.0;
  if (!state.inPulse) {
    if (filtV >= THRESHOLD) {
      state.inPulse = true;
      state.pulseStartIdx = state.sampleIndex;
      eyeSocket.classList.add("blink");
    }
  } else {
    if (filtV < (THRESHOLD * 0.5)) {
      state.inPulse = false;
      eyeSocket.classList.remove("blink");

      const durSamples = state.sampleIndex - state.pulseStartIdx;
      const durMs = (durSamples / state.fs) * 1000.0;

      // Pulse validation
      if (durMs >= 100.0 && durMs <= 400.0) {
        const blinkObj = { endT: t, durMs };
        
        // Multi-blink window (1.5s)
        state.blinkHistory = state.blinkHistory.filter(b => (t - b.endT) <= 1.5);
        state.blinkHistory.push(blinkObj);
        
        const count = state.blinkHistory.length;
        state.currentPatient.eye_gaze.blink_count = count;

        // Command Rules
        if (count === 1) {
          if (state.currentGaze === "LEFT") {
            triggerCommand("WATER", "Gaze LEFT + 1 Blink");
            state.blinkHistory = [];
          } else if (state.currentGaze === "RIGHT") {
            triggerCommand("BATHROOM", "Gaze RIGHT + 1 Blink");
            state.blinkHistory = [];
          }
        } else if (count >= 3) {
          triggerCommand("PAIN", "3 Consecutive Blinks Detected");
          state.blinkHistory = [];
        }
      }
    }
  }

  // Check 2-blink timeout for CALL_NURSE
  if (state.blinkHistory.length === 2) {
    const timeSinceLast = t - state.blinkHistory[1].endT;
    if (timeSinceLast >= 0.55) {
      triggerCommand("CALL_NURSE", "2 Blinks within 1.5s Confirmed");
      state.blinkHistory = [];
    }
  }
}

// ============================================================================
// 8. Patient Case Capsule & Cryptographic Integrity Updater
// ============================================================================
async function updatePatientSecurityEnvelope() {
  // Update Vitals Card DOM
  valHr.textContent = state.currentPatient.vitals.heart_rate_bpm;
  valSpo2.textContent = state.currentPatient.vitals.spo2_percent;
  valBp.textContent = `${state.currentPatient.vitals.systolic_bp}/${state.currentPatient.vitals.diastolic_bp}`;
  
  const triage = state.currentPatient.triage_color;
  valTriage.textContent = triage;
  valTriage.className = `triage-badge ${triage.toLowerCase()}`;

  if (state.currentPatient.fall_detected) {
    fallAlertBanner.style.display = "flex";
  } else {
    fallAlertBanner.style.display = "none";
  }

  // Compute Delta Capsule
  const deltaBody = computeDelta(state.baseline, state.currentPatient);
  const deltaCapsule = {
    patient_id: state.currentPatient.patient_id,
    seq: ++state.sampleIndex,
    delta: deltaBody
  };

  // Full vs Delta JSON
  const fullJsonStr = JSON.stringify(state.currentPatient, null, 2);
  const deltaCompactStr = JSON.stringify(deltaCapsule, Object.keys(deltaCapsule).sort());
  
  // Cryptographic Signing (HMAC-SHA256)
  const signature = await computeHmacSha256(deltaCompactStr, state.secretKey);

  // Signed Envelope
  const signedEnvelope = {
    payload: deltaCapsule,
    signature: signature,
    algorithm: "HMAC-SHA256"
  };

  // Simulated Tamper Injection
  let displayedEnvelope = JSON.parse(JSON.stringify(signedEnvelope));
  let isTampered = false;

  if (state.isTamperInjected) {
    // Attacker modifies payload without valid key
    displayedEnvelope.payload.delta.vitals = { heart_rate_bpm: 60 };
    displayedEnvelope.payload.tampered_by = "MitM_Attacker";
    isTampered = true;
  }

  // Verify Envelope Integrity
  const payloadToVerify = JSON.stringify(displayedEnvelope.payload, Object.keys(displayedEnvelope.payload).sort());
  const expectedSig = await computeHmacSha256(payloadToVerify, state.secretKey);
  const isValid = (displayedEnvelope.signature === expectedSig);

  // Update Auth Badge
  if (isValid && !isTampered) {
    authStatusBadge.className = "auth-status-badge verified";
    authStatusText.textContent = "✓ VERIFIED";
    cryptoDot.className = "pulse-dot green";
    cryptoPillText.innerHTML = "AUTH: <strong>HMAC-SHA256</strong>";
  } else {
    authStatusBadge.className = "auth-status-badge tampered";
    authStatusText.textContent = "✕ TAMPERED";
    cryptoDot.className = "pulse-dot red";
    cryptoPillText.innerHTML = "AUTH: <strong style='color:#ef4444'>CORRUPTED</strong>";
  }

  // Update DOM Code Viewers
  fullJsonViewer.textContent = fullJsonStr;
  deltaJsonViewer.textContent = JSON.stringify(displayedEnvelope, null, 2);
  sigHashDisplay.textContent = displayedEnvelope.signature;

  // Update Metrics
  const fullBytes = new TextEncoder().encode(fullJsonStr).length;
  const deltaBytes = new TextEncoder().encode(JSON.stringify(displayedEnvelope)).length;
  const savedPct = Math.max(0, (1 - (deltaBytes / fullBytes))) * 100;

  statFullBytes.innerHTML = `${fullBytes} <small>bytes</small>`;
  statDeltaBytes.innerHTML = `${deltaBytes} <small>bytes</small>`;
  statSavedPct.textContent = `${savedPct.toFixed(1)}%`;
  headerReductionStat.textContent = `~${savedPct.toFixed(0)}% SAVED`;
}

// ============================================================================
// 9. Simulation & Scenario Queue Dispatcher
// ============================================================================
function injectScenario(scenarioType) {
  state.scenarioQueue = [];
  const dt = 1.0 / state.fs;

  if (scenarioType === "nurse") {
    // 2 blinks at t=0.4s and t=0.9s
    for (let i = 0; i < 180; i++) {
      const t = i * dt;
      let b = 0;
      if (t >= 0.35 && t <= 0.55) b = 250 * 0.5 * (1 - Math.cos(2 * Math.PI * (t - 0.35) / 0.20));
      if (t >= 0.85 && t <= 1.05) b = 260 * 0.5 * (1 - Math.cos(2 * Math.PI * (t - 0.85) / 0.20));
      state.scenarioQueue.push({ v: b, h: 0 });
    }
  } else if (scenarioType === "pain") {
    // 3 blinks at t=0.3s, 0.65s, 1.0s
    for (let i = 0; i < 200; i++) {
      const t = i * dt;
      let b = 0;
      if (t >= 0.25 && t <= 0.43) b = 250 * 0.5 * (1 - Math.cos(2 * Math.PI * (t - 0.25) / 0.18));
      if (t >= 0.60 && t <= 0.78) b = 250 * 0.5 * (1 - Math.cos(2 * Math.PI * (t - 0.60) / 0.18));
      if (t >= 0.95 && t <= 1.13) b = 260 * 0.5 * (1 - Math.cos(2 * Math.PI * (t - 0.95) / 0.18));
      state.scenarioQueue.push({ v: b, h: 0 });
    }
  } else if (scenarioType === "water") {
    // Left gaze (+120 uV) + 1 blink at t=0.5s
    for (let i = 0; i < 160; i++) {
      const t = i * dt;
      let b = 0;
      if (t >= 0.40 && t <= 0.62) b = 250 * 0.5 * (1 - Math.cos(2 * Math.PI * (t - 0.40) / 0.22));
      state.scenarioQueue.push({ v: b, h: 120.0 });
    }
  } else if (scenarioType === "bathroom") {
    // Right gaze (-120 uV) + 1 blink at t=0.5s
    for (let i = 0; i < 160; i++) {
      const t = i * dt;
      let b = 0;
      if (t >= 0.40 && t <= 0.62) b = 250 * 0.5 * (1 - Math.cos(2 * Math.PI * (t - 0.40) / 0.22));
      state.scenarioQueue.push({ v: b, h: -120.0 });
    }
  } else if (scenarioType === "artifacts") {
    // Fast spike (40ms) and long pulse (800ms)
    for (let i = 0; i < 180; i++) {
      const t = i * dt;
      let b = 0;
      if (t >= 0.30 && t <= 0.34) b = 300 * 0.5 * (1 - Math.cos(2 * Math.PI * (t - 0.30) / 0.04));
      if (t >= 0.60 && t <= 1.40) b = 300 * 0.5 * (1 - Math.cos(2 * Math.PI * (t - 0.60) / 0.80));
      state.scenarioQueue.push({ v: b, h: 0 });
    }
  }
}

// ============================================================================
// 10. Main Animation & Sample Loop (100 Hz cadence)
// ============================================================================
let lastTime = performance.now();

function simulationStep() {
  if (!state.isRunning) {
    requestAnimationFrame(simulationStep);
    return;
  }

  const now = performance.now();
  const dtSeconds = (now - lastTime) / 1000;
  lastTime = now;

  state.sampleIndex++;
  const t = state.sampleIndex / state.fs;

  // Generate realistic baseline wander + 50Hz mains + EMG noise
  const driftV = 60.0 * Math.sin(2.0 * Math.PI * 0.03 * t);
  const driftH = 45.0 * Math.cos(2.0 * Math.PI * 0.02 * t);
  const mainsV = 20.0 * Math.sin(2.0 * Math.PI * 50.0 * t);
  const mainsH = 20.0 * Math.sin(2.0 * Math.PI * 50.0 * t + 0.4);
  const emgV = (Math.random() - 0.5) * 8.0;
  const emgH = (Math.random() - 0.5) * 8.0;

  let bioV = 0.0;
  let bioH = 0.0;

  if (state.scenarioQueue.length > 0) {
    const nextSample = state.scenarioQueue.shift();
    bioV = nextSample.v;
    bioH = nextSample.h;
  }

  const rawV = bioV + driftV + mainsV + emgV;
  const rawH = bioH + driftH + mainsH + emgH;

  // Process through DSP pipeline
  processEOGSample(rawV, rawH, t);

  // Render Oscilloscope
  renderOscilloscope();

  requestAnimationFrame(simulationStep);
}

// Periodic patient vitals background fluctuation
setInterval(() => {
  if (!state.isRunning) return;
  // Natural vitals micro-fluctuation
  state.currentPatient.vitals.heart_rate_bpm = 72 + Math.floor(Math.random() * 6);
  updatePatientSecurityEnvelope();
}, 2500);

// ============================================================================
// 11. Event Listeners
// ============================================================================
btnStreamToggle.addEventListener("click", () => {
  state.isRunning = !state.isRunning;
  btnStreamToggle.textContent = state.isRunning ? "⏸ Pause Stream" : "▶ Resume Stream";
  btnStreamToggle.classList.toggle("active", state.isRunning);
});

btnClearTraces.addEventListener("click", () => {
  state.traces.rawV.fill(0);
  state.traces.filtV.fill(0);
  state.traces.filtH.fill(0);
  state.vFilter.reset();
  state.hFilter.reset();
});

btnToggleTamper.addEventListener("click", () => {
  state.isTamperInjected = !state.isTamperInjected;
  btnToggleTamper.classList.toggle("active", state.isTamperInjected);
  btnToggleTamper.textContent = state.isTamperInjected 
    ? "⚠️ Active Tamper Injected (Click to Restore)" 
    : "⚠️ Inject MitM Tamper Attack";
  updatePatientSecurityEnvelope();
});

document.querySelectorAll(".btn-scenario").forEach(btn => {
  btn.addEventListener("click", () => {
    const sc = btn.getAttribute("data-scenario");
    injectScenario(sc);
  });
});

// Initialize
updatePatientSecurityEnvelope();
requestAnimationFrame(simulationStep);
