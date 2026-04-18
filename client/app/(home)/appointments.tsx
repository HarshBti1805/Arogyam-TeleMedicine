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
import { appointments, type Appointment } from "@/utils/api";
import { loadAuthUser } from "@/utils/auth-storage";

type Filter = "ALL" | "UPCOMING" | "COMPLETED" | "CANCELLED";

const STATUS_COLOR: Record<string, string> = {
  PENDING:   "#f59e0b",
  CONFIRMED: "#6366f1",
  COMPLETED: "#10b981",
  CANCELLED: "#ef4444",
};

const STATUS_BG: Record<string, string> = {
  PENDING:   "#fef3c720",
  CONFIRMED: "#6366f120",
  COMPLETED: "#10b98120",
  CANCELLED: "#ef444420",
};

function isUpcoming(a: Appointment) {
  return (a.status === "PENDING" || a.status === "CONFIRMED") && new Date(a.dateTime) >= new Date();
}

export default function AppointmentsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? "#818CF8" : "#6366F1";

  const [filter, setFilter] = useState<Filter>("ALL");
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const user = await loadAuthUser();
      const patientId = user?.patientProfile?.id;
      if (!patientId) {
        setError("No patient profile found.");
        return;
      }
      const { appointments: list } = await appointments.listForPatient(patientId);
      // Sort newest first
      setAllAppointments(
        [...list].sort(
          (a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()
        )
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to load appointments.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  const filtered = allAppointments.filter((a) => {
    if (filter === "ALL") return true;
    if (filter === "UPCOMING") return isUpcoming(a);
    if (filter === "COMPLETED") return a.status === "COMPLETED";
    if (filter === "CANCELLED") return a.status === "CANCELLED";
    return true;
  });

  const upcomingCount = allAppointments.filter(isUpcoming).length;

  const blurStyle = {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)",
    overflow: "hidden" as const,
  };

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "ALL",       label: "All" },
    { id: "UPCOMING",  label: `Upcoming${upcomingCount ? ` (${upcomingCount})` : ""}` },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
  ];

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
        <Text style={{ fontFamily: "NeueBold", fontSize: 22, color: isDark ? "#fff" : "#111827", marginBottom: 2 }}>
          My Appointments
        </Text>
        <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280", marginBottom: 14 }}>
          {loading ? "Loading…" : `${allAppointments.length} appointment${allAppointments.length !== 1 ? "s" : ""} total`}
        </Text>

        {/* Filter chips */}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
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
              <TouchableOpacity onPress={() => loadAppointments()}>
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
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadAppointments(true)}
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
                  <FontAwesome name="calendar-o" size={32} color={isDark ? "#4b5563" : "#c7d2fe"} />
                </View>
                <Text style={{ fontFamily: "NeueBold", fontSize: 16, color: isDark ? "#9ca3af" : "#374151" }}>
                  No appointments found
                </Text>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#6b7280" : "#9ca3af", textAlign: "center" }}>
                  {filter === "ALL"
                    ? "Book your first appointment with a doctor."
                    : `No ${filter.toLowerCase()} appointments.`}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <AppointmentCard
                appointment={item}
                isDark={isDark}
                primaryColor={primaryColor}
                onPress={() => router.push(`/appointments/${item.id}`)}
              />
            )}
          />
        </Animated.View>
      )}
    </View>
  );
}

function AppointmentCard({
  appointment: a,
  isDark,
  primaryColor,
  onPress,
}: {
  appointment: Appointment;
  isDark: boolean;
  primaryColor: string;
  onPress: () => void;
}) {
  const dt = new Date(a.dateTime);
  const isOnline = a.type === "ONLINE";
  const statusColor = STATUS_COLOR[a.status] ?? "#6b7280";
  const isPast = dt < new Date();

  const dateStr = dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
          opacity: isPast && a.status !== "COMPLETED" ? 0.7 : 1,
        }}
      >
        <View style={{ padding: 16 }}>
          {/* Top row: date + status badge */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {/* Date block */}
              <View style={{
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.08)",
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 6,
                alignItems: "center",
              }}>
                <Text style={{ fontFamily: "NeueBold", fontSize: 18, color: isDark ? "#fff" : "#111827", lineHeight: 20 }}>
                  {dt.getDate()}
                </Text>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 10, color: isDark ? "#9ca3af" : "#6b7280", textTransform: "uppercase" }}>
                  {dt.toLocaleDateString([], { month: "short" })}
                </Text>
              </View>
              <View>
                <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: isDark ? "#fff" : "#111827" }}>{dateStr}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <FontAwesome name="clock-o" size={11} color="#9ca3af" />
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>{timeStr}</Text>
                </View>
              </View>
            </View>

            {/* Status badge */}
            <View style={{
              backgroundColor: `${statusColor}20`,
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: `${statusColor}40`,
            }}>
              <Text style={{ fontFamily: "NeueBold", fontSize: 11, color: statusColor }}>
                {a.status}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", marginBottom: 12 }} />

          {/* Doctor info */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: `${primaryColor}20`,
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <FontAwesome name="user-md" size={20} color={primaryColor} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: isDark ? "#fff" : "#111827" }}>
                {a.doctor.fullName}
              </Text>
              <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: primaryColor, marginTop: 1 }}>
                {a.doctor.specialization}
              </Text>
              {(a.doctor.clinicName || a.doctor.city) && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <FontAwesome name="map-marker" size={10} color="#9ca3af" />
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: isDark ? "#9ca3af" : "#6b7280" }} numberOfLines={1}>
                    {a.doctor.clinicName ?? ""}{a.doctor.city ? (a.doctor.clinicName ? `, ${a.doctor.city}` : a.doctor.city) : ""}
                  </Text>
                </View>
              )}
            </View>

            {/* Type + chevron */}
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                backgroundColor: isOnline
                  ? (isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.1)")
                  : (isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.1)"),
                borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
              }}>
                <FontAwesome
                  name={isOnline ? "video-camera" : "hospital-o"}
                  size={11}
                  color={isOnline ? primaryColor : "#10b981"}
                />
                <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: isOnline ? primaryColor : "#10b981" }}>
                  {isOnline ? "Online" : "In-Person"}
                </Text>
              </View>
              <FontAwesome name="chevron-right" size={12} color="#9ca3af" />
            </View>
          </View>

          {/* Free badge */}
          {a.isFree && (
            <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
              <View style={{
                backgroundColor: "#10b98115",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderWidth: 1,
                borderColor: "#10b98130",
              }}>
                <Text style={{ fontFamily: "NeueBold", fontSize: 11, color: "#10b981" }}>
                  ✓ Free Consultation
                </Text>
              </View>
            </View>
          )}
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}
