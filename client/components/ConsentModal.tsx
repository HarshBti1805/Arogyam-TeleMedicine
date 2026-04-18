/**
 * Two-party consent modal — MANDATORY before any recording starts.
 * Both patient and doctor must explicitly check their boxes.
 */
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Switch,
} from "react-native";

interface ConsentModalProps {
  visible: boolean;
  onConsent: (patientConsent: boolean, doctorConsent: boolean) => void;
  onDismiss: () => void;
  mode: "in-person" | "online";
}

export function ConsentModal({ visible, onConsent, onDismiss, mode }: ConsentModalProps) {
  const [patientConsent, setPatientConsent] = useState(false);
  const [doctorConsent, setDoctorConsent] = useState(false);

  const canProceed = patientConsent && doctorConsent;

  const handleProceed = () => {
    if (!canProceed) return;
    onConsent(patientConsent, doctorConsent);
  };

  const handleDismiss = () => {
    setPatientConsent(false);
    setDoctorConsent(false);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Recording Consent Required</Text>
          <Text style={styles.subtitle}>
            {mode === "in-person"
              ? "This appointment will be audio-recorded for AI-assisted clinical analysis."
              : "This video call will be recorded for AI-assisted clinical analysis."}
          </Text>
          <Text style={styles.legal}>
            By proceeding, both parties acknowledge and consent to this recording in
            accordance with applicable law. The recording will be used solely for
            medical analysis and will not be shared beyond your care team.
          </Text>

          <View style={styles.consentRow}>
            <Switch
              value={patientConsent}
              onValueChange={setPatientConsent}
              trackColor={{ true: "#3b82f6" }}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.consentLabel}>Patient Consent</Text>
              <Text style={styles.consentDesc}>
                I, the patient, consent to this recording being used for my medical care.
              </Text>
            </View>
          </View>

          <View style={styles.consentRow}>
            <Switch
              value={doctorConsent}
              onValueChange={setDoctorConsent}
              trackColor={{ true: "#3b82f6" }}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.consentLabel}>Doctor Consent</Text>
              <Text style={styles.consentDesc}>
                The doctor has acknowledged and consented to this recording.
              </Text>
            </View>
          </View>

          {!canProceed && (
            <Text style={styles.warning}>
              Both parties must consent before recording can begin.
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={handleDismiss}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.proceedBtn, !canProceed && styles.proceedDisabled]}
              onPress={handleProceed}
              disabled={!canProceed}
            >
              <Text style={styles.proceedText}>
                {mode === "in-person" ? "Start Recording" : "Join Call"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#374151", marginBottom: 8 },
  legal: {
    fontSize: 12,
    color: "#6b7280",
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    lineHeight: 18,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 12,
  },
  consentLabel: { fontSize: 15, fontWeight: "600", color: "#111827" },
  consentDesc: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  warning: { fontSize: 12, color: "#d97706", marginBottom: 12, textAlign: "center" },
  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: { color: "#374151", fontSize: 15, fontWeight: "600" },
  proceedBtn: {
    flex: 1,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  proceedDisabled: { backgroundColor: "#93c5fd" },
  proceedText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
