import os
import json
import httpx
from typing import Dict, Any, List, Optional
from backend.models import CaseCapsule, TriageEvaluationResponse

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

def calculate_clinical_metrics(capsule: CaseCapsule) -> Dict[str, float]:
    """
    Computes baseline clinical severity (1.0 - 10.0) and time sensitivity (1.0 - 3.0).
    priority_score = (severity * time_sensitivity) / max(time_to_help, 0.1)
    """
    severity = 1.0
    v = capsule.vitals
    
    # Heart Rate assessment
    if v.heart_rate:
        if v.heart_rate > 135 or v.heart_rate < 45:
            severity += 2.5
        elif v.heart_rate > 110 or v.heart_rate < 55:
            severity += 1.5

    # SpO2 assessment
    if v.spo2:
        if v.spo2 < 85:
            severity += 3.5
        elif v.spo2 < 92:
            severity += 2.0
        elif v.spo2 < 95:
            severity += 1.0

    # Systolic BP assessment
    if v.systolic_bp:
        if v.systolic_bp < 80 or v.systolic_bp > 190:
            severity += 3.0
        elif v.systolic_bp < 95 or v.systolic_bp > 160:
            severity += 1.5

    # Respiratory rate
    if v.respiratory_rate:
        if v.respiratory_rate > 32 or v.respiratory_rate < 8:
            severity += 2.5
        elif v.respiratory_rate > 24 or v.respiratory_rate < 10:
            severity += 1.2

    # Fall detection
    if v.fall_detected:
        severity += 1.8

    # Red flags impact
    for flag in capsule.red_flags:
        lower_flag = flag.lower()
        if any(term in lower_flag for term in ["pneumothorax", "hemorrhage", "unresponsive", "cardiac", "stroke", "shock"]):
            severity += 3.0
        else:
            severity += 1.5

    # Eye gaze urgent alerts
    if capsule.eye_gaze and capsule.eye_gaze.command:
        cmd = capsule.eye_gaze.command.upper()
        if "CALL_NURSE" in cmd or "PAIN" in cmd:
            severity += 1.2

    severity = min(max(severity, 1.0), 10.0)

    # Time sensitivity: acute conditions degrade faster
    time_sensitivity = 1.0
    if severity >= 6.0:
        time_sensitivity = 2.5
    elif severity >= 4.0:
        time_sensitivity = 1.8
    else:
        time_sensitivity = 1.2

    # Priority score calculation
    t_help = max(float(capsule.time_to_help), 0.1)
    # Scaled priority score
    raw_priority = (severity * time_sensitivity) / t_help
    priority_score = round(min(raw_priority, 99.9), 2)

    return {
        "severity": round(severity, 2),
        "time_sensitivity": round(time_sensitivity, 2),
        "time_to_help": round(t_help, 2),
        "priority_score": priority_score
    }

