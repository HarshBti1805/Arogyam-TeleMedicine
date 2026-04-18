import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useColorScheme } from "nativewind";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { loadAuthUser } from "@/utils/auth-storage";
import { rehabApi, type RehabPlan, type RehabStatus } from "@/utils/rehabApi";

type Filter = "ALL" | RehabStatus;

const STATUS_META: Record<
  RehabStatus,
  { color: string; icon: string; label: string }
> = {
  ACTIVE:    { color: "#10b981", icon: "play-circle",  label: "Active" },
  PAUSED:    { color: "#f59e0b", icon: "pause-circle", label: "Paused" },
  COMPLETED: { color: "#6366f1", icon: "check-circle", label: "Completed" },
  CANCELLED: { color: "#ef4444", icon: "times-circle", label: "Cancelled" },
};

function progressOf(plan: RehabPlan) {
  const done = (plan.sessions ?? []).filter((s) => s.status === "COMPLETED").length;
  const total = plan.exercises.length;
  if (!total) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

export default function RehabTab() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? "#818CF8" : "#6366F1";

  const [filter, setFilter] = useState<Filter>("ALL");
  const [plans, setPlans] = useState<RehabPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");

  const loadPlans = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const user = await loadAuthUser();
      if (!user) { setError("You are not logged in."); return; }
      const patientId = user.patientProfile?.id;
      if (!patientId) { setError("No patient profile found."); return; }
      setPatientName(user.patientProfile?.fullName ?? user.email ?? "");
      const { plans: p } = await rehabApi.getPlans(patientId);
      setPlans(p);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load rehab plans.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const filtered = filter === "ALL" ? plans : plans.filter((p) => p.status === filter);
  const activeCount = plans.filter((p) => p.status === "ACTIVE").length;

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "ALL",       label: `All (${plans.length})` },
    { id: "ACTIVE",    label: `Active${activeCount ? ` (${activeCount})` : ""}` },
    { id: "PAUSED",    label: "Paused" },
    { id: "COMPLETED", label: "Done" },
  ];

  const blurStyle = {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)",
    overflow: "hidden" as const,
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? ["#0f172a", "#1e1b4b", "#312e81"] : ["#f8fafc", "#e0e7ff", "#c7d2fe"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Header ── */}
      <Animated.View
        entering={FadeInDown.delay(100).springify()}
        style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={{ fontFamily: "NeueBold", fontSize: 22, color: isDark ? "#fff" : "#111827", marginBottom: 2 }}>
              My Rehab Plans
            </Text>
            {patientName ? (
              <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280", marginBottom: 2 }}>
                {patientName}
              </Text>
            ) : null}
            <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#6b7280" : "#9ca3af" }}>
              {loading ? "Loading…" : `${plans.length} plan${plans.length !== 1 ? "s" : ""} assigned`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => loadPlans(true)}
            style={{
              backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.1)",
              borderRadius: 12, padding: 10, marginTop: 4,
            }}
          >
            <FontAwesome name="refresh" size={15} color={primaryColor} />
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={{
                backgroundColor: filter === f.id
                  ? primaryColor
                  : isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.7)",
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderWidth: filter === f.id ? 0 : 1,
                borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
              }}
            >
              <Text style={{
                fontFamily: "NeueRegular",
                fontSize: 13,
                color: filter === f.id ? "#fff" : isDark ? "#d1d5db" : "#374151",
              }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>

      {/* ── Error ── */}
      {error && (
        <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurStyle}>
            <View style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <FontAwesome name="exclamation-circle" size={16} color="#ef4444" />
              <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: "#ef4444", flex: 1 }}>{error}</Text>
              <TouchableOpacity onPress={() => loadPlans()}>
                <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: primaryColor }}>Retry</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}

      {/* ── List ── */}
      {loading && !refreshing ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : (
        <Animated.View entering={FadeInUp.delay(200).springify()} style={{ flex: 1 }}>
          <FlatList
            data={filtered}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadPlans(true)}
                tintColor={primaryColor}
              />
            }
            ListEmptyComponent={
              <View style={{ alignItems: "center", marginTop: 60, gap: 12 }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(99,102,241,0.08)",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <FontAwesome name="heartbeat" size={32} color={isDark ? "#4b5563" : "#c7d2fe"} />
                </View>
                <Text style={{ fontFamily: "NeueBold", fontSize: 16, color: isDark ? "#9ca3af" : "#374151" }}>
                  No Rehab Plans Yet
                </Text>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#6b7280" : "#9ca3af", textAlign: "center" }}>
                  Your doctor will assign a rehab plan{"\n"}after your consultation.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <RehabCard
                plan={item}
                isDark={isDark}
                primaryColor={primaryColor}
                onPress={() => router.push(`/rehab/${item.id}`)}
              />
            )}
          />
        </Animated.View>
      )}
    </View>
  );
}

function RehabCard({
  plan,
  isDark,
  primaryColor,
  onPress,
}: {
  plan: RehabPlan;
  isDark: boolean;
  primaryColor: string;
  onPress: () => void;
}) {
  const progress = progressOf(plan);
  const meta = STATUS_META[plan.status] ?? { color: "#6b7280", icon: "circle", label: plan.status };
  const startDate = new Date(plan.startedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
      <BlurView
        intensity={isDark ? 40 : 60}
        tint={isDark ? "dark" : "light"}
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)",
          overflow: "hidden",
        }}
      >
        <View style={{ padding: 16 }}>
          {/* Top row */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            {/* Icon + Title */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 }}>
              <View style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: `${meta.color}20`,
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <FontAwesome name={meta.icon as any} size={22} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: isDark ? "#fff" : "#111827" }} numberOfLines={1}>
                  {plan.title}
                </Text>
                {plan.description ? (
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280", marginTop: 2 }} numberOfLines={2}>
                    {plan.description}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Status badge */}
            <View style={{
              backgroundColor: `${meta.color}20`,
              borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
              borderWidth: 1, borderColor: `${meta.color}40`, marginLeft: 8,
            }}>
              <Text style={{ fontFamily: "NeueBold", fontSize: 11, color: meta.color }}>
                {meta.label}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
              <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: isDark ? "#9ca3af" : "#6b7280" }}>
                Progress
              </Text>
              <Text style={{ fontFamily: "NeueBold", fontSize: 11, color: primaryColor }}>
                {progress}%
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", borderRadius: 3 }}>
              <View style={{
                height: 6,
                width: `${progress}%`,
                backgroundColor: progress === 100 ? "#10b981" : primaryColor,
                borderRadius: 3,
              }} />
            </View>
          </View>

          {/* Footer meta */}
          <View style={{
            flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            marginTop: 12, paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <FontAwesome name="list-ul" size={11} color="#9ca3af" />
              <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>
                {plan.exercises.length} exercise{plan.exercises.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <FontAwesome name="calendar" size={11} color="#9ca3af" />
              <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>
                Started {startDate}
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#9ca3af" />
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}
