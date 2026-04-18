import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { loadAuthUser } from "@/utils/auth-storage";
import { rehabApi, RehabPlan } from "@/utils/rehabApi";

export default function RehabTab() {
  const router = useRouter();
  const [plans, setPlans] = useState<RehabPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string>("");

  const loadPlans = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const user = await loadAuthUser();
      if (!user) {
        setError("You are not logged in.");
        return;
      }

      const patientProfileId = user.patientProfile?.id;
      if (!patientProfileId) {
        setError("No patient profile found. Please complete your profile first.");
        return;
      }

      setPatientName(user.patientProfile?.fullName ?? user.email ?? "");

      const { plans: p } = await rehabApi.getPlans(patientProfileId);
      setPlans(p);
    } catch (e: any) {
      setError(e.message ?? "Failed to load rehab plans.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const progressOf = (plan: RehabPlan) => {
    const sessions = plan.sessions ?? [];
    const done = sessions.filter((s) => s.status === "COMPLETED").length;
    const total = plan.exercises.length;
    if (!total) return 0;
    return Math.min(100, Math.round((done / total) * 100));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#3b82f6" size="large" />
        <Text style={styles.loadingText}>Loading your plans…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => loadPlans()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.header}>My Rehab Plans</Text>
          {patientName ? (
            <Text style={styles.subheader}>{patientName}</Text>
          ) : null}
        </View>
        <Pressable onPress={() => loadPlans(true)} style={styles.refreshBtn}>
          <Text style={styles.refreshIcon}>↻</Text>
        </Pressable>
      </View>

      <FlatList
        data={plans}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadPlans(true)} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyTitle}>No Rehab Plans Yet</Text>
            <Text style={styles.emptySubtext}>
              Your doctor will create a rehab plan for you after your consultation.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const progress = progressOf(item);
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/rehab/${item.id}`)}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <StatusBadge status={item.status} />
              </View>

              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {/* Progress bar */}
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.progressLabel}>{progress}% complete</Text>
                <Text style={styles.cardMeta}>
                  {item.exercises.length} exercise
                  {item.exercises.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "#16a34a",
    PAUSED: "#d97706",
    COMPLETED: "#2563eb",
    CANCELLED: "#dc2626",
  };
  return (
    <View style={[styles.badge, { backgroundColor: colors[status] ?? "#6b7280" }]}>
      <Text style={styles.badgeText}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", paddingTop: 56 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 12 },
  loadingText: { color: "#6b7280", fontSize: 14, marginTop: 8 },
  errorText: { color: "#dc2626", fontSize: 14, textAlign: "center" },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  header: { fontSize: 22, fontWeight: "700", color: "#111827" },
  subheader: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  refreshBtn: { padding: 8 },
  refreshIcon: { fontSize: 22, color: "#3b82f6" },

  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151" },
  emptySubtext: { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 20 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  cardDesc: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  progressBg: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, marginTop: 12 },
  progressFill: { height: 6, backgroundColor: "#3b82f6", borderRadius: 3 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  progressLabel: { fontSize: 11, color: "#6b7280" },
  cardMeta: { fontSize: 12, color: "#9ca3af" },
});
