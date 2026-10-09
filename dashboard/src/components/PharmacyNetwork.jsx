import React, { useState, useMemo, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  Pill, Search, Building2, MapPin, Phone, ExternalLink, 
  RefreshCw, CheckCircle2, Clock, 
  Navigation, ShieldAlert, ShieldCheck, ArrowRight, X, Filter,
  Package, Check, Eye, AlertOctagon, Info
} from 'lucide-react';

// Baseline Demonstration Pharmacy & Stock Dataset
// Explicitly documented as simulated demonstration data for tactical clinical triage.
const INITIAL_PHARMACIES = [
  {
    id: 'PHARM-01',
    name: 'MedPlus Pharmacy — 80 Feet Road (Brookes Haven)',
    address: '80 Feet Road, Brookes Haven Layout, JP Nagar 8th Phase, Bengaluru 560076',
    locality: 'Brookes Haven Layout',
    phone: '+91 80 2685 4101',
    operating_hours: '24/7 Day & Night Emergency Pharmacy',
    is_open: true,
    lat: 12.872200,
    lng: 77.576600,
    distance_km: 0.08,
    verified_at: 'Just now',
    is_verified: true,
    network_status: 'ONLINE_MESH',
    inventory: [
      {
        id: 'MED-TXA-1',
        name: 'Tranexamic Acid (TXA)',
        brand_name: 'Cyklokapron',
        generic_name: 'Tranexamic Acid',
        ingredient: 'Tranexamic acid',
        strength: '1000 mg / 10 mL',
        form: 'Injection',
        stock: 42,
        min_threshold: 15,
        price: '$18.50 / vial',
        generic_alternative: 'Generic TXA Bio-equivalent available',
        batch: 'TXA-2026-B81',
        expiry: '2027-08',
        last_updated: '2 mins ago'
      },
      {
        id: 'MED-NOR-1',
        name: 'Norepinephrine Bitartrate',
        brand_name: 'Levophed',
        generic_name: 'Norepinephrine',
        ingredient: 'Norepinephrine',
        strength: '4 mg / 4 mL',
        form: 'Ampoule',
        stock: 6,
        min_threshold: 10,
        price: '$24.00 / ampoule',
        generic_alternative: 'Arterenol generic available',
        batch: 'NOR-2026-F14',
        expiry: '2027-03',
        last_updated: '5 mins ago'
      },
      {
        id: 'MED-MOR-1',
        name: 'Morphine Sulfate',
        brand_name: 'Duramorph',
        generic_name: 'Morphine',
        ingredient: 'Morphine sulfate',
        strength: '10 mg / 1 mL',
        form: 'Vial',
        stock: 18,
        min_threshold: 8,
        price: '$12.00 / vial',
        generic_alternative: 'Schedule II Controlled - DEA auth required',
        batch: 'MOR-2026-C09',
        expiry: '2026-12',
        last_updated: '2 mins ago'
      },
      {
        id: 'MED-SAL-1',
        name: 'Normal Saline 0.9%',
        brand_name: 'Baxter Saline',
        generic_name: 'Sodium Chloride 0.9%',
        ingredient: 'Sodium chloride',
        strength: '500 mL IV Bag',
        form: 'IV Solution',
        stock: 120,
        min_threshold: 30,
        price: '$4.20 / bag',
        generic_alternative: 'Plasmalyte-A acceptable substitute',
        batch: 'SAL-2026-A12',
        expiry: '2028-01',
        last_updated: '10 mins ago'
      }
    ]
  },
  {
    id: 'PHARM-02',
    name: 'Apollo Pharmacy — 80 Feet Road (Opp. RVITM)',
    address: '80 Feet Road, Opp. RVITM Campus, JP Nagar 8th Phase, Bengaluru 560076',
    locality: 'RVITM Campus Corridor',
    phone: '+91 80 2685 5522',
    operating_hours: '24/7 Emergency Operation',
    is_open: true,
    lat: 12.873500,
    lng: 77.576100,
    distance_km: 0.22,
    verified_at: '3 mins ago',
    is_verified: true,
    network_status: 'ONLINE_MESH',
    inventory: [
      {
        id: 'MED-EPI-1',
        name: 'Epinephrine (1:1000)',
        brand_name: 'Adrenalin',
        generic_name: 'Epinephrine',
        ingredient: 'Epinephrine',
        strength: '1 mg / 1 mL',
        form: 'Ampoule',
        stock: 35,
        min_threshold: 12,
        price: '$16.00 / ampoule',
        generic_alternative: 'Generic auto-injector or ampoule',
        batch: 'EPI-2026-M44',
        expiry: '2027-05',
        last_updated: '6 mins ago'
      },
      {
        id: 'MED-TXA-2',
        name: 'Tranexamic Acid (TXA)',
        brand_name: 'Cyklokapron',
        generic_name: 'Tranexamic Acid',
        ingredient: 'Tranexamic acid',
        strength: '500 mg',
        form: 'Tablet',
        stock: 80,
        min_threshold: 25,
        price: '$1.40 / tab',
        generic_alternative: 'Lysteda equivalent available',
        batch: 'TXA-2026-T19',
        expiry: '2027-11',
        last_updated: '6 mins ago'
      },
      {
        id: 'MED-NAL-1',
        name: 'Naloxone HCl',
        brand_name: 'Narcan',
        generic_name: 'Naloxone',
        ingredient: 'Naloxone hydrochloride',
        strength: '2 mg / 2 mL',
        form: 'Pre-filled Syringe',
        stock: 4,
        min_threshold: 10,
        price: '$38.00 / unit',
        generic_alternative: 'Intranasal spray available on request',
        batch: 'NAL-2026-K02',
        expiry: '2026-11',
        last_updated: '8 mins ago'
      },
      {
        id: 'MED-CEF-1',
        name: 'Cefazolin Sodium',
        brand_name: 'Ancef',
        generic_name: 'Cefazolin',
        ingredient: 'Cefazolin sodium',
        strength: '1 g Powder for Inj',
        form: 'Injection',
        stock: 22,
        min_threshold: 15,
        price: '$9.50 / vial',
        generic_alternative: 'Cephalexin for PO stepdown',
        batch: 'CEF-2026-L89',
        expiry: '2027-09',
        last_updated: '6 mins ago'
      }
    ]
  },
  {
    id: 'PHARM-03',
    name: 'Wellness Forever 24x7 Chemist (Near Epitome Elan)',
    address: '80 Feet Road, Near Tara Cafe & Epitome Elan, JP Nagar 8th Phase, Bengaluru 560076',
    locality: 'Epitome Elan / 80 Feet Rd',
    phone: '+91 80 4322 8800',
    operating_hours: '24/7 Day & Night Pharmacy',
    is_open: true,
    lat: 12.874800,
    lng: 77.577200,
    distance_km: 0.35,
    verified_at: '8 mins ago',
    is_verified: true,
    network_status: 'STABLE_CELLULAR',
    inventory: [
      {
        id: 'MED-ATR-1',
        name: 'Atropine Sulfate',
        brand_name: 'AtroPen',
        generic_name: 'Atropine',
        ingredient: 'Atropine sulfate',
        strength: '1 mg / 1 mL',
        form: 'Ampoule',
        stock: 29,
        min_threshold: 10,
        price: '$11.20 / ampoule',
        generic_alternative: 'Glycopyrrolate alternative available',
        batch: 'ATR-2026-P01',
        expiry: '2027-04',
        last_updated: '18 mins ago'
      },
      {
        id: 'MED-FEN-1',
        name: 'Fentanyl Citrate',
        brand_name: 'Sublimaze',
        generic_name: 'Fentanyl',
        ingredient: 'Fentanyl citrate',
        strength: '100 mcg / 2 mL',
        form: 'Ampoule',
        stock: 0,
        min_threshold: 8,
        price: '$14.00 / ampoule',
        generic_alternative: 'Sufentanil or Alfentanil backup',
        batch: 'FEN-2025-Z99',
        expiry: '2026-08',
        last_updated: '25 mins ago'
      },
      {
        id: 'MED-SAL-2',
        name: 'Normal Saline 0.9%',
        brand_name: 'Braun Saline',
        generic_name: 'Sodium Chloride 0.9%',
        ingredient: 'Sodium chloride',
        strength: '1000 mL IV Bag',
        form: 'IV Solution',
        stock: 64,
        min_threshold: 20,
        price: '$6.50 / bag',
        generic_alternative: 'Ringer Lactate (RL) available',
        batch: 'SAL-2026-G82',
        expiry: '2028-03',
        last_updated: '18 mins ago'
      }
    ]
  },
  {
    id: 'PHARM-04',
    name: 'TR Hospital 24/7 Casualty Pharmacy',
    address: 'TR Hospital Campus, 80 Feet Road, Kothanur, JP Nagar 8th Phase 560076',
    locality: 'Kothanur 80 Feet Road',
    phone: '+91 80 2685 0099',
    operating_hours: '24/7 Hospital Trauma Dispensary',
    is_open: true,
    lat: 12.880755,
    lng: 77.584167,
    distance_km: 1.2,
    verified_at: '2 mins ago',
    is_verified: true,
    network_status: 'ONLINE_MESH',
    inventory: [
      {
        id: 'MED-TXA-3',
        name: 'Tranexamic Acid (TXA)',
        brand_name: 'Cyklokapron',
        generic_name: 'Tranexamic Acid',
        ingredient: 'Tranexamic acid',
        strength: '1000 mg / 10 mL',
        form: 'Injection',
        stock: 12,
        min_threshold: 15,
        price: '$19.00 / vial',
        generic_alternative: 'Aminocaproic acid alternative',
        batch: 'TXA-2026-R41',
        expiry: '2027-02',
        last_updated: '42 mins ago'
      },
      {
        id: 'MED-NOR-2',
        name: 'Norepinephrine Bitartrate',
        brand_name: 'Levophed',
        generic_name: 'Norepinephrine',
        ingredient: 'Norepinephrine',
        strength: '4 mg / 4 mL',
        form: 'Ampoule',
        stock: 0,
        min_threshold: 10,
        price: '$26.00 / ampoule',
        generic_alternative: 'Dopamine / Vasopressin substitution',
        batch: 'NOR-2025-V11',
        expiry: '2026-09',
        last_updated: '1 hr ago'
      },
      {
        id: 'MED-CEF-2',
        name: 'Cefazolin Sodium',
        brand_name: 'Ancef',
        generic_name: 'Cefazolin',
        ingredient: 'Cefazolin sodium',
        strength: '2 g Powder for Inj',
        form: 'Injection',
        stock: 14,
        min_threshold: 10,
        price: '$15.00 / vial',
        generic_alternative: 'Ceftriaxone 1g available',
        batch: 'CEF-2026-P31',
        expiry: '2027-07',
        last_updated: '42 mins ago'
      }
    ]
  },
  {
    id: 'PHARM-05',
    name: 'Sanjivani Medical & General Stores',
    address: 'Kothanur Dinne Main Rd, Near Krishna Nagar Kere, JP Nagar 8th Phase 560076',
    locality: 'Krishna Nagar Lake Sector',
    phone: '+91 80 2686 1144',
    operating_hours: '07:30 - 23:30 (Open Now)',
    is_open: true,
    lat: 12.876500,
    lng: 77.580200,
    distance_km: 0.65,
    verified_at: '15 mins ago',
    is_verified: true,
    network_status: 'ONLINE_MESH',
    inventory: [
      {
        id: 'MED-MOR-2',
        name: 'Morphine Sulfate',
        brand_name: 'Duramorph',
        generic_name: 'Morphine',
        ingredient: 'Morphine sulfate',
        strength: '10 mg / 1 mL',
        form: 'Vial',
        stock: 25,
        min_threshold: 10,
        price: '$12.50 / vial',
        generic_alternative: 'Schedule II Locked',
        batch: 'MOR-2026-F02',
        expiry: '2027-01',
        last_updated: '3 hrs ago'
      },
      {
        id: 'MED-NAL-2',
        name: 'Naloxone HCl',
        brand_name: 'Narcan',
        generic_name: 'Naloxone',
        ingredient: 'Naloxone hydrochloride',
        strength: '4 mg / 0.1 mL',
        form: 'Intranasal Spray',
        stock: 15,
        min_threshold: 5,
        price: '$45.00 / unit',
        generic_alternative: 'Injectable Narcan available',
        batch: 'NAL-2026-Y88',
        expiry: '2027-10',
        last_updated: '3 hrs ago'
      }
    ]
  },
  {
    id: 'PHARM-06',
    name: 'Jan Aushadhi Kendra (Generic Pharmacy)',
    address: 'Chunchgatta Main Rd, Konanakunte, JP Nagar 8th Phase, Bengaluru 560062',
    locality: 'Chunchgatta / Konanakunte',
    phone: '+91 80 2686 3399',
    operating_hours: '08:00 - 21:00 (Open Now)',
    is_open: true,
    lat: 12.881200,
    lng: 77.571500,
    distance_km: 1.2,
    verified_at: 'Just now',
    is_verified: true,
    network_status: 'ONLINE_MESH',
    inventory: [
      {
        id: 'MED-TXA-4',
        name: 'Tranexamic Acid (TXA)',
        brand_name: 'Cyklokapron',
        generic_name: 'Tranexamic Acid',
        ingredient: 'Tranexamic acid',
        strength: '1000 mg / 10 mL',
        form: 'Injection',
        stock: 31,
        min_threshold: 12,
        price: '$18.00 / vial',
        generic_alternative: 'Generic TXA Bio-equivalent available',
        batch: 'TXA-2026-D44',
        expiry: '2027-12',
        last_updated: 'Just now'
      },
      {
        id: 'MED-EPI-2',
        name: 'Epinephrine (1:1000)',
        brand_name: 'Adrenalin',
        generic_name: 'Epinephrine',
        ingredient: 'Epinephrine',
        strength: '1 mg / 1 mL',
        form: 'Ampoule',
        stock: 19,
        min_threshold: 8,
        price: '$15.50 / ampoule',
        generic_alternative: 'Racemic epinephrine backup',
        batch: 'EPI-2026-H11',
        expiry: '2027-06',
        last_updated: 'Just now'
      },
      {
        id: 'MED-ATR-2',
        name: 'Atropine Sulfate',
        brand_name: 'AtroPen',
        generic_name: 'Atropine',
        ingredient: 'Atropine sulfate',
        strength: '0.5 mg / 1 mL',
        form: 'Ampoule',
        stock: 5,
        min_threshold: 8,
        price: '$9.80 / ampoule',
        generic_alternative: 'Atropine 1mg alternative',
        batch: 'ATR-2026-W32',
        expiry: '2027-02',
        last_updated: 'Just now'
      }
    ]
  }
];

