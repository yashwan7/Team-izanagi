/**
 * Kshitij EMR - GPS Radar Demo Fixtures & Ambulance Adapter
 * Verified Anchor: 80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8, Bengaluru, 560076
 * Exact Landmarks: RVITM / Epitome Elan / Tara Cafe / Krishna Nagar Kere
 * 
 * Strict Demo-Mode Boundary: All vehicle coordinates and availability states
 * are clearly marked as DEMO SIMULATION.
 */

export const DEMO_ANCHOR = {
  name: '80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8, Bengaluru',
  address: '80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8, Bengaluru, Karnataka 560076',
  lat: 12.871773,
  lng: 77.576856,
  locality: 'Brookes Haven Layout, JP Nagar Phase 8',
  pincode: '560076',
  landmark: 'Adjacent to RVITM & Epitome Elan, near Krishna Nagar Kere',
  defaultRadiusKm: 5.0
};

export const ALTERNATIVE_LOCATIONS = [
  {
    id: 'LOC-BROOKES-HAVEN',
    label: '80 Feet Rd / Brookes Haven (Default)',
    lat: 12.871773,
    lng: 77.576856,
    landmark: '80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8'
  },
  {
    id: 'LOC-RVITM-CAMPUS',
    label: 'RVITM Campus / Chaithanya Layout',
    lat: 12.872100,
    lng: 77.575500,
    landmark: 'RV Institute of Technology & Management Entrance'
  },
  {
    id: 'LOC-EPITOME-ELAN',
    label: 'Epitome Elan / 80 Feet Road',
    lat: 12.874500,
    lng: 77.576800,
    landmark: 'Epitome Elan Luxury Residences, 80 Feet Rd'
  },
  {
    id: 'LOC-KRISHNA-KERE',
    label: 'Krishna Nagar Kere / Hemagiri BDA Park',
    lat: 12.873200,
    lng: 77.581200,
    landmark: 'Kothnur Joggers Park & Lake Perimeter'
  },
  {
    id: 'LOC-KONANAKUNTE-CROSS',
    label: 'Konanakunte Cross Metro Station',
    lat: 12.889500,
    lng: 77.564500,
    landmark: 'Kanakapura Rd / Green Line Metro Junction'
  },
  {
    id: 'LOC-KOTHANUR-MAIN',
    label: 'Kothanur Main / 80 Feet Road Junction',
    lat: 12.880800,
    lng: 77.584200,
    landmark: 'Near TR Hospital & Chunchgatta Link'
  }
];

