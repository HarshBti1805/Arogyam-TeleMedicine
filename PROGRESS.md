# Telemedicine — Project Progress

> Last updated: April 2026
> 
> **MVP goal**: Tele-Rehab powered by an AI pose model. Everything below is the foundation that makes the MVP work.

---

## ✅ Done

### Infrastructure
- [x] Monorepo structure: `server/` (shared Express API), `website/` (Next.js doctor portal), `client/` (Expo patient app)
- [x] PostgreSQL via Neon, Prisma ORM, schema defined
- [x] CORS middleware on server, single shared backend — no backend code in Next.js or Expo
- [x] Environment variable strategy: `.env` (server), `.env.local` (website), `.env` (client with `EXPO_PUBLIC_*`)

### Auth (Patient + Doctor)
- [x] Patient signup: email + password, bcrypt hashed, `PatientProfile` created on registration
- [x] Doctor signup: email + password + license number + specialization
- [x] Doctor clinic/hospital location captured at registration via **interactive Leaflet map picker** (OpenStreetMap + Nominatim geocoding — no paid API key)
- [x] Login for both roles — returns user + profile, stored in `localStorage` (web) / `AsyncStorage` (mobile)
- [x] Terms-of-service checkbox with real state validation on patient registration

### Doctor Search & Map (Patient App)
- [x] Search doctors by **name**, **specialization**, **city**, or free-text query
- [x] **Nearby mode**: requests device GPS and filters by radius (default 25 km, haversine)
- [x] **List view**: doctor cards with name, specialty, clinic, experience, distance, first-free badge
- [x] **Map view**: `react-native-maps` MapView with custom doctor pins
- [x] **Routing**: tap a doctor pin → live route drawn via **OSRM** (free, no API key) with polyline, driving distance and ETA shown in an overlay card
- [x] Navigate to doctor detail screen from both list and map

### Doctor Detail & Appointment Booking (Patient App)
- [x] Full doctor profile screen: bio, clinic info, specialization, experience, fees
- [x] Mini-map showing doctor's clinic with route from patient's location
- [x] Distance + estimated travel time overlay on map
- [x] **First appointment free** — automatically detected per patient–doctor pair
- [x] Booking flow (bottom sheet modal):
  - Select appointment type: **Online** or **In-person**
  - Date & time picker (`@react-native-community/datetimepicker`)
  - Symptoms / reason + extra notes fields
  - Free badge shown if eligible
- [x] **PayPal payment** for paid appointments:
  - Opens PayPal transfer link in browser
  - Patient pastes back their transaction ID to confirm
  - Payment record updated in DB (`status: SUCCESS`)
  - "Pay later" option leaves appointment as PENDING

### Backend API (`server/`)
- [x] `POST /api/auth/register/patient` — patient registration
- [x] `POST /api/auth/register/doctor` — doctor registration with lat/lng
- [x] `POST /api/auth/login` — shared login with role hint
- [x] `GET /api/doctors` — multi-filter search (name, specialty, city, geo-sort)
- [x] `GET /api/doctors/nearby` — geo proximity search
- [x] `GET /api/doctors/:id` — doctor detail
- [x] `POST /api/appointments` — create appointment (auto-detects first-free)
- [x] `GET /api/appointments?patientId=|doctorId=` — list appointments
- [x] `GET /api/appointments/check-free?patientId=&doctorId=` — free check
- [x] `PATCH /api/appointments/:id/status` — update status
- [x] `PATCH /api/appointments/:id/payment` — record PayPal transaction

### Prisma Schema
- [x] `User`, `PatientProfile`, `DoctorProfile` with location fields
- [x] `Appointment` with `type` (ONLINE/ON_SITE), `isFree` flag
- [x] `Payment` with `method` and `transactionId` for PayPal tracking
- [x] `Message`, `MedicalRecord`, `Prescription` models in place

---

## 🔧 In Progress / Next Up

### Doctor Portal (website)
- [ ] Doctor dashboard: view upcoming appointments, patient list
- [ ] Appointment management: confirm / cancel / complete
- [ ] Set availability schedule (availability JSON editor)
- [ ] Add PayPal email to profile for receiving payments
- [ ] View patient medical records and prescriptions

### Patient App
- [ ] Appointments tab: list upcoming + past appointments, cancel, join call
- [ ] Profile tab: edit name, DOB, allergies, profile picture
- [ ] Video call screen (WebRTC) for online appointments
- [ ] Chat screen (WebSocket) between patient and doctor

### Auth & Session
- [ ] JWT or session token (replace raw user object in storage)
- [ ] Persistent auth check on app launch (redirect to login if expired)
- [ ] "Remember me" for doctor portal

---

## 🚀 MVP — Tele-Rehab (NEXT TO IMPLEMENT)

This is the **core product differentiator** and the primary MVP deliverable.

### What it is
An AI-powered rehabilitation monitoring system:
1. Patient performs prescribed physiotherapy exercises via the mobile camera
2. A **pose estimation model** (e.g. MediaPipe Pose / MoveNet) evaluates each frame
3. The model scores movement quality (range of motion, alignment, rep count)
4. Results are reported back to the doctor in real time

### Implementation plan
- [ ] **Pose model service** (`models/` Python service):
  - Integrate MediaPipe Pose or TensorFlow MoveNet
  - Accept video frame stream via WebSocket
  - Output: landmark coordinates, joint angles, per-rep score, session summary
- [ ] **Rehab plan creation** (doctor portal):
  - Doctor creates a rehab plan for a patient: exercise list, reps, sets, target range
  - Stored in new `RehabPlan` + `RehabExercise` Prisma models
- [ ] **Rehab session screen** (patient app):
  - Live camera feed with pose overlay (skeleton on screen)
  - Real-time feedback ("Straighten your back", "Good rep!")
  - Session summary on completion
- [ ] **Scoring & progress tracking**:
  - `RehabSession` records stored per session
  - Trend chart in patient profile and doctor dashboard
  - Auto-alert to doctor when score drops below threshold
- [ ] **WebSocket integration**:
  - Patient streams pose landmarks → model service → scores pushed back in real time
  - Doctor can optionally observe the session live

### Models folder (`models/`)
Currently contains placeholder model code. Priority order:
1. Pose estimation + scoring (Tele-Rehab MVP)
2. Wound/rash image detection
3. RAG report summarization

---

## 📋 Backlog (Post-MVP)

- [ ] Google Calendar integration for auto-booking + reminders
- [ ] Caller-agent orchestration (LLM-assisted scheduling)
- [ ] IoT watch ingestion (vitals, activity timeline)
- [ ] Prescription management (doctor writes, patient views)
- [ ] Push notifications (appointment reminders, session alerts)
- [ ] Offline queue for media uploads (poor connectivity)
- [ ] Multi-language patient support
- [ ] Admin analytics dashboard
- [ ] HIPAA-compliant audit logging for medical actions

---

## 🗺 Architecture Notes

```
client/ (Expo RN)  ─────────┐
                             │  HTTP  ──►  server/ (Express)  ──► PostgreSQL (Neon)
website/ (Next.js) ──────────┘           │
                                         ├──► /api/auth
                                         ├──► /api/doctors
                                         ├──► /api/appointments
                                         ├──► WebSocket (chat / rehab stream)
                                         └──► WebRTC signaling (video calls)

models/ (Python)  ◄──────── WebSocket ──── server/ ──── client/ camera frames
```

**Hard rule**: `server/` is the ONLY place that talks to the database. `website/` and `client/` are pure UI — they call `server/` over HTTP.
