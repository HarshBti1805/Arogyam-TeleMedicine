import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useColorScheme } from "nativewind";
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { loadAuthUser } from "@/utils/auth-storage";
import { appointments } from "@/utils/api";
import { rehabApi } from "@/utils/rehabApi";
import type { Appointment } from "@/utils/api";

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function HomeScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? "#818CF8" : "#6366F1";

  const [userName, setUserName] = useState("there");
  const [initials, setInitials] = useState("?");
  const [aptCount, setAptCount] = useState<number | null>(null);
  const [rehabCount, setRehabCount] = useState<number | null>(null);
  const [nextApt, setNextApt] = useState<Appointment | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Ambient pulse animation
  const pulseAnim = useSharedValue(0);
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []); // eslint-disable-line

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 1.06]) }],
    opacity: interpolate(pulseAnim.value, [0, 1], [0.28, 0.46]),
  }));

  const loadData = useCallback(async () => {
    const user = await loadAuthUser();
    if (!user) return;

    const name = user.patientProfile?.fullName ?? user.email ?? "there";
    setUserName(name.split(" ")[0]);
    setInitials(
      name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    );

    const patientId = user.patientProfile?.id;
    if (!patientId) { setStatsLoading(false); return; }

    try {
      const [aptRes, rehabRes] = await Promise.allSettled([
        appointments.listForPatient(patientId),
        rehabApi.getPlans(patientId),
      ]);

      if (aptRes.status === "fulfilled") {
        setAptCount(aptRes.value.count);
        // Find the soonest upcoming appointment
        const upcoming = aptRes.value.appointments
          .filter(
            (a) =>
              (a.status === "PENDING" || a.status === "CONFIRMED") &&
              new Date(a.dateTime) >= new Date()
          )
          .sort(
            (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
          );
        setNextApt(upcoming[0] ?? null);
      }
      if (rehabRes.status === "fulfilled") {
        setRehabCount(rehabRes.value.plans.length);
      }
    } catch {
      /* stats are non-critical */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const blurCard = {
    borderRadius: 20 as const,
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

      {/* Ambient blobs */}
      <Animated.View style={[pulseStyle, { position: "absolute", top: -120, right: -120, width: 380, height: 380, borderRadius: 190, backgroundColor: isDark ? "#4f46e5" : "#818cf8" }]} />
      <Animated.View style={[pulseStyle, { position: "absolute", bottom: -80, left: -120, width: 300, height: 300, borderRadius: 150, backgroundColor: isDark ? "#818cf8" : "#4f46e5" }]} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <Animated.View entering={FadeInDown.delay(80).springify()} style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontFamily: "NeueRegular", fontSize: 16, color: isDark ? "#9ca3af" : "#6b7280" }}>
                {greet()},
              </Text>
              <Text style={{ fontFamily: "NeueBold", fontSize: 26, color: isDark ? "#fff" : "#111827", marginTop: 2 }}>
                {userName} 👋
              </Text>
            </View>

            {/* Avatar */}
            <TouchableOpacity onPress={() => router.push("/(home)/profile")} activeOpacity={0.8}>
              <LinearGradient
                colors={["#6366f1", "#818cf8"]}
                style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontFamily: "NeueBold", fontSize: 16, color: "#fff" }}>{initials}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Stats ── */}
        <Animated.View entering={FadeInDown.delay(150).springify()} style={{ paddingHorizontal: 20, marginTop: 16, marginBottom: 4 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={() => router.push("/(home)/appointments")}>
              <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCard}>
                <View style={{ padding: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#6366f120", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <FontAwesome name="calendar" size={16} color="#6366f1" />
                  </View>
                  {statsLoading ? (
                    <ActivityIndicator size="small" color={primaryColor} />
                  ) : (
                    <Text style={{ fontFamily: "NeueBold", fontSize: 28, color: isDark ? "#fff" : "#111827" }}>
                      {aptCount ?? "—"}
                    </Text>
                  )}
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280", marginTop: 2 }}>
                    Appointments
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={() => router.push("/(home)/rehab")}>
              <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCard}>
                <View style={{ padding: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#10b98120", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                    <FontAwesome name="heartbeat" size={16} color="#10b981" />
                  </View>
                  {statsLoading ? (
                    <ActivityIndicator size="small" color="#10b981" />
                  ) : (
                    <Text style={{ fontFamily: "NeueBold", fontSize: 28, color: isDark ? "#fff" : "#111827" }}>
                      {rehabCount ?? "—"}
                    </Text>
                  )}
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280", marginTop: 2 }}>
                    Rehab Plans
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ── Quick Actions ── */}
        <Animated.View entering={FadeInUp.delay(220).springify()} style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={{ fontFamily: "NeueBold", fontSize: 18, color: isDark ? "#fff" : "#111827", marginBottom: 12 }}>
            Quick Actions
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <QuickAction
              icon="user-md"
              label="Find Doctor"
              color="#6366f1"
              isDark={isDark}
              onPress={() => router.push("/(home)/search-doctors")}
            />
            <QuickAction
              icon="calendar-plus-o"
              label="Book Appointment"
              color="#10b981"
              isDark={isDark}
              onPress={() => router.push("/(home)/search-doctors")}
            />
            <QuickAction
              icon="heartbeat"
              label="My Rehab"
              color="#f59e0b"
              isDark={isDark}
              onPress={() => router.push("/(home)/rehab")}
            />
          </View>
        </Animated.View>

        {/* ── Next Appointment ── */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontFamily: "NeueBold", fontSize: 18, color: isDark ? "#fff" : "#111827" }}>
              Next Appointment
            </Text>
            <TouchableOpacity onPress={() => router.push("/(home)/appointments")}>
              <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: primaryColor }}>View All</Text>
            </TouchableOpacity>
          </View>

          {statsLoading ? (
            <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCard}>
              <View style={{ padding: 20, alignItems: "center" }}>
                <ActivityIndicator color={primaryColor} />
              </View>
            </BlurView>
          ) : nextApt ? (
            <TouchableOpacity activeOpacity={0.82} onPress={() => router.push(`/appointments/${nextApt.id}`)}>
              <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCard}>
                <View style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: `${primaryColor}20`, alignItems: "center", justifyContent: "center" }}>
                      <FontAwesome name="user-md" size={24} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: isDark ? "#fff" : "#111827" }}>
                        {nextApt.doctor.fullName}
                      </Text>
                      <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: primaryColor, marginTop: 1 }}>
                        {nextApt.doctor.specialization}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 }}>
                        <FontAwesome name="clock-o" size={11} color="#9ca3af" />
                        <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>
                          {new Date(nextApt.dateTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                          {" · "}
                          {new Date(nextApt.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <View style={{
                        backgroundColor: nextApt.type === "ONLINE" ? `${primaryColor}20` : "#10b98120",
                        borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
                        flexDirection: "row", alignItems: "center", gap: 4,
                      }}>
                        <FontAwesome
                          name={nextApt.type === "ONLINE" ? "video-camera" : "hospital-o"}
                          size={11}
                          color={nextApt.type === "ONLINE" ? primaryColor : "#10b981"}
                        />
                        <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: nextApt.type === "ONLINE" ? primaryColor : "#10b981" }}>
                          {nextApt.type === "ONLINE" ? "Online" : "In-Person"}
                        </Text>
                      </View>
                      <FontAwesome name="chevron-right" size={12} color="#9ca3af" />
                    </View>
                  </View>
                </View>
              </BlurView>
            </TouchableOpacity>
          ) : (
            <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCard}>
              <View style={{ padding: 24, alignItems: "center", gap: 8 }}>
                <FontAwesome name="calendar-o" size={32} color={isDark ? "#4b5563" : "#c7d2fe"} />
                <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: isDark ? "#6b7280" : "#374151" }}>
                  No upcoming appointments
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(home)/search-doctors")}
                  style={{ backgroundColor: primaryColor, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 9, marginTop: 4 }}
                >
                  <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: "#fff" }}>Book Now</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          )}
        </Animated.View>

        {/* ── Active Rehab ── */}
        <Animated.View entering={FadeInUp.delay(380).springify()} style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ fontFamily: "NeueBold", fontSize: 18, color: isDark ? "#fff" : "#111827" }}>
              Rehab & Recovery
            </Text>
            <TouchableOpacity onPress={() => router.push("/(home)/rehab")}>
              <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: primaryColor }}>View All</Text>
            </TouchableOpacity>
          </View>

          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCard}>
            <View style={{ padding: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#10b98120", alignItems: "center", justifyContent: "center" }}>
                  <FontAwesome name="heartbeat" size={22} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: isDark ? "#fff" : "#111827" }}>
                    {statsLoading ? "Loading…" : rehabCount && rehabCount > 0 ? `${rehabCount} plan${rehabCount !== 1 ? "s" : ""} assigned` : "No plans yet"}
                  </Text>
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280", marginTop: 2 }}>
                    AI-guided exercise tracking
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/(home)/rehab")}
                style={{
                  backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.1)",
                  borderRadius: 12, paddingVertical: 11,
                  flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                  borderWidth: 1, borderColor: "rgba(16,185,129,0.25)",
                }}
              >
                <FontAwesome name="play-circle" size={15} color="#10b981" />
                <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: "#10b981" }}>
                  Go to Rehab Plans
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Animated.View>

        {/* ── Find Doctor banner ── */}
        <Animated.View entering={FadeInUp.delay(450).springify()} style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <TouchableOpacity activeOpacity={0.88} onPress={() => router.push("/(home)/search-doctors")}>
            <LinearGradient
              colors={["#6366f1", "#818cf8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "center", gap: 14 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "NeueBold", fontSize: 17, color: "#fff", marginBottom: 4 }}>
                  Find a Doctor Near You
                </Text>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
                  Search by specialty, name, or location
                </Text>
              </View>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
                <FontAwesome name="search" size={20} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

function QuickAction({
  icon, label, color, isDark, onPress,
}: {
  icon: string; label: string; color: string; isDark: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={onPress}>
      <BlurView
        intensity={isDark ? 40 : 60}
        tint={isDark ? "dark" : "light"}
        style={{ borderRadius: 18, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)", overflow: "hidden" }}
      >
        <View style={{ padding: 14, alignItems: "center", gap: 8 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: `${color}20`, alignItems: "center", justifyContent: "center" }}>
            <FontAwesome name={icon as any} size={18} color={color} />
          </View>
          <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: isDark ? "#d1d5db" : "#374151", textAlign: "center" }}>
            {label}
          </Text>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}