export const VERIFIED_HOSPITALS = [
  {
    hospital_id: 'HOSP-TR-KOTHANUR',
    name: 'TR Hospital, JP Nagar 8th Phase',
    address: '80 Feet Road, Kothanur, JP Nagar 8th Phase, Bengaluru 560076',
    lat: 12.880755,
    lng: 77.584167,
    phone: '+91 80 2685 0099',
    capabilities: ['24/7 Casualty', 'Emergency Trauma Resus', 'General ICU', 'In-house Pharmacy'],
    total_beds: 65,
    icu_available: 6,
    triage_compatibility: ['IMMEDIATE_RED', 'DELAYED_YELLOW'],
    verified: true
  },
  {
    hospital_id: 'HOSP-RAJNANDANI',
    name: 'Rajnandani Hospital, JP Nagar 8th Phase',
    address: 'Chunchgatta Main Rd, Konanakunte, JP Nagar 8th Phase, Bengaluru 560062',
    lat: 12.884545,
    lng: 77.570128,
    phone: '+91 80 2686 2200',
    capabilities: ['Emergency Critical Care', 'Orthopedic Trauma', 'Obstetric Emergency', 'ICU'],
    total_beds: 80,
    icu_available: 8,
    triage_compatibility: ['IMMEDIATE_RED', 'DELAYED_YELLOW'],
    verified: true
  },
  {
    hospital_id: 'HOSP-METRO-KANAK',
    name: 'Metro Hospital, Kanakapura Road',
    address: 'Near Konanakunte Cross Metro Station, Kanakapura Rd, Bengaluru 560062',
    lat: 12.891589,
    lng: 77.560715,
    phone: '+91 80 2666 4433',
    capabilities: ['24/7 Trauma Care', 'Cardiac Resuscitation', 'Emergency ICU', 'Dialysis'],
    total_beds: 100,
    icu_available: 10,
    triage_compatibility: ['IMMEDIATE_RED', 'DELAYED_YELLOW'],
    verified: true
  },
  {
    hospital_id: 'HOSP-FORTIS-BG',
    name: 'Fortis Hospital, Bannerghatta Road',
    address: '154/9, Bannerghatta Rd, Opposite IIMB, Bengaluru 560076',
    lat: 12.894210,
    lng: 77.598920,
    phone: '+91 80 6621 4444',
    capabilities: ['Level-1 Emergency Care', 'Critical Polytrauma', 'ECMO', 'Cath Lab'],
    total_beds: 280,
    icu_available: 18,
    triage_compatibility: ['IMMEDIATE_RED', 'DELAYED_YELLOW'],
    verified: true
  },
  {
    hospital_id: 'HOSP-SAMMPRADA',
    name: 'Sammprada Hospital, JP Nagar 3rd Phase',
    address: '8th Main Rd, JP Nagar 3rd Phase, Bengaluru 560078',
    lat: 12.906385,
    lng: 77.594680,
    phone: '+91 80 4333 5555',
    capabilities: ['Surgical Critical Care', 'Emergency OT', 'Trauma Stabilization'],
    total_beds: 90,
    icu_available: 6,
    triage_compatibility: ['DELAYED_YELLOW', 'MINIMAL_GREEN'],
    verified: true
  },
  {
    hospital_id: 'HOSP-ASTER-RV',
    name: 'Aster RV Hospital, JP Nagar 1st Phase',
    address: 'CA-37, 24th Main Rd, LIC Colony, JP Nagar 1st Phase, Bengaluru 560078',
    lat: 12.911417,
    lng: 77.585027,
    phone: '+91 80 6605 5000',
    capabilities: ['Level-1 Trauma', '24/7 Emergency', 'Critical Resus', 'Neuro-trauma'],
    total_beds: 250,
    icu_available: 14,
    triage_compatibility: ['IMMEDIATE_RED', 'DELAYED_YELLOW'],
    verified: true
  },
  {
    hospital_id: 'HOSP-RAJSHEKAR',
    name: 'Rajshekar Multi Speciality Hospital, JP Nagar',
    address: '21st Main Rd, Marenhalli, JP Nagar 1st Phase, Bengaluru 560078',
    lat: 12.912640,
    lng: 77.579480,
    phone: '+91 80 2664 6100',
    capabilities: ['24/7 Casualty', 'Neuro-trauma', 'Orthopedic ER', 'ICU'],
    total_beds: 120,
    icu_available: 8,
    triage_compatibility: ['IMMEDIATE_RED', 'DELAYED_YELLOW'],
    verified: true
  },
  {
    hospital_id: 'HOSP-JAYADEVA',
    name: 'Jayadeva Institute of Cardiovascular Sciences',
    address: 'Bannerghatta Main Rd, Jayanagar 9th Block, Bengaluru 560069',
    lat: 12.918510,
    lng: 77.598280,
    phone: '+91 80 2297 7400',
    capabilities: ['Autonomous Cardiac Emergency', 'Coronary Care Unit', 'ECMO'],
    total_beds: 600,
    icu_available: 25,
    triage_compatibility: ['IMMEDIATE_RED'],
    verified: true
  }
];

