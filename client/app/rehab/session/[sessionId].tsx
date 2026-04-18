/**
 * Rehab Session Screen
 *
 * Primary path: expo-camera captures live video, MediaPipe Tasks runs on-device
 * (via future native module). Currently wired to the fallback path where the
 * full session is recorded as video and uploaded to POST /score-from-video.
 * See PROTOTYPE_NOTES.md for details.
 *
 * Fallback path (active for prototype):
 *  - Record session as video using expo-camera
 *  - Upload to /score-from-video on session end
 *  - Show "Session queued for review" while scoring
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WsClient } from "@/utils/wsClient";
import { rehabApi, RehabExercise } from "@/utils/rehabApi";

const POSE_WS_URL =
  process.env.EXPO_PUBLIC_POSE_WS_URL ?? "ws://localhost:8000/stream";

type Phase = "permission" | "ready" | "recording" | "uploading" | "done" | "error";

export default function SessionScreen() {
  const { sessionId, exerciseId, planId } = useLocalSearchParams<{
    sessionId: string;
    exerciseId: string;
    planId: string;
  }>();
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("permission");
  const [exercise, setExercise] = useState<RehabExercise | null>(null);
  const [feedback, setFeedback] = useState("Initializing…");
  const [repCount, setRepCount] = useState(0);
  const [scoreResult, setScoreResult] = useState<{
    overallScore: number;
    repCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const cameraRef = useRef<CameraView | null>(null);
  const poseWsRef = useRef<WsClient | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<any>(null);

  // Fetch exercise config
  useEffect(() => {
    rehabApi
      .getPlan(planId)
      .then(({ plan }) => {
        const ex = plan.exercises.find((e) => e.id === exerciseId);
        if (ex) setExercise(ex);
      })
      .catch(() => {});
  }, [planId, exerciseId]);

  // Handle permissions
  useEffect(() => {
    if (!permission) return;
    if (permission.granted) {
      setPhase("ready");
    } else if (!permission.canAskAgain) {
      setPhase("error");
      setError("Camera permission denied. Cannot run session.");
    }
  }, [permission]);

  const requestCameraPermission = async () => {
    const result = await requestPermission();
    if (result.granted) setPhase("ready");
    else {
      // Fallback to video-upload path without live camera
      setError("Camera permission denied — switching to video-only mode.");
      setPhase("ready"); // Still allow starting (will record if possible)
    }
  };

  // Connect to pose WebSocket
  const connectPoseWs = useCallback(() => {
    if (!exercise) return;

    const ws = new WsClient({
      roomId: undefined,
      onOpen: () => setFeedback("Connected — start your exercise!"),
      onClose: () => setFeedback("Pose service disconnected — recording locally."),
    });

    // Override URL to pose service
    // WsClient connects to the server WS; for pose we use a direct WS
    // This is done via a raw WebSocket instead of WsClient for pose service
    const poseWs = new WebSocket(POSE_WS_URL);
    poseWs.onopen = () => {
      poseWs.send(
        JSON.stringify({ type: "config", exerciseConfig: exercise })
      );
      setFeedback("Pose service connected — start your exercise!");
    };
    poseWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "good_form" || msg.type === "form_warning") {
          setFeedback(msg.message);
        }
        if (msg.type === "rep_complete") {
          setRepCount((n) => n + 1);
          if (msg.currentRepScore !== undefined) {
            setFeedback(`Rep ${repCount + 1} — score: ${msg.currentRepScore.toFixed(0)}`);
          }
        }
        if (msg.type === "session_complete") {
          setScoreResult({
            overallScore: msg.overallScore,
            repCount: msg.repCount,
          });
        }
      } catch {}
    };
    poseWs.onclose = () => {
      setFeedback("Pose service disconnected — continuing in local mode.");
    };
    poseWs.onerror = () => {
      setFeedback("Pose service unavailable — session recorded locally.");
    };

    (poseWsRef as any).current = { poseWs, ws };
    return poseWs;
  }, [exercise, repCount]);

  const startRecording = async () => {
    if (!cameraRef.current || !exercise) return;
    setPhase("recording");
    setRepCount(0);
    setFeedback("Recording — perform your exercise.");

    // Start timer
    timerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);

    // Try to connect pose WS (fire-and-forget — session continues even if unavailable)
    let poseWs: WebSocket | null = null;
    try {
      poseWs = connectPoseWs() ?? null;
    } catch {}

    // Start video recording
    try {
      const recording = await cameraRef.current.recordAsync({ maxDuration: 600 });
      recordingRef.current = recording;
    } catch (e: any) {
      setError(`Recording failed: ${e.message}`);
      setPhase("error");
    }

    // Close pose WS after recording ends
    if (poseWs && poseWs.readyState === WebSocket.OPEN) {
      poseWs.send(JSON.stringify({ type: "end_session", exerciseConfig: exercise }));
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    cameraRef.current?.stopRecording();
    setPhase("uploading");
    setFeedback("Processing session…");
  };

  // After recording stops, upload video for server-side scoring (fallback path)
  useEffect(() => {
    if (phase !== "uploading" || !recordingRef.current || !exercise) return;

    const uploadAndScore = async () => {
      try {
        const videoUri = recordingRef.current.uri;
        const scoreData = await rehabApi.uploadVideoForScoring(videoUri, exercise);

        // Complete the session with scores
        await rehabApi.completeSession(sessionId, {
          repScores: scoreData.perRepScore ?? [],
          overallScore: scoreData.overallScore ?? 0,
          feedbackNotes: [
            ...(scoreData.violations ?? []),
            ...(scoreData.compensationFlags ?? []),
          ].join("; "),
        });

        setScoreResult({
          overallScore: scoreData.overallScore,
          repCount: scoreData.repCount,
        });
        setPhase("done");
      } catch (e: any) {
        // Pose service unavailable — still complete the session with 0 score
        // and show "queued for review" messaging
        try {
          await rehabApi.completeSession(sessionId, {
            repScores: [],
            overallScore: 0,
            feedbackNotes: "Session queued for review — pose service unavailable.",
          });
        } catch {}
        setFeedback("Your session has been recorded and queued for review.");
        setPhase("done");
      }
    };

    uploadAndScore();
  }, [phase, exercise, sessionId]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (phase === "permission") {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Camera Permission Required</Text>
        <Text style={styles.subtitle}>
          We need camera access to record your exercise session for scoring.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={requestCameraPermission}>
          <Text style={styles.primaryBtnText}>Grant Permission</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: "#6b7280" }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "done") {
    return (
      <View style={styles.centered}>
        <Text style={styles.doneIcon}>✓</Text>
        <Text style={styles.title}>Session Complete</Text>
        {scoreResult ? (
          <>
            <Text style={styles.scoreText}>
              Score: {scoreResult.overallScore.toFixed(1)} / 100
            </Text>
            <Text style={styles.repText}>
              {scoreResult.repCount} reps detected
            </Text>
          </>
        ) : (
          <Text style={styles.subtitle}>{feedback}</Text>
        )}
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push(`/rehab/${planId}`)}
        >
          <Text style={styles.primaryBtnText}>Back to Plan</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "error") {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "An error occurred."}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: "#3b82f6" }}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        mode="video"
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.topBar}>
          {exercise && (
            <Text style={styles.exerciseNameOverlay} numberOfLines={1}>
              {exercise.name}
            </Text>
          )}
          {phase === "recording" && (
            <View style={styles.recIndicator}>
              <View style={styles.recDot} />
              <Text style={styles.recTime}>{formatDuration(recordingDuration)}</Text>
            </View>
          )}
        </View>

        {/* Feedback */}
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackText}>{feedback}</Text>
          {phase === "recording" && repCount > 0 && (
            <Text style={styles.repCount}>{repCount} reps</Text>
          )}
        </View>

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          {phase === "uploading" ? (
            <View style={styles.uploadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.uploadingText}>Processing…</Text>
            </View>
          ) : phase === "recording" ? (
            <Pressable style={styles.stopBtn} onPress={stopRecording}>
              <View style={styles.stopSquare} />
              <Text style={styles.btnLabel}>Stop</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.recordBtn} onPress={startRecording}>
              <View style={styles.recordCircle} />
              <Text style={styles.btnLabel}>Start</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.back()}
            style={styles.cancelBtn}
          >
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: "#f9fafb" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", marginTop: 8 },
  primaryBtn: { marginTop: 24, backgroundColor: "#3b82f6", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  doneIcon: { fontSize: 56, marginBottom: 8 },
  scoreText: { fontSize: 32, fontWeight: "800", color: "#3b82f6", marginTop: 8 },
  repText: { fontSize: 16, color: "#6b7280", marginTop: 4 },
  errorText: { fontSize: 16, color: "#dc2626", textAlign: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 56,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingBottom: 12,
  },
  exerciseNameOverlay: { color: "#fff", fontSize: 16, fontWeight: "600", flex: 1, marginRight: 12 },
  recIndicator: { flexDirection: "row", alignItems: "center", gap: 6 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  recTime: { color: "#fff", fontSize: 14, fontWeight: "600" },
  feedbackContainer: {
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxWidth: "85%",
    alignItems: "center",
  },
  feedbackText: { color: "#fff", fontSize: 15, textAlign: "center" },
  repCount: { color: "#60a5fa", fontSize: 24, fontWeight: "800", marginTop: 4 },
  bottomBar: {
    paddingBottom: 48,
    paddingHorizontal: 32,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingTop: 20,
  },
  recordBtn: { alignItems: "center", gap: 6 },
  recordCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#ef4444", borderWidth: 4, borderColor: "#fff" },
  stopBtn: { alignItems: "center", gap: 6 },
  stopSquare: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#ef4444", borderWidth: 4, borderColor: "#fff" },
  btnLabel: { color: "#fff", fontSize: 13, fontWeight: "600" },
  cancelBtn: { marginTop: 16 },
  uploadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  uploadingText: { color: "#fff", fontSize: 15 },
});
