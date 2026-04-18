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

## ✅ Done — Appointment Recording & AI Analysis (April 2026)

### Recording Flow
- [x] **Two-party consent UI** (mandatory) — `ConsentModal.tsx` shown before any recording starts; both patient and doctor must explicitly toggle consent
- [x] **In-person audio recording** — `AudioRecorder.tsx` using `expo-av` with live timer, pause/resume, stop controls
- [x] **Online video call** — `VideoCall.tsx` using `react-native-webrtc`, WebRTC signaling via server WebSocket
- [x] **Appointment detail screen** — `client/app/appointments/[id].tsx` shows recording or call button based on appointment type

### AI Analysis Pipeline (`server/src/services/analysisPipeline.ts`)
- [x] Audio/video upload via `POST /api/appointments/:id/recording` (multer, stored in `server/uploads/`)
- [x] **Whisper transcription** — `whisper-1` model, 3-retry with exponential back-off
- [x] **GPT-4o-mini structured analysis** — returns `{ summary, keyFindings[], suggestedExercises[], confidence }` in JSON mode
- [x] Transcript saved to `Transcript` model, analysis to `AIAnalysis` model
- [x] WebSocket events emitted: `recording.uploaded`, `transcription.complete`, `analysis.result.ready` — patient and doctor notified in real time

### Doctor Portal — Analysis & Plan Creation
- [x] `/appointments/[id]` — transcript viewer + AI analysis (summary, findings, suggested exercises), approve button
- [x] `/rehab/create` — plan builder pre-filled from AI suggestions; joint dropdown, angle sliders, reps/sets/hold config
- [x] `/rehab/plans/[id]` — plan detail with recharts `LineChart` of `overallScore` over time, alerts panel, session history
- [x] `/rehab/alerts` — all unacknowledged alerts with severity color coding and acknowledge action

---

## ✅ Done — Tele-Rehab MVP (April 2026)

### Prisma Schema — 7 New Models
- [x] `AppointmentRecording` (mediaType, consent flags, mediaUrl)
- [x] `Transcript` (rawText, segments JSON, language)
- [x] `AIAnalysis` (summary, keyFindings, suggestedExercises, confidence, doctorApproved)
- [x] `RehabPlan` (status enum, exercises relation, sessions relation, alerts relation)
- [x] `RehabExercise` (targetJoint, targetAngleMin/Max, holdDurationSec, reps, sets)
- [x] `RehabSession` (overallScore, repScores JSON, status enum)
- [x] `RehabAlert` (severity enum LOW/MEDIUM/HIGH, acknowledged)

### Python Pose Service (`models/`, port 8000)
- [x] `POST /score` — score from pre-extracted landmark frames (on-device path)
- [x] `POST /score-from-video` — extract landmarks server-side via MediaPipe Python, then score (active fallback)
- [x] `WebSocket /stream` — real-time per-frame feedback (`good_form`, `form_warning`, `rep_complete`)
- [x] `pose/scorer.py` — joint angle math (dot product + arccos), rep detection (peak detection on angle timeseries), compensation flagging
- [x] `pose/mediapipe_runner.py` — server-side frame extraction from video using `cv2` + `mediapipe`
- [x] pytest unit tests for all scorer functions

### Backend Rehab API (`server/src/routes/`)
- [x] `POST/GET/PATCH /api/rehab/plans` — plan CRUD with exercises
- [x] `POST /api/rehab/sessions`, `PATCH /api/rehab/sessions/:id/complete`
- [x] `GET /api/rehab/alerts`, `PATCH /api/rehab/alerts/:id/acknowledge`
- [x] `GET /api/media/:id` — range-request-capable media streaming
- [x] WebSocket events: `rehab.session.started`, `rehab.session.completed`, `rehab.alert.created`, `webrtc.signal`
- [x] Auto-create `RehabAlert` MEDIUM/HIGH when session score < 60/40