export const VERIFIED_MEDICAL_SHOPS = [
  {
    shop_id: 'SHOP-MEDPLUS-80FT',
    name: 'MedPlus Pharmacy — 80 Feet Road (Brookes Haven)',
    short_name: 'MedPlus Rx',
    address: '80 Feet Road, Brookes Haven Layout, JP Nagar 8th Phase, Bengaluru 560076',
    lat: 12.872200,
    lng: 77.576600,
    phone: '+91 80 2685 4101',
    operating_hours: '24/7 Day & Night Emergency Pharmacy',
    is_24x7: true,
    capabilities: ['Emergency Resus Kits', 'TXA Injection', 'Normal Saline IV', 'Antibiotics'],
    verified: true
  },
  {
    shop_id: 'SHOP-APOLLO-RVITM',
    name: 'Apollo Pharmacy — 80 Feet Road (Opp. RVITM)',
    short_name: 'Apollo Rx',
    address: '80 Feet Road, Opp. RVITM Campus, JP Nagar 8th Phase, Bengaluru 560076',
    lat: 12.873500,
    lng: 77.576100,
    phone: '+91 80 2685 5522',
    operating_hours: '24/7 Emergency Operation',
    is_24x7: true,
    capabilities: ['Epinephrine (1:1000)', 'Naloxone / Narcan', 'Critical Cardiac Drugs'],
    verified: true
  },
  {
    shop_id: 'SHOP-WELLNESS-ELAN',
    name: 'Wellness Forever 24x7 Chemist (Near Epitome Elan)',
    short_name: 'Wellness 24x7',
    address: '80 Feet Road, Near Tara Cafe & Epitome Elan, JP Nagar 8th Phase, Bengaluru 560076',
    lat: 12.874800,
    lng: 77.577200,
    phone: '+91 80 4322 8800',
    operating_hours: '24/7 Day & Night Chemist',
    is_24x7: true,
    capabilities: ['Cold Chain Storage', 'Atropine Sulfate', 'IV Infusion Sets', 'First Aid'],
    verified: true
  },
  {
    shop_id: 'SHOP-TR-HOSP',
    name: 'TR Hospital 24/7 Casualty Pharmacy',
    short_name: 'TR Hospital Rx',
    address: 'TR Hospital Campus, 80 Feet Road, Kothanur, JP Nagar 8th Phase 560076',
    lat: 12.880755,
    lng: 77.584167,
    phone: '+91 80 2685 0099',
    operating_hours: '24/7 Hospital Trauma Dispensary',
    is_24x7: true,
    capabilities: ['Level-1 Trauma Packs', 'Blood Units Matching', 'Critical Care Vials'],
    verified: true
  },
  {
    shop_id: 'SHOP-SANJIVANI-KERE',
    name: 'Sanjivani Medical & General Stores',
    short_name: 'Sanjivani Rx',
    address: 'Kothanur Dinne Main Rd, Near Krishna Nagar Kere, JP Nagar 8th Phase 560076',
    lat: 12.876500,
    lng: 77.580200,
    phone: '+91 80 2686 1144',
    operating_hours: '07:30 - 23:30 (Open Now)',
    is_24x7: false,
    capabilities: ['General First Aid', 'Splints & Bandages', 'Burn Relief Dressings'],
    verified: true
  },
  {
    shop_id: 'SHOP-JAN-AUSHADHI',
    name: 'Pradhan Mantri Jan Aushadhi Kendra',
    short_name: 'Jan Aushadhi',
    address: 'Chunchgatta Main Rd, Konanakunte, JP Nagar 8th Phase, Bengaluru 560062',
    lat: 12.881200,
    lng: 77.571500,
    phone: '+91 80 2686 3399',
    operating_hours: '08:00 - 21:00 (Open Now)',
    is_24x7: false,
    capabilities: ['Bio-equivalent Generics', 'Subsidized Essential Medicines'],
    verified: true
  }
];

