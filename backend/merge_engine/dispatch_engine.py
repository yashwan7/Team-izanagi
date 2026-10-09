"""
Kshitij Tactical EMR - Dispatch Engine
Bengaluru JP Nagar Demo Simulation & Multi-Ambulance Atomic Dispatch Coordinator
Authoritative Backend State Management with Asyncio Concurrency Locking
"""

import time
import math
import asyncio
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

# Verified JP Nagar Default Anchor: 80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8, Bengaluru, 560076
DEFAULT_ANCHOR = {
    "name": "80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8, Bengaluru",
    "address": "80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8, Bengaluru, Karnataka 560076",
    "lat": 12.871773,
    "lng": 77.576856,
    "locality": "Brookes Haven Layout, JP Nagar Phase 8",
    "pincode": "560076"
}

# Real, Verified Hospitals in JP Nagar Phase 8 / Kothanur / Konanakunte Operating Area
VERIFIED_HOSPITALS = [
    {
        "hospital_id": "HOSP-TR-KOTHANUR",
        "name": "TR Hospital, JP Nagar 8th Phase",
        "address": "80 Feet Road, Kothanur, JP Nagar 8th Phase, Bengaluru 560076",
        "lat": 12.880755,
        "lng": 77.584167,
        "phone": "+91 80 2685 0099",
        "capabilities": ["24/7 Casualty", "Emergency Trauma Resus", "General ICU", "In-house Pharmacy"],
        "total_beds": 65,
        "icu_available": 6,
        "triage_compatibility": ["IMMEDIATE_RED", "DELAYED_YELLOW"],
        "verified": True
    },
    {
        "hospital_id": "HOSP-RAJNANDANI",
        "name": "Rajnandani Hospital, JP Nagar 8th Phase",
        "address": "Chunchgatta Main Rd, Konanakunte, JP Nagar 8th Phase, Bengaluru 560062",
        "lat": 12.884545,
        "lng": 77.570128,
        "phone": "+91 80 2686 2200",
        "capabilities": ["Emergency Critical Care", "Orthopedic Trauma", "Obstetric Emergency", "ICU"],
        "total_beds": 80,
        "icu_available": 8,
        "triage_compatibility": ["IMMEDIATE_RED", "DELAYED_YELLOW"],
        "verified": True
    },
    {
        "hospital_id": "HOSP-METRO-KANAK",
        "name": "Metro Hospital, Kanakapura Road",
        "address": "Near Konanakunte Cross Metro Station, Kanakapura Rd, Bengaluru 560062",
        "lat": 12.891589,
        "lng": 77.560715,
        "phone": "+91 80 2666 4433",
        "capabilities": ["24/7 Trauma Care", "Cardiac Resuscitation", "Emergency ICU", "Dialysis"],
        "total_beds": 100,
        "icu_available": 10,
        "triage_compatibility": ["IMMEDIATE_RED", "DELAYED_YELLOW"],
        "verified": True
    },
    {
        "hospital_id": "HOSP-FORTIS-BG",
        "name": "Fortis Hospital, Bannerghatta Road",
        "address": "154/9, Bannerghatta Rd, Opposite IIMB, Bengaluru 560076",
        "lat": 12.894210,
        "lng": 77.598920,
        "phone": "+91 80 6621 4444",
        "capabilities": ["Level-1 Emergency Care", "Critical Polytrauma", "ECMO", "Cath Lab"],
        "total_beds": 280,
        "icu_available": 18,
        "triage_compatibility": ["IMMEDIATE_RED", "DELAYED_YELLOW"],
        "verified": True
    },
    {
        "hospital_id": "HOSP-SAMMPRADA",
        "name": "Sammprada Hospital, JP Nagar 3rd Phase",
        "address": "8th Main Rd, JP Nagar 3rd Phase, Bengaluru 560078",
        "lat": 12.906385,
        "lng": 77.594680,
        "phone": "+91 80 4333 5555",
        "capabilities": ["Surgical Critical Care", "Emergency OT", "Trauma Stabilization"],
        "total_beds": 90,
        "icu_available": 6,
        "triage_compatibility": ["DELAYED_YELLOW", "MINIMAL_GREEN"],
        "verified": True
    },
    {
        "hospital_id": "HOSP-ASTER-RV",
        "name": "Aster RV Hospital, JP Nagar 1st Phase",
        "address": "CA-37, 24th Main Rd, LIC Colony, JP Nagar 1st Phase, Bengaluru 560078",
        "lat": 12.911417,
        "lng": 77.585027,
        "phone": "+91 80 6605 5000",
        "capabilities": ["Level-1 Trauma", "24/7 Emergency", "Critical Resus", "Neuro-trauma"],
        "total_beds": 250,
        "icu_available": 14,
        "triage_compatibility": ["IMMEDIATE_RED", "DELAYED_YELLOW"],
        "verified": True
    },
    {
        "hospital_id": "HOSP-RAJSHEKAR",
        "name": "Rajshekar Multi Speciality Hospital, JP Nagar",
        "address": "21st Main Rd, Marenhalli, JP Nagar 1st Phase, Bengaluru 560078",
        "lat": 12.912640,
        "lng": 77.579480,
        "phone": "+91 80 2664 6100",
        "capabilities": ["24/7 Casualty", "Neuro-trauma", "Orthopedic ER", "ICU"],
        "total_beds": 120,
        "icu_available": 8,
        "triage_compatibility": ["IMMEDIATE_RED", "DELAYED_YELLOW"],
        "verified": True
    },
    {
        "hospital_id": "HOSP-JAYADEVA",
        "name": "Jayadeva Institute of Cardiovascular Sciences",
        "address": "Bannerghatta Main Rd, Jayanagar 9th Block, Bengaluru 560069",
        "lat": 12.918510,
        "lng": 77.598280,
        "phone": "+91 80 2297 7400",
        "capabilities": ["Autonomous Cardiac Emergency", "Coronary Care Unit", "ECMO"],
        "total_beds": 600,
        "icu_available": 25,
        "triage_compatibility": ["IMMEDIATE_RED"],
        "verified": True
    }
]

