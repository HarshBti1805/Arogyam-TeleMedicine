/**
 * In-person audio recording component using expo-av.
 * Shows a visible timer, pause/resume, and stop controls.
 */
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";

interface AudioRecorderProps {
  onRecordingComplete: (uri: string, durationSec: number) => void;
  onError: (message: string) => void;
}

type RecordingState = "idle" | "recording" | "paused" | "stopped";

export function AudioRecorder({ onRecordingComplete, onError }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [seconds, setSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopTimer = () => {
    timerRef.current && clearInterval(timerRef.current);
  };

  const handleStart = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        onError("Microphone permission denied.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setState("recording");
      setSeconds(0);
      startTimer();
    } catch (e: any) {
      onError(`Failed to start recording: ${e.message}`);
    }
  };

  const handlePause = async () => {
    try {
      await recordingRef.current?.pauseAsync();
      setState("paused");
      stopTimer();
    } catch (e: any) {
      onError(`Pause failed: ${e.message}`);
    }
  };

  const handleResume = async () => {
    try {
      await recordingRef.current?.startAsync();
      setState("recording");
      startTimer();
    } catch (e: any) {
      onError(`Resume failed: ${e.message}`);
    }
  };

  const handleStop = async () => {
    try {
      stopTimer();
      await recordingRef.current?.stopAndUnloadAsync();
      const uri = recordingRef.current?.getURI();
      const status = await recordingRef.current?.getStatusAsync();
      setState("stopped");
      if (uri) {
        const durationMs = (status as any)?.durationMillis ?? seconds * 1000;
        onRecordingComplete(uri, Math.round(durationMs / 1000));
      } else {
        onError("Recording URI is missing.");
      }
    } catch (e: any) {
      onError(`Stop failed: ${e.message}`);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      {/* Timer */}
      <View style={styles.timerContainer}>
        {state === "recording" && <View style={styles.recDot} />}
        <Text style={[styles.timer, state === "paused" && { opacity: 0.5 }]}>
          {formatTime(seconds)}
        </Text>
      </View>
      <Text style={styles.stateLabel}>
        {state === "idle" && "Ready to record"}
        {state === "recording" && "Recording…"}
        {state === "paused" && "Paused"}
        {state === "stopped" && "Recording saved"}
      </Text>

      {/* Controls */}
      <View style={styles.controls}>
        {state === "idle" && (
          <Pressable style={[styles.btn, styles.startBtn]} onPress={handleStart}>
            <Text style={styles.btnText}>⏺ Start</Text>
          </Pressable>
        )}

        {state === "recording" && (
          <>
            <Pressable style={[styles.btn, styles.pauseBtn]} onPress={handlePause}>
              <Text style={styles.btnText}>⏸ Pause</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.stopBtn]} onPress={handleStop}>
              <Text style={styles.btnText}>⏹ Stop</Text>
            </Pressable>
          </>
        )}

        {state === "paused" && (
          <>
            <Pressable style={[styles.btn, styles.startBtn]} onPress={handleResume}>
              <Text style={styles.btnText}>▶ Resume</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.stopBtn]} onPress={handleStop}>
              <Text style={styles.btnText}>⏹ Stop</Text>
            </Pressable>
          </>
        )}

        {state === "stopped" && (
          <Text style={styles.doneText}>✓ Ready to upload</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  timerContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" },
  timer: { fontSize: 48, fontWeight: "700", color: "#111827", fontVariant: ["tabular-nums"] },
  stateLabel: { fontSize: 14, color: "#6b7280", marginTop: 6, marginBottom: 24 },
  controls: { flexDirection: "row", gap: 12 },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  startBtn: { backgroundColor: "#3b82f6" },
  pauseBtn: { backgroundColor: "#d97706" },
  stopBtn: { backgroundColor: "#ef4444" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  doneText: { fontSize: 15, color: "#16a34a", fontWeight: "600" },
});
