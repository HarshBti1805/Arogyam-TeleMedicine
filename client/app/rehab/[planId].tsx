import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { rehabApi, RehabPlan, RehabExercise } from "@/utils/rehabApi";

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<RehabPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rehabApi
      .getPlan(planId)
      .then(({ plan: p }) => setPlan(p))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [planId]);

  const handleStartSession = async (exercise: RehabExercise, patientId: string) => {
    try {
      const { session } = await rehabApi.startSession(planId, exercise.id, patientId);
      router.push(`/rehab/session/${session.id}?exerciseId=${exercise.id}&planId=${planId}`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  if (error || !plan) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Plan not found"}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: "#3b82f6" }}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 8 }}>
          <Text style={{ color: "#3b82f6", fontSize: 14 }}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>{plan.title}</Text>
        {plan.description ? (
          <Text style={styles.desc}>{plan.description}</Text>
        ) : null}
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{plan.status}</Text>
        </View>
      </View>

      {/* Exercise list */}
      <Text style={styles.sectionHeader}>Exercises</Text>
      {plan.exercises.length === 0 ? (
        <Text style={styles.empty}>No exercises in this plan.</Text>
      ) : (
        plan.exercises.map((ex, idx) => (
          <View key={ex.id} style={styles.exerciseCard}>
            <View style={styles.exerciseRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseName}>
                  {idx + 1}. {ex.name}
                </Text>
                {ex.description ? (
                  <Text style={styles.exerciseDesc}>{ex.description}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.tagRow}>
              <Tag>{ex.targetJoint.replace(/_/g, " ")}</Tag>
              <Tag>
                {ex.targetAngleMin}°–{ex.targetAngleMax}°
              </Tag>
              <Tag>
                {ex.reps}r × {ex.sets}s
              </Tag>
              <Tag>hold {ex.holdDurationSec}s</Tag>
            </View>

            <Pressable
              style={styles.startBtn}
              onPress={() => handleStartSession(ex, plan.patientId)}
            >
              <Text style={styles.startBtnText}>▶ Start Session</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{children}</Text>
    </View>
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
  desc: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  statusBadge: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: { color: "#1d4ed8", fontSize: 12, fontWeight: "600" },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  exerciseCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  exerciseRow: { flexDirection: "row", justifyContent: "space-between" },
  exerciseName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  exerciseDesc: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: {
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 11, color: "#4b5563", fontFamily: "monospace" },
  startBtn: {
    marginTop: 14,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  startBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 16, marginHorizontal: 16 },
  error: { color: "#dc2626", textAlign: "center" },
});
