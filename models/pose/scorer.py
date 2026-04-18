"""
Joint angle math, rep detection, and compensation flagging for rehab scoring.
All math operates on MediaPipe 33-landmark world coordinate frames (meters, 3D).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List, Optional

# MediaPipe landmark indices (world landmarks)
LANDMARK_INDEX = {
    "nose": 0,
    "left_shoulder": 11, "right_shoulder": 12,
    "left_elbow": 13,    "right_elbow": 14,
    "left_wrist": 15,    "right_wrist": 16,
    "left_hip": 23,      "right_hip": 24,
    "left_knee": 25,     "right_knee": 26,
    "left_ankle": 27,    "right_ankle": 28,
}

# Joint definitions: (proximal, vertex, distal)
JOINT_TRIPLETS = {
    "knee_left":  ("left_hip",      "left_knee",     "left_ankle"),
    "knee_right": ("right_hip",     "right_knee",    "right_ankle"),
    "elbow_left": ("left_shoulder", "left_elbow",    "left_wrist"),
    "elbow_right":("right_shoulder","right_elbow",   "right_wrist"),
    "shoulder_abduction_left":  ("left_hip",  "left_shoulder",  "left_elbow"),
    "shoulder_abduction_right": ("right_hip", "right_shoulder", "right_elbow"),
    "hip_flexion_left":  ("left_shoulder",  "left_hip",  "left_knee"),
    "hip_flexion_right": ("right_shoulder", "right_hip", "right_knee"),
}

# Non-target landmarks that indicate compensation when they move excessively
COMPENSATION_PAIRS = {
    "shoulder_abduction_left":  ["left_hip", "right_hip"],
    "shoulder_abduction_right": ["left_hip", "right_hip"],
    "knee_left":                ["left_shoulder", "right_shoulder"],
    "knee_right":               ["left_shoulder", "right_shoulder"],
    "elbow_left":               ["left_shoulder"],
    "elbow_right":              ["right_shoulder"],
}


@dataclass
class Landmark:
    x: float
    y: float
    z: float
    visibility: float = 1.0


@dataclass
class ScoringResult:
    rep_count: int
    per_rep_score: List[float]
    overall_score: float          # 0-100
    violations: List[str]
    compensation_flags: List[str]


def _angle_3d(a: Landmark, b: Landmark, c: Landmark) -> float:
    """Compute angle at vertex b formed by rays b→a and b→c (degrees)."""
    ba = (a.x - b.x, a.y - b.y, a.z - b.z)
    bc = (c.x - b.x, c.y - b.y, c.z - b.z)
    dot = sum(ba[i] * bc[i] for i in range(3))
    mag_ba = math.sqrt(sum(v ** 2 for v in ba))
    mag_bc = math.sqrt(sum(v ** 2 for v in bc))
    if mag_ba < 1e-6 or mag_bc < 1e-6:
        return 0.0
    cos_angle = max(-1.0, min(1.0, dot / (mag_ba * mag_bc)))
    return math.degrees(math.acos(cos_angle))


def _landmark_from_dict(d: dict) -> Landmark:
    return Landmark(
        x=float(d["x"]),
        y=float(d["y"]),
        z=float(d["z"]),
        visibility=float(d.get("visibility", 1.0)),
    )


def _get_joint_angle(landmarks: List[Landmark], joint: str) -> Optional[float]:
    triplet = JOINT_TRIPLETS.get(joint)
    if not triplet:
        return None
    try:
        a = landmarks[LANDMARK_INDEX[triplet[0]]]
        b = landmarks[LANDMARK_INDEX[triplet[1]]]
        c = landmarks[LANDMARK_INDEX[triplet[2]]]
        # Skip if any landmark has low visibility
        if min(a.visibility, b.visibility, c.visibility) < 0.5:
            return None
        return _angle_3d(a, b, c)
    except (KeyError, IndexError):
        return None


def _resolve_joint(target_joint: str) -> str:
    """Map generic names (e.g. 'knee') to a canonical joint key."""
    target = target_joint.lower().replace(" ", "_")
    # Exact match first
    if target in JOINT_TRIPLETS:
        return target
    # Prefix match — prefer left side for prototypes
    for key in JOINT_TRIPLETS:
        if key.startswith(target):
            return key
    return target


def _detect_reps(
    angles: List[float],
    angle_min: float,
    angle_max: float,
    hold_duration_sec: float,
    fps: float = 30.0,
) -> List[tuple]:
    """
    Simple peak-valley rep detector.
    A rep is counted when the angle crosses below angle_min, stays there for
    hold_duration_sec, then returns above angle_max (or vice-versa depending
    on exercise direction).
    Returns list of (start_frame, end_frame) tuples.
    """
    hold_frames = max(1, int(hold_duration_sec * fps))
    midpoint = (angle_min + angle_max) / 2
    reps: List[tuple] = []
    in_rep = False
    hold_counter = 0
    rep_start = 0

    for i, angle in enumerate(angles):
        in_range = angle_min <= angle <= angle_max
        if not in_rep and in_range:
            in_rep = True
            rep_start = i
            hold_counter = 1
        elif in_rep and in_range:
            hold_counter += 1
            if hold_counter >= hold_frames and angle > midpoint:
                reps.append((rep_start, i))
                in_rep = False
                hold_counter = 0
        elif in_rep and not in_range:
            if hold_counter >= hold_frames:
                reps.append((rep_start, i - 1))
            in_rep = False
            hold_counter = 0

    return reps


def _score_rep(
    angles: List[float],
    start: int,
    end: int,
    angle_min: float,
    angle_max: float,
    hold_duration_sec: float,
    fps: float = 30.0,
) -> float:
    """Score a single rep 0-100 based on ROM coverage and hold time."""
    segment = angles[start : end + 1]
    if not segment:
        return 0.0

    # ROM score: what fraction of the target range was achieved
    achieved_min = min(segment)
    achieved_max = max(segment)
    target_range = max(angle_max - angle_min, 1.0)
    achieved_range = achieved_max - achieved_min
    rom_score = min(100.0, (achieved_range / target_range) * 100.0)

    # Hold score: how long the joint stayed inside the target band
    in_range = [1 for a in segment if angle_min <= a <= angle_max]
    hold_achieved = len(in_range) / fps
    hold_score = min(100.0, (hold_achieved / max(hold_duration_sec, 0.1)) * 100.0)

    return round(rom_score * 0.6 + hold_score * 0.4, 1)


def _detect_compensation(
    frames: List[List[Landmark]],
    joint: str,
    threshold_m: float = 0.05,
) -> List[str]:
    """
    Flag compensation by detecting excessive movement in non-target landmarks.
    threshold_m: max allowed displacement (metres) from first-frame baseline.
    """
    flags: List[str] = []
    watch_names = COMPENSATION_PAIRS.get(joint, [])
    if not frames or not watch_names:
        return flags

    baseline = frames[0]
    for lm_name in watch_names:
        idx = LANDMARK_INDEX.get(lm_name)
        if idx is None:
            continue
        displacements = []
        for frame in frames[1:]:
            try:
                bl = baseline[idx]
                curr = frame[idx]
                d = math.sqrt(
                    (curr.x - bl.x) ** 2
                    + (curr.y - bl.y) ** 2
                    + (curr.z - bl.z) ** 2
                )
                displacements.append(d)
            except IndexError:
                continue
        if displacements and max(displacements) > threshold_m:
            flags.append(
                f"Excessive movement detected at {lm_name.replace('_', ' ')} "
                f"(max {max(displacements)*100:.1f} cm displacement)"
            )
    return flags


def score_session(
    frames: List[dict],
    exercise_config: dict,
) -> ScoringResult:
    """
    Main entry point — scores a full session from raw landmark frames.

    frames: list of { timestamp: float, landmarks: [ {x,y,z,visibility}, ...] }
    exercise_config: { targetJoint, targetAngleMin, targetAngleMax,
                       holdDurationSec, reps, sets, name }
    """
    if not frames:
        return ScoringResult(0, [], 0.0, ["No landmark frames received"], [])

    joint = _resolve_joint(exercise_config.get("targetJoint", ""))
    angle_min = float(exercise_config.get("targetAngleMin", 0))
    angle_max = float(exercise_config.get("targetAngleMax", 180))
    hold_sec = float(exercise_config.get("holdDurationSec", 1))

    # Parse all frames
    lm_frames: List[List[Landmark]] = []
    for f in frames:
        lms_raw = f.get("landmarks", [])
        lm_frames.append([_landmark_from_dict(lm) for lm in lms_raw])

    # Extract angle timeseries
    angles: List[float] = []
    for lm_list in lm_frames:
        angle = _get_joint_angle(lm_list, joint)
        if angle is not None:
            angles.append(angle)
        else:
            angles.append(angles[-1] if angles else (angle_min + angle_max) / 2)

    violations: List[str] = []

    # Check for very low visibility (bad tracking)
    low_vis_count = sum(
        1 for f in lm_frames
        if any(lm.visibility < 0.3 for lm in f[:25])
    )
    if low_vis_count > len(lm_frames) * 0.2:
        violations.append(
            f"Poor pose visibility in {low_vis_count}/{len(lm_frames)} frames — "
            "ensure full body is visible."
        )

    # Detect reps
    fps = 30.0
    if len(frames) >= 2:
        duration = frames[-1]["timestamp"] - frames[0]["timestamp"]
        if duration > 0:
            fps = len(frames) / duration

    rep_ranges = _detect_reps(angles, angle_min, angle_max, hold_sec, fps)
    per_rep_scores = [
        _score_rep(angles, s, e, angle_min, angle_max, hold_sec, fps)
        for s, e in rep_ranges
    ]

    expected_reps = int(exercise_config.get("reps", 1)) * int(
        exercise_config.get("sets", 1)
    )
    if len(per_rep_scores) < expected_reps:
        violations.append(
            f"Only {len(per_rep_scores)} of {expected_reps} expected reps detected."
        )

    overall = round(sum(per_rep_scores) / max(len(per_rep_scores), 1), 1)
    compensation_flags = _detect_compensation(lm_frames, joint)

    return ScoringResult(
        rep_count=len(per_rep_scores),
        per_rep_score=per_rep_scores,
        overall_score=overall,
        violations=violations,
        compensation_flags=compensation_flags,
    )
