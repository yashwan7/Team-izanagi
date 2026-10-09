# Srihari Feature Module — KSHITIJ EMR

This folder contains all frontend and backend features developed by **Srihari** for the KSHITIJ EMR Tactical Bio-Capsule OS.

## Features Included

### Dashboard Modules (`dashboard/src/components/`)
| Module | File | Description |
|---|---|---|
| 🩸 Blood Bank & Transfusion Network | `BloodBankNetwork.jsx` | ISBT-128 inventory, cold-chain monitoring, 8 internal sub-tabs |
| 💊 Pharmaceutical Network | `PharmaceuticalNetwork.jsx` | Medicine finder, nearby pharmacies, batch/expiry tracking |
| 🚑 GPS Radar & Ambulance Dispatch | `TriageMap.jsx` | CAD system, live ambulance tracking, hospital routing |
| 🏥 Hospital Capacity | `HospitalCapacity.jsx` | Real-time bed/ICU/ventilator tracking |
| 🧑‍⚕️ Patients Registry | `PatientsRegistry.jsx` | Full patient directory and clinical records |
| ⚡ Triage Queue | `TriageQueue.jsx` | Harm-ranked priority queue |
| 📊 AI Reports | `AIReports.jsx` | Delay-aware clinical checklists and timeline synthesis |
| ⚙️ Settings & Lab | `Settings.jsx` | Hardware interfaces, failover thresholds, DSP parameters |
| 🖥️ Overview | `ClinicalOverview.jsx` | Mission control dashboard overview |

### Backend (`backend/merge_engine/`)
- **Offline Sync & Merge Engine** — deduplication, conflict resolution
- **FastAPI Triage Service** — priority scoring, delay-aware clinical protocols
- **Blood Bank API** — `/api/bloodbank` endpoint
- **Pharmacy API** — `/api/pharmacy` endpoint
- **Ambulance Dispatch API** — `/api/dispatch` endpoint

## Tech Stack
- **Frontend**: React + Vite + Tailwind + Lucide + Leaflet
- **Backend**: FastAPI + Python
- **Theme**: Tactical dark UI — black, charcoal grey, red accents, sharp square corners

## Running Locally
```bash
# Backend
cd backend && source venv/bin/activate
uvicorn merge_engine.service:app --host 127.0.0.1 --port 8000 --reload

# Frontend
cd dashboard && npm install && npm run dev
```
