# Tele-Rehab Pose Service

FastAPI service for real-time pose scoring and rehab exercise analysis.

## Setup

```bash
cd models
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

## Run

```bash
uvicorn app:app --port 8000 --reload
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/score` | Score from pre-extracted landmark frames |
| POST | `/score-from-video` | Server-side extraction + scoring (fallback) |
| WS | `/stream` | Real-time landmark frame scoring |

### POST `/score`

```json
{
  "landmarks": [
    {
      "timestamp": 0.033,
      "landmarks": [{ "x": 0.1, "y": 0.5, "z": -0.1, "visibility": 0.99 }, ...]
    }
  ],
  "exerciseConfig": {
    "name": "Knee Flexion",
    "targetJoint": "knee_left",
    "targetAngleMin": 90,
    "targetAngleMax": 140,
    "holdDurationSec": 2,
    "reps": 10,
    "sets": 3
  }
}
```

### POST `/score-from-video`

Multipart form:
- `video`: video file (mp4, mov, etc.)
- `exerciseConfig`: JSON string matching the schema above

### WebSocket `/stream`

1. Connect to `ws://localhost:8000/stream`
2. Send config: `{ "type": "config", "exerciseConfig": { ... } }`
3. Send frames: `{ "timestamp": 0.033, "landmarks": [...] }`
4. Receive live events: `{ "type": "good_form"|"form_warning", "message": "..." }`
5. End session: `{ "type": "end_session", "exerciseConfig": { ... } }`
6. Receive final: `{ "type": "session_complete", "repCount": 8, "overallScore": 82.5, ... }`

## Tests

```bash
pytest tests/ -v
```

## Supported Joints

- `knee_left` / `knee_right` — hip → knee → ankle
- `elbow_left` / `elbow_right` — shoulder → elbow → wrist
- `shoulder_abduction_left` / `shoulder_abduction_right` — hip → shoulder → elbow
- `hip_flexion_left` / `hip_flexion_right` — shoulder → hip → knee
