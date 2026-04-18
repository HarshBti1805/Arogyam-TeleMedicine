/**
 * Appointment detail screen.
 * Shows recording/call options based on appointment type (ONLINE vs ON_SITE).
 * Mandates two-party consent before any recording begins.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ConsentModal } from "@/components/ConsentModal";
import { AudioRecorder } from "@/components/AudioRecorder";
import { VideoCall } from "@/components/VideoCall";
import { rehabApi, AIAnalysis } from "@/utils/rehabApi";
import { WsClient } from "@/utils/wsClient";
import { api } from "@/utils/api";
import { loadAuthUser } from "@/utils/auth-storage";

interface Appointment {
  id: string;
  type: "ONLINE" | "ON_SITE";
  status: string;
  dateTime: string;
  symptoms?: string;
  doctor?: { fullName?: string };
  patient?: { fullName?: string };
  patientId: string;
  doctorId: string;
}

type Screen =
  | "detail"
  | "consent_audio"
  | "consent_video"
  | "recording"
  | "video_call"
  | "analyzing"
  | "analysis_result";

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("detail");
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [patientConsent, setPatientConsent] = useState(false);
  const [doctorConsent, setDoctorConsent] = useState(false);

  // Fetch appointment — patientId and doctorId come from the appointment record itself
  useEffect(() => {
    api
      .get<{ appointment: Appointment }>(`/api/appointments/${id}`)
      .then(({ appointment: a }) => setAppointment(a))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // WebSocket listener for analysis ready
  useEffect(() => {
    if (screen !== "analyzing") return;
    const ws = new WsClient({ roomId: id });
    ws.on("analysis.result.ready", (payload: any) => {
      setAnalysis(payload.analysis);
      setScreen("analysis_result");
    });
    return () => ws.destroy();
  }, [screen, id]);

  const handleConsentGiven = (patient: boolean, doctor: boolean) => {
    setPatientConsent(patient);
    setDoctorConsent(doctor);
    if (appointment?.type === "ON_SITE") {
      setScreen("recording");
    } else {
      setScreen("video_call");
    }
  };

  const handleRecordingComplete = (uri: string, durationSec: number) => {
    setRecordedUri(uri);
    setRecordedDuration(durationSec);
  };

  const handleUpload = async () => {
    if (!recordedUri || !appointment) return;
    setUploading(true);
    setUploadError(null);
    try {
      await rehabApi.uploadRecording(
        appointment.id,
        recordedUri,
        "AUDIO",
        {
          consentPatient: patientConsent,
          consentDoctor: doctorConsent,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          durationSec: recordedDuration,
        }
      );
      setScreen("analyzing");
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCallEnd = async (audioUri?: string) => {
    setScreen("analyzing");
    if (audioUri && appointment) {
      try {
        await rehabApi.uploadRecording(appointment.id, audioUri, "VIDEO", {
          consentPatient: patientConsent,
          consentDoctor: doctorConsent,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
        });
      } catch {}
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: "#6b7280" }}>Appointment not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: "#3b82f6" }}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  // Full-screen video call
  if (screen === "video_call") {
    return (
      <VideoCall
        appointmentId={appointment.id}
        userId={appointment.patientId}
        isCaller
        onCallEnd={handleCallEnd}
        onFallbackToChat={() => {
          Alert.alert("Call Failed", "Falling back to chat.");
          setScreen("detail");
        }}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 8 }}>
          <Text style={{ color: "#3b82f6", fontSize: 14 }}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Appointment</Text>
        <Text style={styles.date}>
          {new Date(appointment.dateTime).toLocaleString()}
        </Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{appointment.type}</Text>
        </View>
      </View>

      {appointment.symptoms && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Symptoms</Text>
          <Text style={styles.sectionBody}>{appointment.symptoms}</Text>
        </View>
      )}

      {/* Consent modals */}
      <ConsentModal
        visible={screen === "consent_audio"}
        mode="in-person"
        onConsent={handleConsentGiven}
        onDismiss={() => setScreen("detail")}
      />
      <ConsentModal
        visible={screen === "consent_video"}
        mode="online"
        onConsent={handleConsentGiven}
        onDismiss={() => setScreen("detail")}
      />

      {/* Audio recording section */}
      {screen === "recording" && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>In-Person Recording</Text>
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            onError={(msg) => setUploadError(msg)}
          />
          {recordedUri && (
            <Pressable
              style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.uploadBtnText}>Upload & Analyze →</Text>
              )}
            </Pressable>
          )}
          {uploadError && <Text style={styles.errorText}>{uploadError}</Text>}
        </View>
      )}

      {/* Analyzing state */}
      {screen === "analyzing" && (
        <View style={styles.analyzingContainer}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={styles.analyzingText}>Analyzing consultation…</Text>
          <Text style={styles.analyzingSubtext}>
            This usually takes 1–2 minutes. We'll notify you when ready.
          </Text>
        </View>
      )}

      {/* Analysis result */}
      {screen === "analysis_result" && analysis && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AI Analysis</Text>
          <View style={styles.analysisCard}>
            <Text style={styles.analysisSummary}>{analysis.summary}</Text>
            {analysis.keyFindings.length > 0 && (
              <>
                <Text style={styles.findingsLabel}>Key Findings</Text>
                {analysis.keyFindings.map((f, i) => (
                  <Text key={i} style={styles.finding}>
                    • {f}
                  </Text>
                ))}
              </>
            )}
            {(analysis.suggestedExercises as any[]).length > 0 && (
              <Text style={styles.exercisesNote}>
                {(analysis.suggestedExercises as any[]).length} exercise
                {(analysis.suggestedExercises as any[]).length !== 1 ? "s" : ""} suggested.
                Your doctor will review and create a rehab plan.
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Action buttons (visible when on detail screen or after recording setup) */}
      {(screen === "detail" || screen === "recording") && (
        <View style={styles.actions}>
          {appointment.type === "ON_SITE" && screen === "detail" && (
            <Pressable
              style={styles.actionBtn}
              onPress={() => setScreen("consent_audio")}
            >
              <Text style={styles.actionBtnText}>🎙 Start Recording</Text>
            </Pressable>
          )}
          {appointment.type === "ONLINE" && screen === "detail" && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: "#7c3aed" }]}
              onPress={() => setScreen("consent_video")}
            >
              <Text style={styles.actionBtnText}>📹 Join Video Call</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  header: {
    backgroundColor: "#fff",
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  date: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  typeBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  typeText: { color: "#1d4ed8", fontSize: 12, fontWeight: "600" },
  section: { margin: 16, marginTop: 12 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
  sectionBody: { fontSize: 14, color: "#374151", lineHeight: 21 },
  actions: { margin: 16, gap: 12 },
  actionBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  uploadBtn: {
    marginTop: 16,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  uploadBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  errorText: { color: "#dc2626", fontSize: 13, marginTop: 8 },
  analyzingContainer: {
    margin: 32,
    alignItems: "center",
    gap: 12,
  },
  analyzingText: { fontSize: 18, fontWeight: "600", color: "#111827" },
  analyzingSubtext: { fontSize: 13, color: "#6b7280", textAlign: "center" },
  analysisCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  analysisSummary: { fontSize: 14, color: "#374151", lineHeight: 21 },
  findingsLabel: { fontSize: 13, fontWeight: "700", color: "#111827", marginTop: 4 },
  finding: { fontSize: 13, color: "#6b7280" },
  exercisesNote: {
    fontSize: 13,
    color: "#3b82f6",
    fontStyle: "italic",
    marginTop: 4,
  },
});