# 12 Simulated Ambulances distributed around Brookes Haven / JP Nagar 8th Phase (Deterministic Demo Fixtures)
INITIAL_AMBULANCE_FIXTURES = [
    {
        "ambulance_id": "AMB-01",
        "callsign": "Brookes Haven ALS Alpha-1",
        "vehicle_type": "ALS (Advanced Life Support)",
        "lat": 12.874800,
        "lng": 77.576500,
        "status": "AVAILABLE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 180,
        "speed_kmh": 32.0,
        "last_gps_update_secs_ago": 4,
        "crew": "Medic R. Nayak, Pilot S. Rao",
        "equipment": ["Ventilator", "Defibrillator", "IV Pumps", "Combat Gauze"],
        "stale_gps": False
    },
    {
        "ambulance_id": "AMB-02",
        "callsign": "RVITM Gate BLS Beta-2",
        "vehicle_type": "BLS (Basic Life Support)",
        "lat": 12.871500,
        "lng": 77.574200,
        "status": "AVAILABLE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 45,
        "speed_kmh": 28.0,
        "last_gps_update_secs_ago": 10,
        "crew": "EMT V. Gowda, Pilot M. Kumar",
        "equipment": ["Oxygen Resuscitator", "Splints", "Spine Board"],
        "stale_gps": False
    },
    {
        "ambulance_id": "AMB-03",
        "callsign": "Kothanur MICU Critical-3",
        "vehicle_type": "MICU (Mobile ICU)",
        "lat": 12.878200,
        "lng": 77.581500,
        "status": "AVAILABLE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 220,
        "speed_kmh": 35.0,
        "last_gps_update_secs_ago": 3,
        "crew": "Dr. P. Hegde (ER Phys), Medic C. Das",
        "equipment": ["Transport Vent", "Blood Warmer", "Ultrasound", "Multipara Monitor"],
        "stale_gps": False
    },
    {
        "ambulance_id": "AMB-04",
        "callsign": "Krishna Kere ALS-4",
        "vehicle_type": "ALS (Advanced Life Support)",
        "lat": 12.870500,
        "lng": 77.582800,
        "status": "AVAILABLE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 310,
        "speed_kmh": 30.0,
        "last_gps_update_secs_ago": 7,
        "crew": "Paramedic K. Sharma, Pilot A. Joshi",
        "equipment": ["Defibrillator", "LUCAS CPR", "Suction Unit"],
        "stale_gps": False
    },
    {
        "ambulance_id": "AMB-05",
        "callsign": "Chunchgatta BLS Patrol-5",
        "vehicle_type": "BLS (Basic Life Support)",
        "lat": 12.883500,
        "lng": 77.569500,
        "status": "AVAILABLE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 90,
        "speed_kmh": 34.0,
        "last_gps_update_secs_ago": 12,
        "crew": "EMT-P N. Reddy, Pilot T. Babu",
        "equipment": ["Defib Monitor", "Chest Seals", "TXA Kit"],
        "stale_gps": False
    },
    {
        "ambulance_id": "AMB-06",
        "callsign": "Konanakunte Rapid BLS-6",
        "vehicle_type": "BLS (Basic Life Support)",
        "lat": 12.888000,
        "lng": 77.574000,
        "status": "AVAILABLE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 160,
        "speed_kmh": 26.0,
        "last_gps_update_secs_ago": 18,
        "crew": "EMT D. Patil, Pilot B. Suresh",
        "equipment": ["C-Collar", "First Aid Kit", "Automated Defib"],
        "stale_gps": False
    },
    {
        "ambulance_id": "AMB-07",
        "callsign": "Kanakapura Metro MICU-7",
        "vehicle_type": "MICU (Mobile ICU)",
        "lat": 12.891500,
        "lng": 77.562000,
        "status": "AVAILABLE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 130,
        "speed_kmh": 38.0,
        "last_gps_update_secs_ago": 5,
        "crew": "Dr. A. Verma, Medic E. Paul",
        "equipment": ["ICU Ventilator", "Infusion Pumps", "Capnography"],
        "stale_gps": False
    },
    {
        "ambulance_id": "AMB-08",
        "callsign": "Bannerghatta Gottigere BLS-8",
        "vehicle_type": "BLS (Basic Life Support)",
        "lat": 12.876000,
        "lng": 77.592000,
        "status": "AVAILABLE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 260,
        "speed_kmh": 30.0,
        "last_gps_update_secs_ago": 20,
        "crew": "EMT R. Mohan, Pilot G. Prasad",
        "equipment": ["Spine Board", "Oxygen Delivery", "Tourniquets"],
        "stale_gps": False
    },
    {
        "ambulance_id": "AMB-09",
        "callsign": "Fortis Depot ALS-9",
        "vehicle_type": "ALS (Advanced Life Support)",
        "lat": 12.894200,
        "lng": 77.598000,
        "status": "AVAILABLE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 210,
        "speed_kmh": 35.0,
        "last_gps_update_secs_ago": 14,
        "crew": "Medic L. Fernandez, Pilot K. John",
        "equipment": ["Multi-Lead ECG", "Emergency Drug Kit", "EZ-IO"],
        "stale_gps": False
    },
    {
        "ambulance_id": "AMB-10",
        "callsign": "JP Nagar 5th Phase BLS-10",
        "vehicle_type": "BLS (Basic Life Support)",
        "lat": 12.905000,
        "lng": 77.585000,
        "status": "AVAILABLE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 180,
        "speed_kmh": 29.0,
        "last_gps_update_secs_ago": 25,
        "crew": "EMT S. Bhat, Pilot H. Ali",
        "equipment": ["Splints", "Stretcher", "Basic Airway Kit"],
        "stale_gps": False
    },
    {
        "ambulance_id": "AMB-11",
        "callsign": "South Reserve ALS-11 (Offline)",
        "vehicle_type": "ALS (Advanced Life Support)",
        "lat": 12.865000,
        "lng": 77.570000,
        "status": "OFFLINE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 0,
        "speed_kmh": 0.0,
        "last_gps_update_secs_ago": 480,
        "crew": "Maintenance Shift",
        "equipment": ["Depot Service Pending"],
        "stale_gps": True
    },
    {
        "ambulance_id": "AMB-12",
        "callsign": "West Grid MICU-12 (Stale GPS)",
        "vehicle_type": "MICU (Mobile ICU)",
        "lat": 12.882000,
        "lng": 77.560000,
        "status": "AVAILABLE",
        "assignment_state": "UNASSIGNED",
        "assigned_emergency_id": None,
        "heading": 90,
        "speed_kmh": 0.0,
        "last_gps_update_secs_ago": 520,
        "crew": "Medic F. Joseph, Pilot N. Kumar",
        "equipment": ["Full Mobile ICU Kit"],
        "stale_gps": True
    }
]

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)

