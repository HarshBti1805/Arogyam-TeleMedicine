"""
Server-side MediaPipe pose extraction from an uploaded video file.
Used as fallback when on-device extraction fails.
"""
from __future__ import annotations

import tempfile
import os
from typing import List

try:
    import mediapipe as mp
    import cv2
    _MEDIAPIPE_AVAILABLE = True
except ImportError:
    _MEDIAPIPE_AVAILABLE = False


def extract_landmarks_from_video(video_bytes: bytes) -> List[dict]:
    """
    Run MediaPipe Pose on every frame of a video and return landmark frames.
    Returns list of { timestamp, landmarks: [{x,y,z,visibility}] }
    """
    if not _MEDIAPIPE_AVAILABLE:
        raise RuntimeError(
            "mediapipe and opencv-python are required for server-side extraction. "
            "Install them: pip install mediapipe opencv-python"
        )

    # Write bytes to a temp file so cv2 can open it
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = tmp.name

    frames: List[dict] = []
    try:
        mp_pose = mp.solutions.pose
        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

        with mp_pose.Pose(
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as pose:
            frame_idx = 0
            while cap.isOpened():
                success, image = cap.read()
                if not success:
                    break
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                results = pose.process(image_rgb)
                if results.pose_world_landmarks:
                    landmarks = [
                        {
                            "x": lm.x,
                            "y": lm.y,
                            "z": lm.z,
                            "visibility": lm.visibility,
                        }
                        for lm in results.pose_world_landmarks.landmark
                    ]
                    frames.append(
                        {"timestamp": frame_idx / fps, "landmarks": landmarks}
                    )
                frame_idx += 1
        cap.release()
    finally:
        os.unlink(tmp_path)

    return frames
