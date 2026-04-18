/**
 * Rehab Session Screen
 *
 * Primary path: expo-camera captures live video, MediaPipe Tasks runs on-device
 * (via future native module). Currently wired to the fallback path where the
 * full session is recorded as video and uploaded to POST /score-from-video.
 * See PROTOTYPE_NOTES.md for details.
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
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import FontAwesome from "@expo/vector-icons/FontAwesome";
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
  const poseWsRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<any>(null);

  useEffect(() => {
    rehabApi
      .getPlan(planId)
      .then(({ plan }) => {
        const ex = plan.exercises.find((e) => e.id === exerciseId);
        if (ex) setExercise(ex);
      })
      .catch(() => {});
  }, [planId, exerciseId]);

  useEffect(() => {
    if (!permission) return;
    if (permission.granted) setPhase("ready");
    else if (!permission.canAskAgain) {
      setPhase("error");
      setError("Camera permission denied. Cannot run session.");
    }
  }, [permission]);

  const requestCameraPermission = async () => {
    const result = await requestPermission();
    if (result.granted) setPhase("ready");
    else {
      setError("Camera permission denied — switching to video-only mode.");
      setPhase("ready");
    }
  };

  const connectPoseWs = useCallback(() => {
    if (!exercise) return null;
    const poseWs = new WebSocket(POSE_WS_URL);
    poseWs.onopen = () => {
      poseWs.send(JSON.stringify({ type: "config", exerciseConfig: exercise }));
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
          setScoreResult({ overallScore: msg.overallScore, repCount: msg.repCount });
        }
      } catch {}
    };
    poseWs.onclose = () => setFeedback("Pose service disconnected — continuing locally.");
    poseWs.onerror = () => setFeedback("Pose service unavailable — recording locally.");
    poseWsRef.current = poseWs;
    return poseWs;
  }, [exercise, repCount]);

  const startRecording = async () => {
    if (!cameraRef.current || !exercise) return;
    setPhase("recording");
    setRepCount(0);
    setFeedback("Recording — perform your exercise.");
    timerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    let poseWs: WebSocket | null = null;
    try { poseWs = connectPoseWs(); } catch {}
    try {
      const recording = await cameraRef.current.recordAsync({ maxDuration: 600 });
      recordingRef.current = recording;
    } catch (e: any) {
      setError(`Recording failed: ${e.message}`);
      setPhase("error");
    }
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

  useEffect(() => {
    if (phase !== "uploading" || !recordingRef.current || !exercise) return;
    const uploadAndScore = async () => {
      try {
        const videoUri = recordingRef.current.uri;
        const scoreData = await rehabApi.uploadVideoForScoring(videoUri, exercise);
        await rehabApi.completeSession(sessionId, {
          repScores: scoreData.perRepScore ?? [],
          overallScore: scoreData.overallScore ?? 0,
          feedbackNotes: [
            ...(scoreData.violations ?? []),
            ...(scoreData.compensationFlags ?? []),
          ].join("; "),
        });
        setScoreResult({ overallScore: scoreData.overallScore, repCount: scoreData.repCount });
        setPhase("done");
      } catch {
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

  const scoreColor = (s: number) => {
    if (s >= 80) return "#10b981";
    if (s >= 50) return "#f59e0b";
    return "#ef4444";
  };

  /* ── Permission screen ── */
  if (phase === "permission") {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={["#0f172a", "#1e1b4b", "#312e81"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 20 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(99,102,241,0.2)", alignItems: "center", justifyContent: "center" }}>
            <FontAwesome name="camera" size={36} color="#818cf8" />
          </View>
          <Text style={{ fontFamily: "NeueBold", fontSize: 22, color: "#fff", textAlign: "center" }}>
            Camera Access Required
          </Text>
          <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: "rgba(255,255,255,0.65)", textAlign: "center", lineHeight: 21 }}>
            We need camera access to record your exercise session and score your form.
          </Text>
          <Pressable
            onPress={requestCameraPermission}
            style={{ backgroundColor: "#6366f1", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36, marginTop: 8 }}
          >
            <Text style={{ fontFamily: "NeueBold", fontSize: 16, color: "#fff" }}>Grant Permission</Text>
          </Pressable>
          <Pressable onPress={() => router.back()}>
            <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: "rgba(255,255,255,0.5)" }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ── Done screen ── */
  if (phase === "done") {
    const score = scoreResult?.overallScore ?? 0;
    const color = scoreColor(score);
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient colors={["#0f172a", "#1e1b4b", "#312e81"]} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: `${color}25`, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: color }}>
            <FontAwesome name="check" size={44} color={color} />
          </View>
          <Text style={{ fontFamily: "NeueBold", fontSize: 26, color: "#fff" }}>Session Complete!</Text>

          {scoreResult ? (
            <>
              <BlurView
                intensity={40}
                tint="dark"
                style={{ borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", overflow: "hidden", width: "100%", marginTop: 8 }}
              >
                <View style={{ padding: 20, alignItems: "center", gap: 8 }}>
                  <Text style={{ fontFamily: "NeueBold", fontSize: 52, color }}>
                    {score.toFixed(0)}
                  </Text>
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
                    out of 100
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <FontAwesome name="refresh" size={12} color="rgba(255,255,255,0.5)" />
                    <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                      {scoreResult.repCount} reps detected
                    </Text>
                  </View>
                </View>
              </BlurView>
            </>
          ) : (
            <BlurView
              intensity={40}
              tint="dark"
              style={{ borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden", width: "100%", marginTop: 8 }}
            >
              <View style={{ padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <FontAwesome name="info-circle" size={16} color="#818cf8" style={{ marginTop: 1 }} />
                <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: "rgba(255,255,255,0.7)", flex: 1, lineHeight: 19 }}>
                  {feedback}
                </Text>
              </View>
            </BlurView>
          )}

          <Pressable
            style={{ backgroundColor: "#6366f1", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36, marginTop: 8, width: "100%", alignItems: "center" }}
            onPress={() => router.push(`/rehab/${planId}`)}
          >
            <Text style={{ fontFamily: "NeueBold", fontSize: 16, color: "#fff" }}>Back to Plan</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ── Error screen ── */
  if (phase === "error") {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient colors={["#0f172a", "#1e1b4b", "#312e81"]} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <FontAwesome name="exclamation-circle" size={52} color="#ef4444" />
          <Text style={{ fontFamily: "NeueBold", fontSize: 18, color: "#fff", textAlign: "center" }}>
            {error ?? "An error occurred."}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{ backgroundColor: "#6366f1", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32 }}
          >
            <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: "#fff" }}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ── Camera (ready + recording + uploading) ── */
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" mode="video" />

      {/* Overlay */}
      <View style={StyleSheet.absoluteFill}>

        {/* Top bar */}
        <BlurView intensity={50} tint="dark" style={{ paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            {exercise && (
              <Text style={{ fontFamily: "NeueBold", fontSize: 16, color: "#fff" }} numberOfLines={1}>
                {exercise.name}
              </Text>
            )}
            {exercise && (
              <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                {exercise.reps} reps × {exercise.sets} sets · hold {exercise.holdDurationSec}s
              </Text>
            )}
          </View>
          {phase === "recording" && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(239,68,68,0.25)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#ef4444" }} />
              <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: "#fff" }}>
                {formatDuration(recordingDuration)}
              </Text>
            </View>
          )}
        </BlurView>

        {/* Feedback bubble (middle) */}
        {phase !== "uploading" && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <BlurView
              intensity={60}
              tint="dark"
              style={{ borderRadius: 16, overflow: "hidden", maxWidth: "80%", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}
            >
              <View style={{ paddingHorizontal: 18, paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: "#fff", textAlign: "center" }}>
                  {feedback}
                </Text>
                {phase === "recording" && repCount > 0 && (
                  <Text style={{ fontFamily: "NeueBold", fontSize: 36, color: "#818cf8", marginTop: 4 }}>
                    {repCount}
                    <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}> reps</Text>
                  </Text>
                )}
              </View>
            </BlurView>
          </View>
        )}

        {/* Uploading overlay */}
        {phase === "uploading" && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
            <ActivityIndicator color="#818cf8" size="large" />
            <Text style={{ fontFamily: "NeueBold", fontSize: 16, color: "#fff" }}>Processing session…</Text>
            <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
              This may take a moment
            </Text>
          </View>
        )}

        {/* Bottom controls */}
        {phase !== "uploading" && (
          <BlurView intensity={50} tint="dark" style={{ paddingBottom: 48, paddingTop: 20, paddingHorizontal: 40, alignItems: "center" }}>
            {phase === "recording" ? (
              <View style={{ alignItems: "center", gap: 10 }}>
                <Pressable onPress={stopRecording}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                    <View style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: "#ef4444" }} />
                  </View>
                </Pressable>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Tap to Stop</Text>
              </View>
            ) : (
              <View style={{ alignItems: "center", gap: 10 }}>
                <Pressable onPress={startRecording}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: "#fff", backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}>
                    <FontAwesome name="play" size={22} color="#fff" style={{ marginLeft: 4 }} />
                  </View>
                </Pressable>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Tap to Start</Text>
              </View>
            )}
            <Pressable onPress={() => router.back()} style={{ marginTop: 18 }}>
              <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: "rgba(255,255,255,0.5)" }}>Cancel</Text>
            </Pressable>
          </BlurView>
        )}
      </View>
    </View>
  );
}