def construct_triage_prompt(capsule: CaseCapsule, metrics: Dict[str, float]) -> str:
    """
    Builds the dynamic Delay-Aware clinical triage prompt.
    """
    time_to_help = metrics["time_to_help"]
    mode = "TACTICAL_STANDARD"
    protocol_instructions = ""
    
    if time_to_help <= 0.5: # <= 30 minutes
        mode = "ACUTE_STABILIZATION"
        protocol_instructions = (
            "PROTOCOL: ACUTE STABILIZATION & RAPID TRANSPORT PREPARATION\n"
            "- Evacuation is imminent (<30 mins).\n"
            "- Focus solely on life threats (MARCH algorithm: Massive Hemorrhage, Airway, Respiration, Circulation, Hypothermia).\n"
            "- Prep packaging for immediate MEDEVAC transport.\n"
            "- Do NOT delay for complex diagnostics."
        )
    elif time_to_help >= 24.0: # >= 24 hours
        mode = "PROLONGED_FIELD_CARE"
        protocol_instructions = (
            "PROTOCOL: PROLONGED FIELD CARE (PFC) & RESOURCE RATIONING\n"
            "- Help is delayed by 24+ hours (Austere / Disconnected conditions).\n"
            "- Provide strict medical resource & fluid rationing guidelines.\n"
            "- Prescribe nursing schedule: vitals monitoring every 2 hours, decubitus ulcer turning every 2 hours, hydration maintenance.\n"
            "- Define explicit Red-Flag Escalation triggers when caregiver must sound emergency distress."
        )
    else:
        mode = "INTERIM_TACTICAL_HOLD"
        protocol_instructions = (
            f"PROTOCOL: INTERIM TACTICAL HOLD (Estimated Help: {time_to_help} hours)\n"
            "- Maintain airway and vital stability.\n"
            "- Periodic trend logging and secondary survey."
        )

    gaze_info = "None"
    if capsule.eye_gaze:
        gaze_info = f"Command: {capsule.eye_gaze.command}, Direction: {capsule.eye_gaze.direction}, Blinks: {capsule.eye_gaze.blink_count}"

    meds_info = ", ".join([f"{m.medication} ({m.dose})" for m in capsule.medications]) if capsule.medications else "None"

    prompt = f"""
You are Kshitij Clinical AI, an expert emergency military/austere triage physician assistant.
Analyze the following patient telemetry and generate a structured triage decision.

PATIENT METRICS:
- Patient ID: {capsule.patient_id} ({capsule.patient_name})
- Time to Definitive Help: {capsule.time_to_help} hours ({round(capsule.time_to_help * 60)} minutes)
- Computed Severity Index: {metrics['severity']} / 10.0
- Computed Priority Score: {metrics['priority_score']}
- Vitals: HR: {capsule.vitals.heart_rate} bpm, SpO2: {capsule.vitals.spo2}%, BP: {capsule.vitals.systolic_bp}/{capsule.vitals.diastolic_bp} mmHg, RR: {capsule.vitals.respiratory_rate}/min, Temp: {capsule.vitals.temperature}C, Fall Detected: {capsule.vitals.fall_detected}
- Clinical Red Flags: {', '.join(capsule.red_flags) if capsule.red_flags else 'None'}
- Eye-Gaze / EOG Command: {gaze_info}
- Administered Medications: {meds_info}
- HMAC Integrity Status: {capsule.verification_status}

{protocol_instructions}

MANDATORY RESPONSE FORMAT:
You MUST respond with a strictly valid JSON object ONLY. No markdown wrapper, no commentary before or after.
JSON Schema:
{{
  "priority_score": {metrics['priority_score']},
  "triage_level": "<IMMEDIATE_RED | DELAYED_YELLOW | MINIMAL_GREEN | EXPECTANT_BLACK>",
  "protocol_mode": "{mode}",
  "clinical_summary": "<Concise 2-sentence clinical diagnosis and urgency justification>",
  "action_steps": [
    "<Action Step 1>",
    "<Action Step 2>",
    "<Action Step 3>"
  ],
  "red_flag_triggers": [
    "<Condition trigger that prompts urgent alert>"
  ],
  "rationing_guidelines": [
    "<Specific guidance on fluids, oxygen, or medication preservation if PFC>"
  ]
}}
"""
    return prompt.strip()