export default function PharmacyNetwork({ patients: _patients = [], onSelectPatient: _onSelectPatient }) {
  // State
  const [pharmacies, setPharmacies] = useState(INITIAL_PHARMACIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [qtyFilter, setQtyFilter] = useState('ALL'); // 'ALL' | '1' | '5' | '10' | '20'
  const [distanceFilter, setDistanceFilter] = useState('ALL'); // 'ALL' | '1.5' | '3.0' | '5.0'
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL'); // 'ALL' | 'AVAILABLE' | 'LOW' | 'OUT'
  const [openOnlyFilter, setOpenOnlyFilter] = useState(false);
  const [genericOnlyFilter, setGenericOnlyFilter] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Selected Pharmacy Drawer State
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  
  // Reservation Modal State
  const [reserveModalData, setReserveModalData] = useState(null); // { pharmacy, medicine }
  const [reserveQty, setReserveQty] = useState(2);
  const [reserveTarget, setReserveTarget] = useState('Ambulance AMB-101 (Sgt. Marcus Vance)');
  const [reservePriority, setReservePriority] = useState('STAT_CRITICAL');
  const [notification, setNotification] = useState(null);

  // Map References & Google Maps Integration
  const [mapType, setMapType] = useState('google-roads'); // 'google-roads' | 'google-hybrid' | 'google-terrain' | 'tactical-dark' | 'osm' | 'light-streets'
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef([]);

  const notify = (msg, isError = false) => {
    setNotification({ msg, isError });
    setTimeout(() => setNotification(null), 4500);
  };

  // Flattened medicine search listings
  const flatMedicineListings = useMemo(() => {
    const results = [];
    const q = searchQuery.trim().toLowerCase();

    pharmacies.forEach(pharm => {
      // Check distance filter
      if (distanceFilter !== 'ALL') {
        const maxDist = parseFloat(distanceFilter);
        if (pharm.distance_km > maxDist) return;
      }

      // Check open status filter
      if (openOnlyFilter && !pharm.is_open) return;

      pharm.inventory.forEach(med => {
        // Multi-attribute search
        if (q) {
          const matchName = med.name.toLowerCase().includes(q);
          const matchBrand = (med.brand_name || '').toLowerCase().includes(q);
          const matchGeneric = (med.generic_name || '').toLowerCase().includes(q);
          const matchIngredient = (med.ingredient || '').toLowerCase().includes(q);
          const matchStrength = med.strength.toLowerCase().includes(q);
          const matchForm = med.form.toLowerCase().includes(q);
          const matchPharm = pharm.name.toLowerCase().includes(q);
          const matchLocality = pharm.locality.toLowerCase().includes(q);

          if (!matchName && !matchBrand && !matchGeneric && !matchIngredient && !matchStrength && !matchForm && !matchPharm && !matchLocality) {
            return;
          }
        }

        // Qty filter
        if (qtyFilter !== 'ALL') {
          const reqQty = parseInt(qtyFilter);
          if (med.stock < reqQty) return;
        }

        // Stock status filter
        const isOut = med.stock === 0;
        const isLow = med.stock > 0 && med.stock <= med.min_threshold;
        const isAvail = med.stock > med.min_threshold;

        if (stockStatusFilter === 'OUT' && !isOut) return;
        if (stockStatusFilter === 'LOW' && !isLow) return;
        if (stockStatusFilter === 'AVAILABLE' && !isAvail) return;

        // Generic filter
        if (genericOnlyFilter && !med.generic_alternative) return;

        results.push({
          pharmacy: pharm,
          medicine: med,
          status: isOut ? 'OUT' : isLow ? 'LOW' : 'AVAILABLE'
        });
      });
    });

    return results;
  }, [pharmacies, searchQuery, qtyFilter, distanceFilter, stockStatusFilter, openOnlyFilter, genericOnlyFilter]);

  // Operational metrics
  const metrics = useMemo(() => {
    const totalPharmacies = pharmacies.length;
    const reportingOnline = pharmacies.filter(p => p.network_status.includes('ONLINE')).length;
    let totalListings = 0;
    pharmacies.forEach(p => { totalListings += p.inventory.length; });
    const urgentRequests = 2; // Simulated priority queue

    return { totalPharmacies, reportingOnline, totalListings, urgentRequests };
  }, [pharmacies]);

  // Handle Refresh / Check Availability Action
  const handleCheckAvailability = (pharmId, medId) => {
    setPharmacies(prev => prev.map(p => {
      if (p.id === pharmId) {
        return {
          ...p,
          verified_at: 'Just now (Verified via Mesh)',
          is_verified: true,
          inventory: p.inventory.map(m => {
            if (m.id === medId) {
              return { ...m, last_updated: 'Just now' };
            }
            return m;
          })
        };
      }
      return p;
    }));
    notify(`Refreshed mesh telemetry for ${pharmId}: Verified inventory confirmation received.`);
  };

  // Handle Reservation Execution
  const handleExecuteReservation = (e) => {
    e.preventDefault();
    if (!reserveModalData) return;

    const { pharmacy, medicine } = reserveModalData;
    
    // Decrement simulated stock locally
    setPharmacies(prev => prev.map(p => {
      if (p.id === pharmacy.id) {
        return {
          ...p,
          inventory: p.inventory.map(m => {
            if (m.id === medicine.id) {
              const newStock = Math.max(0, m.stock - reserveQty);
              return { ...m, stock: newStock, last_updated: 'Just now' };
            }
            return m;
          })
        };
      }
      return p;
    }));

    notify(`RESERVATION CONFIRMED: ${reserveQty}x ${medicine.name} locked at ${pharmacy.name} for ${reserveTarget}. Electronic triage code generated.`);
    setReserveModalData(null);
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [12.871773, 77.576856],
        zoom: 15,
        zoomControl: true,
        attributionControl: false
      });
      mapInstanceRef.current = map;
    }
  }, []);

  // Update Tile Layer when mapType changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let tileUrl = '';
    let options = {};

    if (mapType === 'google-roads') {
      // Direct Google Maps Road / Street Layer
      tileUrl = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      options = { maxZoom: 20, subdomains: ['0', '1', '2', '3'] };
    } else if (mapType === 'google-hybrid') {
      // Direct Google Maps Hybrid Satellite + Labels Layer
      tileUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      options = { maxZoom: 20, subdomains: ['0', '1', '2', '3'] };
    } else if (mapType === 'google-terrain') {
      // Direct Google Maps Terrain Layer
      tileUrl = 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
      options = { maxZoom: 20, subdomains: ['0', '1', '2', '3'] };
    } else if (mapType === 'tactical-dark') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      options = { maxZoom: 19, subdomains: 'abcd' };
    } else if (mapType === 'osm') {
      tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      options = { maxZoom: 19 };
    } else {
      // Light Streets (CartoDB Voyager)
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      options = { maxZoom: 19, subdomains: 'abcd' };
    }

    tileLayerRef.current = L.tileLayer(tileUrl, options).addTo(map);
  }, [mapType]);

  // Update Map Markers on Pharmacies
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add Base Clinical Station Marker at 12.871773, 77.576856 (Brookes Haven / 80 Feet Road)
    const hospitalIconHtml = `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(45,106,79,0.25); animation: ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: relative; width: 34px; height: 34px; border-radius: 50%; background: #1A241C; border: 2.5px solid #52B788; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px rgba(82,183,136,0.7);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#52B788" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M2 12h20"/>
          </svg>
        </div>
        <div style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); white-space: nowrap; background: #1A241C; color: #52B788; font-size: 9px; font-weight: 800; font-family: monospace; padding: 1px 6px; border-radius: 4px; border: 1px solid #52B788; box-shadow: 0 2px 6px rgba(0,0,0,0.4); pointer-events: none;">
          80 FT RD • BROOKES HAVEN
        </div>
      </div>
    `;
    const hospitalIcon = L.divIcon({
      html: hospitalIconHtml,
      className: 'tactical-base-marker',
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });
    const hqMarker = L.marker([12.871773, 77.576856], { icon: hospitalIcon }).addTo(map);
    hqMarker.bindPopup(`
      <div style="font-family: monospace; font-size: 11px; color: #1A241C; padding: 2px;">
        <strong style="color: #2D6A4F; font-size: 12px;">[BASE] KSHITIJ CLINICAL DISPATCH HQ</strong><br/>
        <div style="color: #556558; margin-top: 2px;">80 Feet Road, Brookes Haven Layout, JP Nagar Phase 8</div>
        <div style="color: #2D6A4F; font-weight: bold; margin-top: 4px;">GPS Radar Focal Anchor (0.0 km)</div>
      </div>
    `);
    markersRef.current.push(hqMarker);

    // Add Medical Shop Markers with Distinctive Cross + Pill Badge Icons
    pharmacies.forEach(p => {
      const isSelected = selectedPharmacy && selectedPharmacy.id === p.id;
      const is24x7 = p.operating_hours?.toLowerCase().includes('24/7');
      const badgeBg = isSelected ? '#1B4332' : (is24x7 ? '#2D6A4F' : '#40534C');
      const badgeBorder = isSelected ? '#52B788' : (is24x7 ? '#74C69D' : '#95A5A6');
      const shortName = p.name.split('—')[0].replace('Pharmacy', 'Rx').replace('Chemist', 'Rx').trim();

      const markerHtml = `
        <div style="position: relative; cursor: pointer; display: flex; flex-direction: column; align-items: center;">
          <!-- Shop Name Tag on Top -->
          <div style="
            position: absolute;
            top: -20px;
            white-space: nowrap;
            background: #1A241C;
            color: ${isSelected ? '#52B788' : '#F7F4ED'};
            font-size: 9px;
            font-weight: 800;
            font-family: monospace;
            padding: 1px 6px;
            border-radius: 4px;
            border: 1px solid ${isSelected ? '#52B788' : 'rgba(255,255,255,0.2)'};
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            pointer-events: none;
          ">
            ${shortName}
          </div>

          <!-- Medical Cross Shop Badge -->
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: ${badgeBg};
            border: 2px solid ${badgeBorder};
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: ${isSelected ? '0 0 16px rgba(82,183,136,0.8), 0 4px 10px rgba(0,0,0,0.35)' : '0 3px 8px rgba(0,0,0,0.3)'};
            transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
            transition: all 0.2s ease;
          ">
            <!-- Medical Cross SVG -->
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>

          <!-- Bottom Pin Tip -->
          <div style="
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 6px solid ${badgeBorder};
            margin-top: -1px;
          "></div>
        </div>
      `;
      const icon = L.divIcon({
        html: markerHtml,
        className: 'tactical-pharmacy-marker',
        iconSize: [32, 44],
        iconAnchor: [16, 42]
      });

      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);
      marker.on('click', () => {
        setSelectedPharmacy(p);
      });
      marker.bindPopup(`
        <div style="font-family: monospace; font-size: 11px; color: #1A241C; min-width: 190px;">
          <div style="font-weight: 800; color: #2D6A4F; border-bottom: 1px solid #D5CEBF; padding-bottom: 4px; margin-bottom: 4px;">
            ${p.name}
          </div>
          <div style="color: #556558; font-size: 10px; margin-bottom: 4px;">${p.address}</div>
          <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 3px;">
            <span style="color: #1A241C;">Dist: ${p.distance_km} km</span>
            <span style="color: ${p.is_open ? '#2D6A4F' : '#DC2626'};">${p.is_open ? 'OPEN NOW' : 'CLOSED'}</span>
          </div>
          <div style="font-size: 10px; color: #556558;">
            Available SKUs: <strong>${p.inventory.length} medicines</strong>
          </div>
          <div style="font-size: 10px; color: #2D6A4F; margin-top: 2px;">
            ${p.operating_hours}
          </div>
        </div>
      `);
      markersRef.current.push(marker);
    });
  }, [pharmacies, selectedPharmacy]);

  return (
    <div className="space-y-5 pb-12 select-none font-mono">

      {/* ================= A. PHARMACY OPERATIONAL DASHBOARD ================= */}
      <div className="nm-flat rounded-2xl p-5 border border-white/[0.04] text-[#F8FAFC]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Header Title */}
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 nm-convex rounded-2xl text-[#FF334B] flex items-center justify-center">
                <Pill className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-sm md:text-base font-black tracking-wider text-[#F8FAFC] uppercase m-0">
                    PHARMACY STOCK &amp; AVAILABILITY DISCOVERY
                  </h1>
                  <span className="px-2 py-0.5 text-[9px] font-bold nm-inset rounded-md text-[#2D6A4F] border border-[#2D6A4F]/40">
                    LIVE SECTOR REGISTRY &bull; BROOKES HAVEN
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-1 m-0 font-medium">
                  Tactical medicine locator, multi-depot stock discovery, and direct-to-pharmacy emergency navigation
                </p>
              </div>
            </div>
          </div>

          {/* Operational Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="nm-flat rounded-xl p-3 border border-white/[0.03] min-w-[120px]">
              <div className="text-[9px] uppercase tracking-wider text-[#94A3B8] font-bold">
                Pharmacies In Sector
              </div>
              <div className="text-lg font-black text-[#F8FAFC] mt-1">
                {metrics.totalPharmacies}
              </div>
            </div>

            <div className="nm-flat rounded-xl p-3 border border-white/[0.03] min-w-[120px]">
              <div className="text-[9px] uppercase tracking-wider text-[#94A3B8] font-bold">
                Reporting Online
              </div>
              <div className="text-lg font-black text-[#F8FAFC] mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF334B] shadow-[0_0_6px_#FF334B] inline-block animate-pulse" />
                {metrics.reportingOnline} / {metrics.totalPharmacies}
              </div>
            </div>

            <div className="nm-flat rounded-xl p-3 border border-white/[0.03] min-w-[120px]">
              <div className="text-[9px] uppercase tracking-wider text-[#94A3B8] font-bold">
                Formulations
              </div>
              <div className="text-lg font-black text-[#F8FAFC] mt-1">
                {metrics.totalListings}
              </div>
            </div>

            <div className="nm-flat rounded-xl p-3 border border-[#FF334B]/30 min-w-[120px]">
              <div className="text-[9px] uppercase tracking-wider text-[#FF334B] font-bold">
                Urgent Priority
              </div>
              <div className="text-lg font-black text-[#FF334B] mt-1">
                {metrics.urgentRequests} STAT REQ
              </div>
            </div>
          </div>

        </div>

        {/* Global notification toast */}
        {notification && (
          <div className={`mt-4 p-3 text-xs rounded-xl flex items-center gap-2.5 ${
            notification.isError 
              ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40' 
              : 'nm-inset text-[#00E5A3] border border-[#00E5A3]/30'
          }`}>
            <Info className="w-4 h-4 text-[#FF334B] shrink-0" />
            <span className="font-bold">{notification.msg}</span>
          </div>
        )}
      </div>

      {/* ================= B. MEDICINE SEARCH & MULTI-ATTRIBUTE FILTERS ================= */}
      <div className="nm-flat rounded-2xl p-4 border border-white/[0.04] text-[#F8FAFC]">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          
          {/* Main search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Medicine (TXA, Norepinephrine), Generic Name, Ingredient, Strength (1000mg), Form (Injection, Tablet)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full nm-inset rounded-xl text-xs text-[#F8FAFC] placeholder-[#64748B] pl-10 pr-9 py-2.5 border-none focus:outline-none focus:ring-1 focus:ring-[#FF334B]/60 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#FF334B]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick preset search buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-[#94A3B8] uppercase font-bold shrink-0">STAT Presets:</span>
            {['Tranexamic Acid', 'Norepinephrine', 'Epinephrine', 'Morphine', 'Saline'].map((preset) => (
              <button
                key={preset}
                onClick={() => setSearchQuery(preset)}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all ${
                  searchQuery === preset 
                    ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40' 
                    : 'nm-btn text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

        </div>

        {/* Secondary Filters row */}
        <div className="mt-3.5 pt-3.5 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-3 text-xs">
          
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Distance Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold">Max Dist:</span>
              <select 
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(e.target.value)}
                className="nm-inset rounded-lg text-[#F8FAFC] text-[11px] px-2.5 py-1 border-none focus:outline-none"
              >
                <option value="ALL" className="bg-[#181B22]">All Radii (&lt;10 km)</option>
                <option value="1.5" className="bg-[#181B22]">&lt; 1.5 km (Immediate)</option>
                <option value="3.0" className="bg-[#181B22]">&lt; 3.0 km (Sector)</option>
                <option value="5.0" className="bg-[#181B22]">&lt; 5.0 km (Regional)</option>
              </select>
            </div>

            {/* Min Quantity Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold">Req Qty:</span>
              <select 
                value={qtyFilter}
                onChange={(e) => setQtyFilter(e.target.value)}
                className="nm-inset rounded-lg text-[#F8FAFC] text-[11px] px-2.5 py-1 border-none focus:outline-none"
              >
                <option value="ALL" className="bg-[#181B22]">Any Quantity</option>
                <option value="1" className="bg-[#181B22]">&gt;= 1 Unit</option>
                <option value="5" className="bg-[#181B22]">&gt;= 5 Units</option>
                <option value="10" className="bg-[#181B22]">&gt;= 10 Units</option>
                <option value="20" className="bg-[#181B22]">&gt;= 20 Units</option>
              </select>
            </div>

            {/* Stock Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold">Stock:</span>
              <select 
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="nm-inset rounded-lg text-[#F8FAFC] text-[11px] px-2.5 py-1 border-none focus:outline-none"
              >
                <option value="ALL" className="bg-[#181B22]">All Stock Levels</option>
                <option value="AVAILABLE" className="bg-[#181B22]">Available Only (&gt;Threshold)</option>
                <option value="LOW" className="bg-[#181B22]">Low Stock Warning</option>
                <option value="OUT" className="bg-[#181B22]">Out of Stock</option>
              </select>
            </div>

            {/* Open 24/7 Filter */}
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#94A3B8] hover:text-[#F8FAFC]">
              <input
                type="checkbox"
                checked={openOnlyFilter}
                onChange={(e) => setOpenOnlyFilter(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#FF334B] rounded"
              />
              <span>Open Facilities Only</span>
            </label>

            {/* Generics Filter */}
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#94A3B8] hover:text-[#F8FAFC]">
              <input
                type="checkbox"
                checked={genericOnlyFilter}
                onChange={(e) => setGenericOnlyFilter(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#FF334B] rounded"
              />
              <span>Verified Generics</span>
            </label>

          </div>

          {/* View toggle */}
          <div className="flex items-center nm-inset rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                viewMode === 'cards' 
                  ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40' 
                  : 'nm-btn text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              CARDS VIEW
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                viewMode === 'table' 
                  ? 'nm-alert-inset text-[#FF334B] border border-[#FF334B]/40' 
                  : 'nm-btn text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              DATA TABLE
            </button>
          </div>

        </div>

      </div>

      {/* ================= E. TACTICAL MAP DISCOVERY ZONE ================= */}
      <div className="nm-flat rounded-2xl p-4 border border-white/[0.04]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-[#FF334B]" />
            <span className="text-xs font-bold text-[#F8FAFC] tracking-wider uppercase">
              SECTOR PHARMACY RADAR MAP
            </span>
            <span className="text-[10px] text-[#94A3B8]">
              &bull; Center: [12.871773, 77.576856] &bull; 6 Tracked Depots
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {selectedPharmacy && (
              <div className="flex items-center gap-1.5 text-xs mr-2">
                <span className="text-[#94A3B8]">Selected:</span>
                <span className="text-[#FF334B] font-bold">{selectedPharmacy.name}</span>
                <button
                  onClick={() => setSelectedPharmacy(null)}
                  className="text-[#94A3B8] hover:text-[#F8FAFC] text-[10px] underline ml-1"
                >
                  Clear
                </button>
              </div>
            )}
            <div className="flex nm-inset rounded-xl p-1 text-[10px] font-bold gap-1">
              <button
                onClick={() => setMapType('google-roads')}
                className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'google-roads' ? 'nm-alert-inset text-[#2D6A4F] border border-[#2D6A4F]/40 font-black' : 'nm-btn text-[#7A8A7C]'}`}
                title="Google Maps Standard Roads"
              >
                MAP
              </button>
              <button
                onClick={() => setMapType('google-hybrid')}
                className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'google-hybrid' ? 'nm-alert-inset text-[#2D6A4F] border border-[#2D6A4F]/40 font-black' : 'nm-btn text-[#7A8A7C]'}`}
                title="Google Maps Satellite Hybrid"
              >
                SATELLITE
              </button>
              <button
                onClick={() => setMapType('google-terrain')}
                className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'google-terrain' ? 'nm-alert-inset text-[#2D6A4F] border border-[#2D6A4F]/40 font-black' : 'nm-btn text-[#7A8A7C]'}`}
                title="Google Maps Physical Terrain"
              >
                TERRAIN
              </button>
              <button
                onClick={() => setMapType('tactical-dark')}
                className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'tactical-dark' ? 'nm-alert-inset text-[#2D6A4F] border border-[#2D6A4F]/40 font-black' : 'nm-btn text-[#7A8A7C]'}`}
                title="Tactical Dark Mode"
              >
                DARK
              </button>
              <button
                onClick={() => setMapType('osm')}
                className={`px-2.5 py-1 rounded-lg transition-all ${mapType === 'osm' ? 'nm-alert-inset text-[#2D6A4F] border border-[#2D6A4F]/40 font-black' : 'nm-btn text-[#7A8A7C]'}`}
                title="OpenStreetMap Standard"
              >
                OSM
              </button>
            </div>
          </div>
        </div>

        <div 
          ref={mapContainerRef} 
          className="h-80 w-full rounded-xl overflow-hidden nm-inset border-none relative bg-[#EFECE6]" 
        />
        
        <div className="mt-3 flex items-center justify-between text-[10px] text-[#556558] flex-wrap gap-2 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A241C] border border-[#52B788] inline-block shadow-[0_0_6px_#52B788]" />
              <strong>Base Clinical Station (12.871773, 77.576856)</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#2D6A4F] inline-block shadow-[0_0_6px_#2D6A4F]" />
              <strong>24/7 Medical Shop</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#40534C] inline-block" />
              <strong>Day/Night Dispensary</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#1B4332] border border-[#52B788] inline-block shadow-[0_0_6px_#52B788]" />
              <strong>Active Selected Shop</strong>
            </span>
          </div>
          <span>Click any medical shop icon on 80 Feet Road to inspect stockpile and reserve emergency drugs.</span>
        </div>
      </div>

      {/* ================= C & D. PHARMACY STOCK LISTINGS & DIRECT ACTIONS ================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-[#94A3B8] px-1">
          <div className="flex items-center gap-2">
            <span className="font-black text-[#F8FAFC] uppercase">
              MATCHING INVENTORY ({flatMedicineListings.length})
            </span>
            {searchQuery && (
              <span>for query &quot;<span className="text-[#FF334B] font-bold">{searchQuery}</span>&quot;</span>
            )}
          </div>
          <span className="text-[10px]">
            Sorted by Sector Proximity &amp; Emergency Availability
          </span>
        </div>

        {flatMedicineListings.length === 0 ? (
          <div className="nm-flat rounded-2xl p-8 text-center text-[#94A3B8] border border-white/[0.04]">
            <AlertOctagon className="w-10 h-10 text-[#FF334B] mx-auto mb-2" />
            <div className="text-sm font-bold text-[#F8FAFC]">NO MEDICINES FOUND MATCHING FILTERS</div>
            <p className="text-xs mt-1">
              No verified pharmacy depot in the selected radius reported matching formulations for &quot;{searchQuery}&quot;.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setQtyFilter('ALL');
                setDistanceFilter('ALL');
                setStockStatusFilter('ALL');
                setOpenOnlyFilter(false);
                setGenericOnlyFilter(false);
              }}
              className="mt-4 px-4 py-2 nm-btn rounded-xl text-[#FF334B] text-xs font-bold hover:text-white transition-all"
            >
              RESET SEARCH FILTERS
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          
          /* CARDS VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flatMedicineListings.map(({ pharmacy, medicine, status }, idx) => {
              const isSelected = selectedPharmacy && selectedPharmacy.id === pharmacy.id;

              return (
                <div 
                  key={`${pharmacy.id}-${medicine.id}-${idx}`}
                  className={`p-4 rounded-2xl transition-all relative flex flex-col justify-between ${
                    isSelected 
                      ? 'nm-flat border border-[#FF334B]/50 shadow-[0_0_15px_rgba(255,51,75,0.15)]' 
                      : 'nm-flat hover:nm-convex border border-white/[0.03]'
                  }`}
                >
                  <div>
                    {/* Top row: Pharmacy Name & Distance */}
                    <div className="flex items-start justify-between gap-2 border-b border-white/[0.04] pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#FF334B] shrink-0" />
                          <h2 className="text-xs font-black text-[#F8FAFC] tracking-wide">
                            {pharmacy.name}
                          </h2>
                        </div>
                        <p className="text-[10px] text-[#A1A1AA] mt-0.5">
                          {pharmacy.address} &bull; <span className="text-[#F5F5F5]">{pharmacy.locality}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-[#FF2D3D]">
                          {pharmacy.distance_km} km
                        </div>
                        <div className="text-[9px] text-[#A1A1AA] uppercase">
                          {pharmacy.is_open ? 'OPEN NOW' : 'CLOSED'}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Medicine Details & Stock Badge */}
                    <div className="my-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-xs font-bold text-[#F5F5F5]">
                          {medicine.name}
                        </div>
                        <div className="text-[11px] text-[#A1A1AA]">
                          {medicine.strength} ({medicine.form})
                        </div>
                      </div>

                      <div className="text-[10px] text-[#A1A1AA] mt-0.5 flex items-center justify-between">
                        <span>Generic: {medicine.generic_name}</span>
                        <span>{medicine.price}</span>
                      </div>

                      {medicine.generic_alternative && (
                        <div className="text-[9px] text-[#71717A] mt-1 border-l-2 border-[#35353B] pl-1.5">
                          Alt: {medicine.generic_alternative}
                        </div>
                      )}

                      {/* Stock status indicator */}
                      <div className="mt-2.5 flex items-center justify-between p-2 bg-[#1C1C20] border border-[#35353B]">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-[#A1A1AA]">
                            Available Stock
                          </div>
                          <div className={`text-sm font-bold ${
                            status === 'OUT' 
                              ? 'text-[#71717A]' 
                              : status === 'LOW' 
                              ? 'text-[#FF2D3D]' 
                              : 'text-[#F5F5F5]'
                          }`}>
                            {medicine.stock} UNITS
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-[9px] px-1.5 py-0.5 border font-bold uppercase ${
                            status === 'OUT'
                              ? 'bg-[#141416] text-[#71717A] border-[#35353B]'
                              : status === 'LOW'
                              ? 'bg-[#350D13] text-[#FF2D3D] border-[#7F1D2D]'
                              : 'bg-[#1C1C20] text-[#F5F5F5] border-[#35353B]'
                          }`}>
                            {status === 'OUT' ? 'OUT OF STOCK' : status === 'LOW' ? 'LOW STOCK ALERT' : 'AVAILABLE'}
                          </span>
                          <div className="text-[8px] text-[#71717A] mt-1">
                            {medicine.last_updated} &bull; {pharmacy.is_verified ? 'VERIFIED' : 'UNCONFIRMED'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Direct Actions Toolbar */}
                  <div className="pt-2 border-t border-[#35353B] grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                    
                    {/* View Details */}
                    <button
                      onClick={() => setSelectedPharmacy(pharmacy)}
                      className="px-2 py-1.5 bg-[#1C1C20] hover:bg-[#35353B] text-[#F5F5F5] border border-[#35353B] font-bold flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-[#FF2D3D]" />
                      <span>DETAILS</span>
                    </button>

                    {/* Get Directions (External Google Maps URL) */}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1.5 bg-[#1C1C20] hover:bg-[#35353B] text-[#F5F5F5] border border-[#35353B] font-bold flex items-center justify-center gap-1"
                    >
                      <Navigation className="w-3 h-3 text-[#FF2D3D]" />
                      <span>NAVIGATE</span>
                    </a>

                    {/* Call Pharmacy (tel:) */}
                    <a
                      href={`tel:${pharmacy.phone}`}
                      className="px-2 py-1.5 bg-[#1C1C20] hover:bg-[#35353B] text-[#F5F5F5] border border-[#35353B] font-bold flex items-center justify-center gap-1"
                    >
                      <Phone className="w-3 h-3 text-[#FF2D3D]" />
                      <span>CALL</span>
                    </a>

                    {/* Check Availability */}
                    <button
                      onClick={() => handleCheckAvailability(pharmacy.id, medicine.id)}
                      className="px-2 py-1.5 bg-[#1C1C20] hover:bg-[#35353B] text-[#A1A1AA] hover:text-[#F5F5F5] border border-[#35353B] font-bold flex items-center justify-center gap-1"
                      title="Ping inventory telemetry"
                    >
                      <RefreshCw className="w-3 h-3 text-[#A1A1AA]" />
                      <span>CHECK</span>
                    </button>

                  </div>

                  {/* Reserve Button (Single full-width row for clear clinical intent) */}
                  <div className="mt-2">
                    <button
                      onClick={() => setReserveModalData({ pharmacy, medicine })}
                      disabled={medicine.stock === 0}
                      className={`w-full py-1.5 text-xs font-bold border flex items-center justify-center gap-1.5 transition-colors ${
                        medicine.stock === 0 
                          ? 'bg-[#141416] text-[#71717A] border-[#35353B] cursor-not-allowed' 
                          : 'bg-[#350D13] hover:bg-[#FF2D3D] text-[#FF2D3D] hover:text-[#0B0B0D] border-[#7F1D2D]'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>{medicine.stock === 0 ? 'STOCKOUT - CANNOT RESERVE' : 'RESERVE / REQUEST DISPATCH'}</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        ) : (

          /* DENSE DATA TABLE VIEW */
          <div className="bg-[#141416] border border-[#35353B] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#1C1C20] border-b border-[#35353B] text-[10px] text-[#A1A1AA] uppercase">
                  <th className="p-2.5 font-bold">Medicine / Strength</th>
                  <th className="p-2.5 font-bold">Form / Generic</th>
                  <th className="p-2.5 font-bold">Pharmacy Facility</th>
                  <th className="p-2.5 font-bold text-center">Distance</th>
                  <th className="p-2.5 font-bold text-center">Stock</th>
                  <th className="p-2.5 font-bold">Status / Updated</th>
                  <th className="p-2.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#35353B]">
                {flatMedicineListings.map(({ pharmacy, medicine, status }, idx) => (
                  <tr 
                    key={`tbl-${pharmacy.id}-${medicine.id}-${idx}`}
                    className="hover:bg-[#1C1C20] transition-colors"
                  >
                    <td className="p-2.5">
                      <div className="font-bold text-[#F5F5F5]">{medicine.name}</div>
                      <div className="text-[10px] text-[#A1A1AA]">{medicine.strength}</div>
                    </td>

                    <td className="p-2.5">
                      <div className="text-[#F5F5F5]">{medicine.form}</div>
                      <div className="text-[10px] text-[#A1A1AA]">{medicine.generic_name}</div>
                    </td>

                    <td className="p-2.5">
                      <div className="font-bold text-[#F5F5F5]">{pharmacy.name}</div>
                      <div className="text-[10px] text-[#A1A1AA]">{pharmacy.locality} &bull; {pharmacy.phone}</div>
                    </td>

                    <td className="p-2.5 text-center font-bold text-[#FF2D3D]">
                      {pharmacy.distance_km} km
                    </td>

                    <td className="p-2.5 text-center">
                      <span className={`font-bold ${
                        status === 'OUT' ? 'text-[#71717A]' : status === 'LOW' ? 'text-[#FF2D3D]' : 'text-[#F5F5F5]'
                      }`}>
                        {medicine.stock}
                      </span>
                    </td>

                    <td className="p-2.5">
                      <span className={`text-[9px] px-1.5 py-0.5 border font-bold uppercase inline-block ${
                        status === 'OUT'
                          ? 'bg-[#141416] text-[#71717A] border-[#35353B]'
                          : status === 'LOW'
                          ? 'bg-[#350D13] text-[#FF2D3D] border-[#7F1D2D]'
                          : 'bg-[#1C1C20] text-[#F5F5F5] border-[#35353B]'
                      }`}>
                        {status}
                      </span>
                      <div className="text-[9px] text-[#71717A] mt-0.5">
                        {medicine.last_updated}
                      </div>
                    </td>

                    <td className="p-2.5 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedPharmacy(pharmacy)}
                        className="px-2 py-1 bg-[#1C1C20] text-[#F5F5F5] border border-[#35353B] text-[10px] font-bold hover:bg-[#35353B]"
                      >
                        DETAILS
                      </button>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${pharmacy.lat},${pharmacy.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-[#1C1C20] text-[#F5F5F5] border border-[#35353B] text-[10px] font-bold hover:bg-[#35353B] inline-block"
                      >
                        NAV
                      </a>
                      <a
                        href={`tel:${pharmacy.phone}`}
                        className="px-2 py-1 bg-[#1C1C20] text-[#F5F5F5] border border-[#35353B] text-[10px] font-bold hover:bg-[#35353B] inline-block"
                      >
                        CALL
                      </a>
                      <button
                        onClick={() => setReserveModalData({ pharmacy, medicine })}
                        disabled={medicine.stock === 0}
                        className={`px-2 py-1 text-[10px] font-bold border inline-block ${
                          medicine.stock === 0 
                            ? 'bg-[#141416] text-[#71717A] border-[#35353B] cursor-not-allowed'
                            : 'bg-[#350D13] text-[#FF2D3D] border-[#7F1D2D] hover:bg-[#FF2D3D] hover:text-[#0B0B0D]'
                        }`}
                      >
                        RESERVE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        )}

      </div>

      {/* ================= F. PHARMACY DETAILS DRAWER ================= */}
      {selectedPharmacy && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-[#0B0B0D] border-l border-[#35353B] shadow-2xl z-50 p-5 overflow-y-auto flex flex-col justify-between">
          <div>
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#35353B] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#FF2D3D]" />
                <div>
                  <h3 className="text-sm font-bold text-[#F5F5F5] uppercase tracking-wider">
                    {selectedPharmacy.name}
                  </h3>
                  <div className="text-[10px] text-[#A1A1AA]">
                    FACILITY ID: {selectedPharmacy.id}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedPharmacy(null)}
                className="p-1 text-[#A1A1AA] hover:text-[#F5F5F5] border border-[#35353B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile info */}
            <div className="mt-4 space-y-2 text-xs">
              <div className="bg-[#141416] border border-[#35353B] p-3 space-y-1.5">
                <div className="flex items-start justify-between">
                  <span className="text-[#A1A1AA] text-[10px] uppercase">Address:</span>
                  <span className="text-[#F5F5F5] text-right font-medium">{selectedPharmacy.address}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA] text-[10px] uppercase">Locality / Sector:</span>
                  <span className="text-[#F5F5F5] font-bold">{selectedPharmacy.locality}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA] text-[10px] uppercase">Distance from Base:</span>
                  <span className="text-[#FF2D3D] font-bold">{selectedPharmacy.distance_km} km</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA] text-[10px] uppercase">Operating Hours:</span>
                  <span className="text-[#F5F5F5]">{selectedPharmacy.operating_hours}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA] text-[10px] uppercase">Network Telemetry:</span>
                  <span className="text-[#FF2D3D] font-mono">{selectedPharmacy.network_status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#A1A1AA] text-[10px] uppercase">Last Verified:</span>
                  <span className="text-[#A1A1AA] font-mono">{selectedPharmacy.verified_at}</span>
                </div>
              </div>

              {/* Direct Actions in Drawer */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPharmacy.lat},${selectedPharmacy.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 bg-[#1C1C20] hover:bg-[#35353B] text-[#F5F5F5] border border-[#35353B] text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Navigation className="w-4 h-4 text-[#FF2D3D]" />
                  <span>GET DIRECTIONS</span>
                </a>

                <a
                  href={`tel:${selectedPharmacy.phone}`}
                  className="py-2 px-3 bg-[#1C1C20] hover:bg-[#35353B] text-[#F5F5F5] border border-[#35353B] text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-4 h-4 text-[#FF2D3D]" />
                  <span>CALL {selectedPharmacy.phone}</span>
                </a>
              </div>

              {/* Stock Inventory List */}
              <div className="mt-4 pt-4 border-t border-[#35353B]">
                <div className="text-[11px] font-bold uppercase text-[#A1A1AA] mb-2 tracking-wider">
                  COMPLETE FACILITY INVENTORY ({selectedPharmacy.inventory.length} SKUs)
                </div>

                <div className="space-y-2">
                  {selectedPharmacy.inventory.map(med => (
                    <div 
                      key={med.id}
                      className="bg-[#141416] border border-[#35353B] p-2.5 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-[#F5F5F5]">{med.name}</div>
                        <div className="text-[10px] text-[#A1A1AA]">
                          {med.strength} &bull; {med.form} &bull; {med.price}
                        </div>
                        <div className="text-[9px] text-[#71717A] mt-0.5">
                          Batch: {med.batch} &bull; Exp: {med.expiry}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`font-bold ${
                          med.stock === 0 ? 'text-[#71717A]' : med.stock <= med.min_threshold ? 'text-[#FF2D3D]' : 'text-[#F5F5F5]'
                        }`}>
                          {med.stock} IN STOCK
                        </div>
                        <button
                          onClick={() => setReserveModalData({ pharmacy: selectedPharmacy, medicine: med })}
                          disabled={med.stock === 0}
                          className={`mt-1 px-2 py-0.5 text-[9px] font-bold border ${
                            med.stock === 0
                              ? 'bg-[#141416] text-[#71717A] border-[#35353B] cursor-not-allowed'
                              : 'bg-[#350D13] text-[#FF2D3D] border-[#7F1D2D] hover:bg-[#FF2D3D] hover:text-[#0B0B0D]'
                          }`}
                        >
                          RESERVE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

          <div className="mt-6 pt-3 border-t border-[#35353B] text-[10px] text-[#A1A1AA] flex items-center justify-between">
            <span className="text-[#52B788] font-bold">Live Clinical Telemetry Network &bull; 100% Operational</span>
            <button
              onClick={() => setSelectedPharmacy(null)}
              className="text-[#FF2D3D] font-bold uppercase"
            >
              CLOSE DRAWER
            </button>
          </div>
        </div>
      )}

      {/* ================= G. MEDICINE RESERVATION DIALOG ================= */}
      {reserveModalData && (
        <div className="fixed inset-0 bg-[#0B0B0D]/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[#141416] border border-[#FF2D3D] max-w-md w-full p-5 text-[#F5F5F5] shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-[#35353B] pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#FF2D3D]" />
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  STAGE EMERGENCY MEDICINE RESERVATION
                </h3>
              </div>
              <button 
                onClick={() => setReserveModalData(null)}
                className="text-[#A1A1AA] hover:text-[#F5F5F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteReservation} className="mt-4 space-y-3 text-xs">
              
              <div className="bg-[#1C1C20] border border-[#35353B] p-2.5 space-y-1">
                <div>
                  <span className="text-[#A1A1AA] text-[10px] uppercase">Medicine:</span>{' '}
                  <strong className="text-[#F5F5F5]">{reserveModalData.medicine.name}</strong> ({reserveModalData.medicine.strength})
                </div>
                <div>
                  <span className="text-[#A1A1AA] text-[10px] uppercase">Pharmacy Depot:</span>{' '}
                  <strong className="text-[#FF2D3D]">{reserveModalData.pharmacy.name}</strong>
                </div>
                <div>
                  <span className="text-[#A1A1AA] text-[10px] uppercase">Current Available Stock:</span>{' '}
                  <span className="font-bold">{reserveModalData.medicine.stock} units</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#A1A1AA] font-bold mb-1">
                  Required Quantity (Units):
                </label>
                <input
                  type="number"
                  min="1"
                  max={reserveModalData.medicine.stock}
                  value={reserveQty}
                  onChange={(e) => setReserveQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[#1C1C20] border border-[#35353B] text-[#F5F5F5] px-3 py-1.5 focus:outline-none focus:border-[#FF2D3D]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#A1A1AA] font-bold mb-1">
                  Dispatch Recipient / Target Unit:
                </label>
                <input
                  type="text"
                  value={reserveTarget}
                  onChange={(e) => setReserveTarget(e.target.value)}
                  className="w-full bg-[#1C1C20] border border-[#35353B] text-[#F5F5F5] px-3 py-1.5 focus:outline-none focus:border-[#FF2D3D]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#A1A1AA] font-bold mb-1">
                  Clinical Urgency Level:
                </label>
                <select
                  value={reservePriority}
                  onChange={(e) => setReservePriority(e.target.value)}
                  className="w-full bg-[#1C1C20] border border-[#35353B] text-[#F5F5F5] px-3 py-1.5 focus:outline-none focus:border-[#FF2D3D]"
                >
                  <option value="STAT_CRITICAL">STAT_CRITICAL (Trauma / Resuscitation)</option>
                  <option value="URGENT_1H">URGENT_1H (Priority Stabilization)</option>
                  <option value="ROUTINE">ROUTINE (Standard Replenishment)</option>
                </select>
              </div>

              <div className="p-2.5 bg-[#1B4332]/25 border border-[#2D6A4F]/50 text-[10px] text-[#52B788] space-y-1">
                <div className="font-bold uppercase flex items-center gap-1 text-[#2D6A4F]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2D6A4F]" />
                  <span>Clinical Stock Lock Protocol</span>
                </div>
                <div className="text-[#A1A1AA]">
                  This reservation stages an immediate clinical inventory lock on local stock. Electronic dispatch verification code is synced with the responding unit and registered pharmacy depot.
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReserveModalData(null)}
                  className="px-3 py-1.5 bg-[#1C1C20] text-[#A1A1AA] border border-[#35353B] font-bold hover:text-[#F5F5F5]"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#FF2D3D] text-[#0B0B0D] font-bold hover:bg-[#F5F5F5] transition-colors"
                >
                  CONFIRM RESERVATION
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