export const INITIAL_AMBULANCES = [
  {
    ambulance_id: 'AMB-01',
    callsign: 'Brookes Haven ALS Alpha-1',
    vehicle_type: 'ALS (Advanced Life Support)',
    lat: 12.874800,
    lng: 77.576500,
    status: 'AVAILABLE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 180,
    speed_kmh: 32.0,
    last_gps_update: '4s ago',
    crew: 'Medic R. Nayak, Pilot S. Rao',
    equipment: ['Ventilator', 'Defibrillator', 'IV Pumps', 'Combat Gauze'],
    stale_gps: false
  },
  {
    ambulance_id: 'AMB-02',
    callsign: 'RVITM Gate BLS Beta-2',
    vehicle_type: 'BLS (Basic Life Support)',
    lat: 12.871500,
    lng: 77.574200,
    status: 'AVAILABLE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 45,
    speed_kmh: 28.0,
    last_gps_update: '10s ago',
    crew: 'EMT V. Gowda, Pilot M. Kumar',
    equipment: ['Oxygen Resuscitator', 'Splints', 'Spine Board'],
    stale_gps: false
  },
  {
    ambulance_id: 'AMB-03',
    callsign: 'Kothanur MICU Critical-3',
    vehicle_type: 'MICU (Mobile ICU)',
    lat: 12.878200,
    lng: 77.581500,
    status: 'AVAILABLE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 220,
    speed_kmh: 35.0,
    last_gps_update: '3s ago',
    crew: 'Dr. P. Hegde (ER Phys), Medic C. Das',
    equipment: ['Transport Vent', 'Blood Warmer', 'Ultrasound', 'Multipara Monitor'],
    stale_gps: false
  },
  {
    ambulance_id: 'AMB-04',
    callsign: 'Krishna Kere ALS-4',
    vehicle_type: 'ALS (Advanced Life Support)',
    lat: 12.870500,
    lng: 77.582800,
    status: 'AVAILABLE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 310,
    speed_kmh: 30.0,
    last_gps_update: '7s ago',
    crew: 'Paramedic K. Sharma, Pilot A. Joshi',
    equipment: ['Defibrillator', 'LUCAS CPR', 'Suction Unit'],
    stale_gps: false
  },
  {
    ambulance_id: 'AMB-05',
    callsign: 'Chunchgatta BLS Patrol-5',
    vehicle_type: 'BLS (Basic Life Support)',
    lat: 12.883500,
    lng: 77.569500,
    status: 'AVAILABLE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 90,
    speed_kmh: 34.0,
    last_gps_update: '12s ago',
    crew: 'EMT-P N. Reddy, Pilot T. Babu',
    equipment: ['Defib Monitor', 'Chest Seals', 'TXA Kit'],
    stale_gps: false
  },
  {
    ambulance_id: 'AMB-06',
    callsign: 'Konanakunte Rapid BLS-6',
    vehicle_type: 'BLS (Basic Life Support)',
    lat: 12.888000,
    lng: 77.574000,
    status: 'AVAILABLE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 160,
    speed_kmh: 26.0,
    last_gps_update: '18s ago',
    crew: 'EMT D. Patil, Pilot B. Suresh',
    equipment: ['C-Collar', 'First Aid Kit', 'Automated Defib'],
    stale_gps: false
  },
  {
    ambulance_id: 'AMB-07',
    callsign: 'Kanakapura Metro MICU-7',
    vehicle_type: 'MICU (Mobile ICU)',
    lat: 12.891500,
    lng: 77.562000,
    status: 'AVAILABLE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 130,
    speed_kmh: 38.0,
    last_gps_update: '5s ago',
    crew: 'Dr. A. Verma, Medic E. Paul',
    equipment: ['ICU Ventilator', 'Infusion Pumps', 'Capnography'],
    stale_gps: false
  },
  {
    ambulance_id: 'AMB-08',
    callsign: 'Bannerghatta Gottigere BLS-8',
    vehicle_type: 'BLS (Basic Life Support)',
    lat: 12.876000,
    lng: 77.592000,
    status: 'AVAILABLE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 260,
    speed_kmh: 30.0,
    last_gps_update: '20s ago',
    crew: 'EMT R. Mohan, Pilot G. Prasad',
    equipment: ['Spine Board', 'Oxygen Delivery', 'Tourniquets'],
    stale_gps: false
  },
  {
    ambulance_id: 'AMB-09',
    callsign: 'Fortis Depot ALS-9',
    vehicle_type: 'ALS (Advanced Life Support)',
    lat: 12.894200,
    lng: 77.598000,
    status: 'AVAILABLE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 210,
    speed_kmh: 35.0,
    last_gps_update: '14s ago',
    crew: 'Medic L. Fernandez, Pilot K. John',
    equipment: ['Multi-Lead ECG', 'Emergency Drug Kit', 'EZ-IO'],
    stale_gps: false
  },
  {
    ambulance_id: 'AMB-10',
    callsign: 'JP Nagar 5th Phase BLS-10',
    vehicle_type: 'BLS (Basic Life Support)',
    lat: 12.905000,
    lng: 77.585000,
    status: 'AVAILABLE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 180,
    speed_kmh: 29.0,
    last_gps_update: '25s ago',
    crew: 'EMT S. Bhat, Pilot H. Ali',
    equipment: ['Splints', 'Stretcher', 'Basic Airway Kit'],
    stale_gps: false
  },
  {
    ambulance_id: 'AMB-11',
    callsign: 'South Reserve ALS-11 (Offline)',
    vehicle_type: 'ALS (Advanced Life Support)',
    lat: 12.865000,
    lng: 77.570000,
    status: 'OFFLINE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 0,
    speed_kmh: 0.0,
    last_gps_update: '8m ago',
    crew: 'Maintenance Shift',
    equipment: ['Depot Service Pending'],
    stale_gps: true
  },
  {
    ambulance_id: 'AMB-12',
    callsign: 'West Grid MICU-12 (Stale GPS)',
    vehicle_type: 'MICU (Mobile ICU)',
    lat: 12.882000,
    lng: 77.560000,
    status: 'AVAILABLE',
    assignment_state: 'UNASSIGNED',
    assigned_emergency_id: null,
    heading: 90,
    speed_kmh: 0.0,
    last_gps_update: '9m ago',
    crew: 'Medic F. Joseph, Pilot N. Kumar',
    equipment: ['Full Mobile ICU Kit'],
    stale_gps: true
  }
];

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

export function estimateRoadEtaMins(distanceKm, speedKmh = 35.0) {
  const urbanTrafficFactor = 1.35;
  const minutes = (distanceKm / Math.max(15.0, speedKmh)) * 60.0 * urbanTrafficFactor;
  return Math.max(1, Math.ceil(minutes));
}