def generate_fallback_triage(capsule: CaseCapsule, metrics: Dict[str, float]) -> TriageEvaluationResponse:
    """
    Expert heuristic fallback when Ollama is offline or unreachable.
    Guarantees reliable, instant responses during hackathon evaluations.
    """
    score = metrics["priority_score"]
    severity = metrics["severity"]
    t_help = metrics["time_to_help"]
    
    # Determine triage color level
    if score >= 15.0 or severity >= 6.5 or capsule.vitals.spo2 < 88 or "hemorrhage" in [f.lower() for f in capsule.red_flags]:
        triage_level = "IMMEDIATE_RED"
    elif score >= 5.0 or severity >= 3.5:
        triage_level = "DELAYED_YELLOW"
    elif score >= 1.0:
        triage_level = "MINIMAL_GREEN"
    else:
        triage_level = "MINIMAL_GREEN"

    if t_help <= 0.5:
        protocol_mode = "ACUTE_STABILIZATION"
        actions = [
            "Initiate immediate high-flow oxygenation via non-rebreather mask (15 L/min).",
            "Secure large-bore IV access (18G) and package for high-speed MEDEVAC transfer.",
            f"Address eye-gaze urgent alert ({capsule.eye_gaze.command if capsule.eye_gaze else 'General'}) - immediate bedside response.",
            "Verify cervical collar and litter placement before transport vehicle arrival."
        ]
        rationing = ["Do not restrict emergency resupply; transport team ETA < 30 mins."]
        red_flags = ["SpO2 drop below 90% despite O2", "Systolic BP dropping below 80 mmHg", "Loss of consciousness"]
        summary = f"Patient {capsule.patient_id} presents with critical physiological stress. Evacuation ETA is within 30 minutes; focus on immediate airway, circulatory stabilization, and rapid transport packaging."
    elif t_help >= 24.0:
        protocol_mode = "PROLONGED_FIELD_CARE"
        actions = [
            "Establish Prolonged Field Care (PFC) flowsheet: log vitals every 2 hours.",
            "Implement decubitus ulcer mitigation: 30-degree lateral patient rotation every 120 minutes.",
            "Ration IV fluids to maintenance rate (75-100 mL/hr) or oral rehydration salts if patient is conscious.",
            "Maintain strict thermal insulation; prevent hypothermia with reflective thermal blankets."
        ]
        rationing = [
            "Preserve crystalloid fluids: restrict to 1.5L/24h unless mean arterial pressure < 65.",
            "Ration supplemental oxygen: titrate to target SpO2 90-92% to preserve oxygen cylinders."
        ]
        red_flags = [
            "Urine output falling below 0.5 mL/kg/hr for >2 consecutive hours",
            "Signs of progressive sepsis or uncontrolled pain unresponsive to current regimen",
            "Acute neurological deterioration or loss of eye-gaze responsiveness"
        ]
        summary = f"Patient {capsule.patient_id} requires Prolonged Field Care due to a delayed evacuation window of {t_help}h. Implement conservative fluid management, scheduled positional rotations, and austere monitoring."
    else:
        protocol_mode = "TACTICAL_STANDARD"
        actions = [
            "Continuous vital sign telemetry monitoring over dual-port/mesh uplink.",
            "Administer standard tactical analgesic and supportive care as indicated.",
            "Prepare secondary assessment documentation for incoming rescue echelon."
        ]
        rationing = ["Standard tactical medical supply distribution."]
        red_flags = ["Unstable hemodynamics", "Spike in respiratory distress"]
        summary = f"Patient {capsule.patient_id} evaluated with priority score {score}. Stabilization and scheduled reassessment ongoing with {t_help}h until evacuation."

    return TriageEvaluationResponse(
        patient_id=capsule.patient_id,
        priority_score=score,
        triage_level=triage_level,
        protocol_mode=protocol_mode,
        clinical_summary=summary,
        action_steps=actions,
        red_flag_triggers=red_flags,
        rationing_guidelines=rationing,
        evaluation_source="kshitij:clinical_heuristic_engine"
    )

async def evaluate_clinical_triage(capsule: CaseCapsule) -> TriageEvaluationResponse:
    """
    Evaluates patient triage via Ollama (llama3.2:3b) with graceful heuristic fallback.
    """
    metrics = calculate_clinical_metrics(capsule)
    prompt = construct_triage_prompt(capsule, metrics)

    # Attempt query to local Ollama instance
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "format": "json",
                    "stream": False,
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 450
                    }
                }
            )
            if response.status_code == 200:
                data = response.json()
                raw_response = data.get("response", "{}")
                parsed = json.loads(raw_response)
                
                return TriageEvaluationResponse(
                    patient_id=capsule.patient_id,
                    priority_score=parsed.get("priority_score", metrics["priority_score"]),
                    triage_level=parsed.get("triage_level", "DELAYED_YELLOW"),
                    protocol_mode=parsed.get("protocol_mode", "TACTICAL_STANDARD"),
                    clinical_summary=parsed.get("clinical_summary", "Evaluation complete."),
                    action_steps=parsed.get("action_steps", ["Continue monitoring patient."]),
                    red_flag_triggers=parsed.get("red_flag_triggers", []),
                    rationing_guidelines=parsed.get("rationing_guidelines", []),
                    evaluation_source=f"ollama:{OLLAMA_MODEL}"
                )
    except Exception as e:
        # Fallback to embedded medical heuristic engine
        pass

    return generate_fallback_triage(capsule, metrics)
