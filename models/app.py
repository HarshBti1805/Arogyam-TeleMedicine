"""
Tele-Rehab Pose Scoring Service — FastAPI, port 8000.

Endpoints:
  POST /score             — score landmark stream (on-device extraction path)
  POST /score-from-video  — extract landmarks server-side then score (fallback)
  WS   /stream            — real-time landmark frame scoring
  GET  /health
"""
from __future__ import annotations

import json
from typing import Any, Dict, List

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from pose.scorer import ScoringResult, score_session
from pose.mediapipe_runner import extract_landmarks_from_video

app = FastAPI(title="Tele-Rehab Pose Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response models ────────────────────────────────────────────────

class ScoreRequest(BaseModel):
    landmarks: List[Dict[str, Any]]   # list of LandmarkFrame dicts
    exerciseConfig: Dict[str, Any]


class ScoreResponse(BaseModel):
    repCount: int
    perRepScore: List[float]
    overallScore: float
    violations: List[str]
    compensationFlags: List[str]


def _result_to_response(r: ScoringResult) -> ScoreResponse:
    return ScoreResponse(
        repCount=r.rep_count,
        perRepScore=r.per_rep_score,
        overallScore=r.overall_score,
        violations=r.violations,
        compensationFlags=r.compensation_flags,
    )


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Tele-Rehab Pose Service"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/score", response_model=ScoreResponse)
def score(body: ScoreRequest):
    """
    Score a full session from pre-extracted landmark frames.
    body.landmarks: list of { timestamp, landmarks: [{x,y,z,visibility}] }
    """
    if not body.landmarks:
        raise HTTPException(status_code=400, detail="landmarks array is empty")
    result = score_session(body.landmarks, body.exerciseConfig)
    return _result_to_response(result)


@app.post("/score-from-video", response_model=ScoreResponse)
async def score_from_video(
    video: UploadFile = File(...),
    exerciseConfig: str = Form(...),
):
    """
    Fallback path: receive a video file, extract landmarks server-side with
    MediaPipe, then score.
    """
    try:
        config = json.loads(exerciseConfig)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="exerciseConfig must be valid JSON")

    video_bytes = await video.read()
    if not video_bytes:
        raise HTTPException(status_code=400, detail="Uploaded video is empty")

    try:
        frames = extract_landmarks_from_video(video_bytes)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video processing failed: {e}")

    if not frames:
        raise HTTPException(
            status_code=422,
            detail="No pose landmarks could be extracted from the video. "
                   "Ensure the subject is clearly visible.",
        )

    result = score_session(frames, config)
    return _result_to_response(result)


# ─── WebSocket streaming endpoint ────────────────────────────────────────────

@app.websocket("/stream")
async def stream_landmarks(ws: WebSocket):
    """
    Real-time scoring stream.

    Client sends JSON frames: { timestamp, landmarks: [...] }
    Server responds with live feedback events:
      { type: 'rep_complete'|'form_warning'|'good_form', message, currentRepScore? }

    Client sends { type: 'end_session', exerciseConfig: {...} } to finalize.
    """
    await ws.accept()

    frames: List[dict] = []
    exercise_config: dict = {}
    last_angle: float | None = None

    from pose.scorer import (
        _get_joint_angle, _landmark_from_dict, _resolve_joint,
        _detect_reps, _score_rep, JOINT_TRIPLETS,
    )

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("type") == "end_session":
                exercise_config = msg.get("exerciseConfig", exercise_config)
                result = score_session(frames, exercise_config)
                await ws.send_json({
                    "type": "session_complete",
                    "repCount": result.rep_count,
                    "perRepScore": result.per_rep_score,
                    "overallScore": result.overall_score,
                    "violations": result.violations,
                    "compensationFlags": result.compensation_flags,
                })
                break

            if msg.get("type") == "config":
                exercise_config = msg.get("exerciseConfig", {})
                continue

            # Regular landmark frame
            frames.append(msg)

            # Live per-frame feedback
            if exercise_config:
                joint = _resolve_joint(exercise_config.get("targetJoint", ""))
                lms = [_landmark_from_dict(lm) for lm in msg.get("landmarks", [])]
                angle = _get_joint_angle(lms, joint)

                if angle is not None:
                    angle_min = float(exercise_config.get("targetAngleMin", 0))
                    angle_max = float(exercise_config.get("targetAngleMax", 180))

                    if angle_min <= angle <= angle_max:
                        await ws.send_json({
                            "type": "good_form",
                            "message": f"Good form — angle {angle:.0f}°",
                        })
                    else:
                        direction = "more" if angle < angle_min else "less"
                        await ws.send_json({
                            "type": "form_warning",
                            "message": (
                                f"Adjust range — current {angle:.0f}°, "
                                f"target {angle_min:.0f}°–{angle_max:.0f}°. "
                                f"Bend {direction}."
                            ),
                        })
                    last_angle = angle

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