### WebSocket Server
- [x] `ws` package attached to existing HTTP server via upgrade event
- [x] Room-based broadcast: `broadcast(event, payload, roomId?)`
- [x] WebRTC signal relay via `webrtc.signal` event
- [x] Exponential backoff reconnect in `client/utils/wsClient.ts`

### Patient App — Rehab Tab
- [x] **Rehab tab** added to tab bar (`(home)/rehab.tsx`) — lists plans with progress %
- [x] **Plan detail** (`rehab/[planId].tsx`) — exercise cards with specs, "Start Session" per exercise
- [x] **Session screen** (`rehab/session/[sessionId].tsx`) — full-screen camera, live WS feedback overlay, rep counter

### Fallback & Error Handling
- [x] Pose service unreachable → records video, uploads via `/score-from-video`, shows "queued for review"
- [x] WS disconnect mid-session → `WsClient` reconnects with exponential backoff (1s→2s→4s, max 30s), queues pending frames
- [x] Transcription fails → retries 3× with back-off; doctor notified "Transcript pending"
- [x] LLM malformed response → placeholder "Analysis unavailable" saved
- [x] WebRTC fails → degrades to audio-only → chat fallback with toast notifications
- [x] Score below threshold → auto `RehabAlert` created and broadcast to doctor

### Shared Types
- [x] `server/src/types/rehab.ts` — `PoseLandmark`, `LandmarkFrame`, `ExerciseConfig`, `ScoringResult`, all DTOs
- [x] `server/src/types/analysis.ts` — `AIAnalysisDTO`, `SuggestedExerciseDTO`, `TranscriptSegment`, `LLMAnalysisResponse`

### Tests
- [x] `models/tests/test_scorer.py` — pytest for angle math, rep detection, session scoring
- [x] `server/src/__tests__/rehab.test.ts` — Jest integration tests for plan creation + session complete (7 passing)
- [x] `server/src/__tests__/analysisPipeline.test.ts` — pipeline happy path + malformed LLM response

---

## 🔧 In Progress / Next Up

### Doctor Portal (website)
- [ ] Doctor dashboard: view upcoming appointments, patient list
- [ ] Appointment management: confirm / cancel / complete
- [ ] Set availability schedule (availability JSON editor)
- [ ] Add PayPal email to profile for receiving payments
- [ ] View patient medical records and prescriptions

### Patient App
- [ ] Appointments tab: list upcoming + past appointments, cancel
- [ ] Profile tab: edit name, DOB, allergies, profile picture
- [ ] Chat screen (WebSocket) between patient and doctor

### Auth & Session
- [ ] JWT or session token (replace raw user object in storage)
- [ ] Persistent auth check on app launch (redirect to login if expired)
- [ ] "Remember me" for doctor portal

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
- [ ] On-device MediaPipe pose (see `PROTOTYPE_NOTES.md`)

---

## 🗺 Architecture Notes

```
client/ (Expo RN)  ─────────┐
                             │  HTTP  ──►  server/ (Express)  ──► PostgreSQL (Neon)
website/ (Next.js) ──────────┘           │
                                         ├──► /api/auth, /api/doctors, /api/appointments
                                         ├──► /api/appointments/:id/recording  (multer upload)
                                         ├──► /api/appointments/:id/analysis   (Whisper+GPT)
                                         ├──► /api/rehab/plans|sessions|alerts
                                         ├──► /api/media/:id                   (range streaming)
                                         ├──► WebSocket (rooms by appointmentId/planId/userId)
                                         └──► WebRTC signaling (webrtc.signal relay)

models/ (Python FastAPI :8000)
  ├──► POST /score              ◄── landmark frames from client
  ├──► POST /score-from-video   ◄── video file from server (fallback)
  └──► WS   /stream             ◄── real-time landmark frames → live feedback

Recording → Transcription → AI Analysis → Rehab Plan → Session → Alert
   (multer)    (Whisper)     (GPT-4o-mini)  (doctor)   (patient)  (auto)
```

**Hard rule**: `server/` is the ONLY place that talks to the database. `website/` and `client/` are pure UI — they call `server/` over HTTP.