def estimate_road_eta_mins(distance_km: float, speed_kmh: float = 35.0) -> int:
    """Estimates urban road transit ETA with traffic overhead factor."""
    urban_traffic_factor = 1.35
    minutes = (distance_km / max(15.0, speed_kmh)) * 60.0 * urban_traffic_factor
    return max(1, math.ceil(minutes))


class DispatchCoordinator:
    """
    Authoritative Dispatch Coordinator for Kshitij Tactical EMR.
    Enforces atomic ambulance assignments, concurrent acceptance locking,
    multi-offer lifecycles, and audit history.
    """

    def __init__(self):
        self._lock = asyncio.Lock()
        self.operating_anchor = dict(DEFAULT_ANCHOR)
        self.operating_radius_km = 5.0
        self.ambulances: List[Dict[str, Any]] = [dict(a) for a in INITIAL_AMBULANCE_FIXTURES]
        self.hospitals: List[Dict[str, Any]] = [dict(h) for h in VERIFIED_HOSPITALS]
        
        # Active Emergency
        self.active_emergency: Dict[str, Any] = {
            "emergency_id": "EMG-JP-101",
            "patient_id": "PT-101",
            "patient_name": "Major Vikram Rathore (Blast Trauma)",
            "priority": "IMMEDIATE_RED",
            "lat": DEFAULT_ANCHOR["lat"],
            "lng": DEFAULT_ANCHOR["lng"],
            "location_label": "80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8, Bengaluru",
            "created_at": time.time(),
            "status": "OFFERING", # 'UNASSIGNED' | 'OFFERING' | 'ASSIGNED' | 'ESCALATED'
            "assigned_ambulance_id": None,
            "assigned_at": None,
            "recommended_hospital_id": "HOSP-ASTER-RV"
        }

        # Active Offers: Dict of offer_id -> offer dict
        self.active_offers: Dict[str, Dict[str, Any]] = {}
        self.offer_group_index = 0
        self.offer_timeout_seconds = 15

        # Audit timeline (chronological event stream labeled [DEMO])
        self.audit_log: List[Dict[str, Any]] = []

        self._record_audit(
            event_type="DISPATCH_COORDINATOR_INITIALIZED",
            details="Operating Anchor set to 80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8, Bengaluru (12.872678, 77.575814). 12 simulated units loaded."
        )

        self._issue_initial_demo_offers()

    def _record_audit(self, event_type: str, details: str, actor: str = "Dispatch Engine"):
        entry = {
            "event_id": f"EVT-{int(time.time() * 1000) % 1000000}",
            "timestamp": time.strftime("%H:%M:%S", time.localtime()),
            "timestamp_epoch": time.time(),
            "event_type": event_type,
            "details": details,
            "actor": actor,
            "is_demo": True
        }
        self.audit_log.insert(0, entry)
        if len(self.audit_log) > 60:
            self.audit_log.pop()

    def _issue_initial_demo_offers(self):
        """Pre-populates an initial multi-offer group for the active emergency."""
        self.active_offers.clear()
        emergency_id = self.active_emergency["emergency_id"]
        
        # Find eligible ambulances sorted by road ETA
        eligible = self._get_ranked_eligible_ambulances(emergency_id)
        top_group = eligible[:3]

        now = time.time()
        for idx, amb in enumerate(top_group):
            offer_id = f"OFFER-{emergency_id}-{amb['ambulance_id']}"
            dist = haversine_distance_km(
                self.active_emergency["lat"], self.active_emergency["lng"],
                amb["lat"], amb["lng"]
            )
            eta = estimate_road_eta_mins(dist, amb["speed_kmh"])
            offer = {
                "offer_id": offer_id,
                "emergency_id": emergency_id,
                "ambulance_id": amb["ambulance_id"],
                "callsign": amb["callsign"],
                "vehicle_type": amb["vehicle_type"],
                "distance_km": dist,
                "eta_mins": eta,
                "issued_at": now,
                "expires_at": now + self.offer_timeout_seconds,
                "status": "OFFERED", # 'OFFERED' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED'
                "group_index": 0
            }
            self.active_offers[amb["ambulance_id"]] = offer
            
            # Update ambulance state
            for a in self.ambulances:
                if a["ambulance_id"] == amb["ambulance_id"]:
                    a["status"] = "OFFERED"
                    a["assignment_state"] = "PENDING_OFFER"

        self._record_audit(
            event_type="OFFERS_DISPATCHED",
            details=f"Dispatched multi-unit offer group 1 to {[a['ambulance_id'] for a in top_group]} with 15s timeout."
        )

    def _get_ranked_eligible_ambulances(self, emergency_id: str) -> List[Dict[str, Any]]:
        """Filters out offline, stale, busy ambulances and ranks by road ETA."""
        emg_lat = self.active_emergency["lat"]
        emg_lng = self.active_emergency["lng"]

        eligible = []
        for amb in self.ambulances:
            # Eligibility rules:
            if amb["status"] in ["OFFLINE", "TRANSPORTING", "ACCEPTED", "EN ROUTE", "ON SCENE"]:
                continue
            if amb["assignment_state"] == "ASSIGNED":
                continue
            if amb.get("stale_gps", False):
                continue
            
            dist = haversine_distance_km(emg_lat, emg_lng, amb["lat"], amb["lng"])
            if dist > self.operating_radius_km:
                continue

            eta = estimate_road_eta_mins(dist, amb["speed_kmh"])
            amb_copy = dict(amb)
            amb_copy["distance_km"] = dist
            amb_copy["eta_mins"] = eta
            eligible.append(amb_copy)

        # Rank by ETA ascending
        eligible.sort(key=lambda x: (x["eta_mins"], x["distance_km"]))
        return eligible

    def get_state(self) -> Dict[str, Any]:
        """Returns the full tactical dispatch radar state."""
        emg_lat = self.active_emergency["lat"]
        emg_lng = self.active_emergency["lng"]

        # Calculate live distance & ETA for hospitals from active emergency
        enriched_hospitals = []
        for h in self.hospitals:
            h_copy = dict(h)
            dist = haversine_distance_km(emg_lat, emg_lng, h["lat"], h["lng"])
            h_copy["distance_km"] = dist
            h_copy["eta_mins"] = estimate_road_eta_mins(dist, 40.0)
            enriched_hospitals.append(h_copy)
        enriched_hospitals.sort(key=lambda x: x["distance_km"])

        # Calculate live distance & ETA for ambulances
        enriched_ambulances = []
        for a in self.ambulances:
            a_copy = dict(a)
            dist = haversine_distance_km(emg_lat, emg_lng, a["lat"], a["lng"])
            a_copy["distance_km"] = dist
            a_copy["eta_mins"] = estimate_road_eta_mins(dist, a["speed_kmh"])
            enriched_ambulances.append(a_copy)

        return {
            "demo_mode": True,
            "operating_anchor": self.operating_anchor,
            "operating_radius_km": self.operating_radius_km,
            "active_emergency": self.active_emergency,
            "hospitals": enriched_hospitals,
            "ambulances": enriched_ambulances,
            "active_offers": list(self.active_offers.values()),
            "offer_timeout_seconds": self.offer_timeout_seconds,
            "audit_log": self.audit_log,
            "timestamp": time.time()
        }

    def set_operating_radius(self, radius_km: float) -> Dict[str, Any]:
        self.operating_radius_km = float(radius_km)
        self._record_audit(
            event_type="OPERATING_RADIUS_EXPANDED",
            details=f"Radar operational radius adjusted to {radius_km} km."
        )
        return self.get_state()

    def set_incident_location(self, lat: float, lng: float, label: str, patient_id: Optional[str] = None) -> Dict[str, Any]:
        """Changes or recenters the emergency incident location."""
        self.active_emergency["lat"] = lat
        self.active_emergency["lng"] = lng
        self.active_emergency["location_label"] = label
        if patient_id:
            self.active_emergency["patient_id"] = patient_id
        
        self.active_emergency["status"] = "OFFERING"
        self.active_emergency["assigned_ambulance_id"] = None
        self.active_emergency["assigned_at"] = None

        self._record_audit(
            event_type="INCIDENT_RELOCATED",
            details=f"Incident coordinates updated to {label} ({lat:.6f}, {lng:.6f}). Refreshing unit eligibility."
        )

        self._issue_initial_demo_offers()
        return self.get_state()

    async def respond_to_offer_atomic(self, emergency_id: str, ambulance_id: str, response_type: str) -> Dict[str, Any]:
        """
        Authoritative Atomic Assignment Method.
        Protected by asyncio.Lock to guarantee race-condition safety:
        If two ambulance crews accept simultaneously, only the first commits;
        the other receives an explicit ALREADY_ASSIGNED error response.
        """
        async with self._lock:
            # 1. Validation
            if self.active_emergency["emergency_id"] != emergency_id:
                return {
                    "success": False,
                    "status": "REJECTED",
                    "reason": "EMERGENCY_MISMATCH",
                    "message": f"Emergency ID {emergency_id} not found or inactive."
                }

            # 2. If response is DECLINE
            if response_type == "DECLINE":
                if ambulance_id in self.active_offers:
                    self.active_offers[ambulance_id]["status"] = "DECLINED"
                for a in self.ambulances:
                    if a["ambulance_id"] == ambulance_id:
                        a["status"] = "AVAILABLE"
                        a["assignment_state"] = "UNASSIGNED"

                self._record_audit(
                    event_type="OFFER_DECLINED",
                    details=f"Ambulance {ambulance_id} declined assignment. Evaluating next candidate."
                )

                # Check if all active offers in this group are declined or expired
                all_declined = all(
                    o["status"] in ["DECLINED", "EXPIRED", "CANCELLED"] 
                    for o in self.active_offers.values()
                )
                if all_declined:
                    self._escalate_to_next_group()

                return {
                    "success": True,
                    "status": "DECLINED",
                    "ambulance_id": ambulance_id,
                    "state": self.get_state()
                }

            # 3. If response is ACCEPT
            if response_type == "ACCEPT":
                # RACE CONDITION GUARD: Check if emergency is already committed
                if self.active_emergency["status"] == "ASSIGNED":
                    winning_id = self.active_emergency["assigned_ambulance_id"]
                    self._record_audit(
                        event_type="RACE_CONDITION_PREVENTED",
                        details=f"Conflict averted: {ambulance_id} attempted acceptance, but emergency was already committed to {winning_id}."
                    )
                    return {
                        "success": False,
                        "status": "REJECTED",
                        "reason": "ALREADY_ASSIGNED",
                        "winning_ambulance_id": winning_id,
                        "message": f"Conflict averted: Incident is already assigned to {winning_id}."
                    }

                # Check if this specific ambulance is already committed to something else
                target_amb = next((a for a in self.ambulances if a["ambulance_id"] == ambulance_id), None)
                if not target_amb:
                    return {
                        "success": False,
                        "status": "REJECTED",
                        "reason": "AMBULANCE_NOT_FOUND",
                        "message": f"Ambulance {ambulance_id} not recognized."
                    }

                if target_amb["assignment_state"] == "ASSIGNED":
                    return {
                        "success": False,
                        "status": "REJECTED",
                        "reason": "AMBULANCE_ALREADY_COMMITTED",
                        "message": f"Ambulance {ambulance_id} is already committed to another incident."
                    }

                # ATOMIC COMMIT: This ambulance wins the assignment!
                self.active_emergency["status"] = "ASSIGNED"
                self.active_emergency["assigned_ambulance_id"] = ambulance_id
                self.active_emergency["assigned_at"] = time.time()

                # Mark winning ambulance
                target_amb["status"] = "EN ROUTE"
                target_amb["assignment_state"] = "ASSIGNED"
                target_amb["assigned_emergency_id"] = emergency_id

                # Cancel or expire all other outstanding offers
                cancelled_units = []
                for amb_id, offer in self.active_offers.items():
                    if amb_id == ambulance_id:
                        offer["status"] = "ACCEPTED"
                    else:
                        offer["status"] = "CANCELLED"
                        cancelled_units.append(amb_id)
                        # Release other ambulances back to AVAILABLE
                        for a in self.ambulances:
                            if a["ambulance_id"] == amb_id and a["assignment_state"] != "ASSIGNED":
                                a["status"] = "AVAILABLE"
                                a["assignment_state"] = "UNASSIGNED"

                self._record_audit(
                    event_type="ASSIGNMENT_CONFIRMED",
                    details=f"AUTHORITATIVE ATOMIC COMMIT: {ambulance_id} accepted and assigned to {emergency_id}. Other offers cancelled for {cancelled_units}."
                )

                return {
                    "success": True,
                    "status": "ASSIGNED",
                    "winning_ambulance_id": ambulance_id,
                    "emergency_id": emergency_id,
                    "cancelled_offers": cancelled_units,
                    "state": self.get_state()
                }

            return {
                "success": False,
                "status": "REJECTED",
                "reason": "INVALID_RESPONSE_TYPE",
                "message": f"Unknown response type {response_type}"
            }

    def _escalate_to_next_group(self):
        """Escalates to the next eligible ambulance group or expands radius."""
        emergency_id = self.active_emergency["emergency_id"]
        
        # Check currently offered or declined units
        already_offered_ids = set(self.active_offers.keys())
        all_eligible = self._get_ranked_eligible_ambulances(emergency_id)
        next_candidates = [a for a in all_eligible if a["ambulance_id"] not in already_offered_ids]

        if next_candidates:
            self.offer_group_index += 1
            top_next = next_candidates[:3]
            now = time.time()
            for amb in top_next:
                offer_id = f"OFFER-{emergency_id}-{amb['ambulance_id']}"
                dist = haversine_distance_km(
                    self.active_emergency["lat"], self.active_emergency["lng"],
                    amb["lat"], amb["lng"]
                )
                eta = estimate_road_eta_mins(dist, amb["speed_kmh"])
                self.active_offers[amb["ambulance_id"]] = {
                    "offer_id": offer_id,
                    "emergency_id": emergency_id,
                    "ambulance_id": amb["ambulance_id"],
                    "callsign": amb["callsign"],
                    "vehicle_type": amb["vehicle_type"],
                    "distance_km": dist,
                    "eta_mins": eta,
                    "issued_at": now,
                    "expires_at": now + self.offer_timeout_seconds,
                    "status": "OFFERED",
                    "group_index": self.offer_group_index
                }
                for a in self.ambulances:
                    if a["ambulance_id"] == amb["ambulance_id"]:
                        a["status"] = "OFFERED"
                        a["assignment_state"] = "PENDING_OFFER"

            self._record_audit(
                event_type="DISPATCH_ESCALATED_GROUP",
                details=f"Escalation Group {self.offer_group_index + 1} offered to {[a['ambulance_id'] for a in top_next]}."
            )
        else:
            # Expand radius if needed
            if self.operating_radius_km < 15.0:
                old_r = self.operating_radius_km
                self.operating_radius_km = min(15.0, self.operating_radius_km + 5.0)
                self._record_audit(
                    event_type="DISPATCH_ESCALATED_RADIUS",
                    details=f"No group acceptances. Auto-escalating search radius from {old_r}km to {self.operating_radius_km}km."
                )
                self._issue_initial_demo_offers()
            else:
                self.active_emergency["status"] = "ESCALATED"
                self._record_audit(
                    event_type="NO_ACCEPTANCE_DISPATCH_ALERT",
                    details="NO ACCEPTANCE — CRITICAL ESCALATION REQUIRED. All eligible units exhausted within 15km."
                )

    def force_offer_timeout(self) -> Dict[str, Any]:
        """Simulates expiration of active offers to test escalation."""
        for offer in self.active_offers.values():
            if offer["status"] == "OFFERED":
                offer["status"] = "EXPIRED"
        
        self._record_audit(
            event_type="OFFERS_TIMED_OUT",
            details=f"Offer countdown expired after {self.offer_timeout_seconds}s with no response."
        )
        self._escalate_to_next_group()
        return self.get_state()

    def reset_demo(self) -> Dict[str, Any]:
        """Resets the demo simulation to initial clean state."""
        self.operating_anchor = dict(DEFAULT_ANCHOR)
        self.operating_radius_km = 5.0
        self.ambulances = [dict(a) for a in INITIAL_AMBULANCE_FIXTURES]
        self.active_emergency = {
            "emergency_id": "EMG-JP-101",
            "patient_id": "PT-101",
            "patient_name": "Major Vikram Rathore (Blast Trauma)",
            "priority": "IMMEDIATE_RED",
            "lat": DEFAULT_ANCHOR["lat"],
            "lng": DEFAULT_ANCHOR["lng"],
            "location_label": "80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8, Bengaluru",
            "created_at": time.time(),
            "status": "OFFERING",
            "assigned_ambulance_id": None,
            "assigned_at": None,
            "recommended_hospital_id": "HOSP-ASTER-RV"
        }
        self.offer_group_index = 0
        self._record_audit(
            event_type="DEMO_RESET",
            details="Simulation reset to default anchor: 80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8."
        )
        self._issue_initial_demo_offers()
        return self.get_state()

# Global Singleton Dispatch Coordinator
dispatch_coordinator = DispatchCoordinator()
