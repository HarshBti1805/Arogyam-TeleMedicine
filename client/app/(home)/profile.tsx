import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { useColorScheme } from "nativewind";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { loadAuthUser, clearAuthUser } from "@/utils/auth-storage";
import { appointments } from "@/utils/api";
import { rehabApi } from "@/utils/rehabApi";
import type { AuthUser } from "@/utils/api";

export default function ProfileScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? "#818CF8" : "#6366F1";

  const [user, setUser] = useState<AuthUser | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [aptCount, setAptCount] = useState(0);
  const [rehabCount, setRehabCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const loadData = useCallback(async () => {
    const u = await loadAuthUser();
    setUser(u);
    if (!u?.patientProfile?.id) { setStatsLoading(false); return; }

    try {
      const [aptRes, rehabRes] = await Promise.allSettled([
        appointments.listForPatient(u.patientProfile.id),
        rehabApi.getPlans(u.patientProfile.id),
      ]);
      if (aptRes.status === "fulfilled") setAptCount(aptRes.value.count);
      if (rehabRes.status === "fulfilled") setRehabCount(rehabRes.value.plans.length);
    } catch {
      /* stats are non-critical */
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await clearAuthUser();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  };

  const profile = user?.patientProfile;
  const initials = profile?.fullName
    ? profile.fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? "?").toUpperCase();

  const blurCardStyle = {
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

      <ScrollView
        contentContainerStyle={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 100, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page title ── */}
        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <Text style={{ fontFamily: "NeueBold", fontSize: 22, color: isDark ? "#fff" : "#111827", marginBottom: 2 }}>
            Profile
          </Text>
          <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280" }}>
            Your account & preferences
          </Text>
        </Animated.View>

        {/* ── Avatar + Identity card ── */}
        <Animated.View entering={FadeInDown.delay(140).springify()}>
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCardStyle}>
            <View style={{ padding: 20, flexDirection: "row", alignItems: "center", gap: 16 }}>
              {/* Avatar */}
              <View style={{ position: "relative" }}>
                <LinearGradient
                  colors={["#6366f1", "#818cf8"]}
                  style={{ width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontFamily: "NeueBold", fontSize: 26, color: "#fff" }}>{initials}</Text>
                </LinearGradient>
                <View style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: "#10b981",
                  borderWidth: 2, borderColor: isDark ? "#1e1b4b" : "#fff",
                }} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "NeueBold", fontSize: 18, color: isDark ? "#fff" : "#111827" }}>
                  {profile?.fullName ?? "Patient"}
                </Text>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280", marginTop: 2 }}>
                  {user?.email ?? ""}
                </Text>
                {user?.phone && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                    <FontAwesome name="phone" size={11} color="#9ca3af" />
                    <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>
                      {user.phone}
                    </Text>
                  </View>
                )}
                {profile?.city && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
                    <FontAwesome name="map-marker" size={11} color="#9ca3af" />
                    <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>
                      {profile.city}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={{
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.1)",
                  borderRadius: 12, padding: 10,
                }}
              >
                <FontAwesome name="pencil" size={14} color={primaryColor} />
              </TouchableOpacity>
            </View>
          </BlurView>
        </Animated.View>

        {/* ── Stats ── */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: isDark ? "#6b7280" : "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Overview
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatCard
              icon="calendar-check-o"
              label="Appointments"
              value={statsLoading ? "—" : String(aptCount)}
              color="#6366f1"
              isDark={isDark}
              onPress={() => {}}
            />
            <StatCard
              icon="heartbeat"
              label="Rehab Plans"
              value={statsLoading ? "—" : String(rehabCount)}
              color="#10b981"
              isDark={isDark}
              onPress={() => {}}
            />
            <StatCard
              icon="stethoscope"
              label="Doctors"
              value="∞"
              color="#f59e0b"
              isDark={isDark}
              onPress={() => router.push("/(home)/search-doctors")}
            />
          </View>
        </Animated.View>

        {/* ── Quick actions ── */}
        <Animated.View entering={FadeInUp.delay(240).springify()}>
          <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: isDark ? "#6b7280" : "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Quick Actions
          </Text>
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCardStyle}>
            <SettingRow
              icon="calendar"
              iconColor="#6366f1"
              label="My Appointments"
              isDark={isDark}
              onPress={() => router.push("/(home)/appointments")}
              showChevron
            />
            <Divider isDark={isDark} />
            <SettingRow
              icon="heartbeat"
              iconColor="#10b981"
              label="My Rehab Plans"
              isDark={isDark}
              onPress={() => router.push("/(home)/rehab")}
              showChevron
            />
            <Divider isDark={isDark} />
            <SettingRow
              icon="user-md"
              iconColor="#f59e0b"
              label="Find a Doctor"
              isDark={isDark}
              onPress={() => router.push("/(home)/search-doctors")}
              showChevron
            />
          </BlurView>
        </Animated.View>

        {/* ── Preferences ── */}
        <Animated.View entering={FadeInUp.delay(290).springify()}>
          <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: isDark ? "#6b7280" : "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Preferences
          </Text>
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCardStyle}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#6366f120", alignItems: "center", justifyContent: "center" }}>
                  <FontAwesome name={isDark ? "moon-o" : "sun-o"} size={15} color="#6366f1" />
                </View>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 15, color: isDark ? "#fff" : "#111827" }}>
                  Dark Mode
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={(val) => setColorScheme(val ? "dark" : "light")}
                trackColor={{ false: "#d1d5db", true: "#6366f1" }}
                thumbColor="#fff"
              />
            </View>
            <Divider isDark={isDark} />
            <View style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#f59e0b20", alignItems: "center", justifyContent: "center" }}>
                  <FontAwesome name="bell" size={15} color="#f59e0b" />
                </View>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 15, color: isDark ? "#fff" : "#111827" }}>
                  Notifications
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: "#d1d5db", true: "#6366f1" }}
                thumbColor="#fff"
              />
            </View>
          </BlurView>
        </Animated.View>

        {/* ── Account ── */}
        <Animated.View entering={FadeInUp.delay(340).springify()}>
          <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: isDark ? "#6b7280" : "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Account
          </Text>
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCardStyle}>
            <SettingRow
              icon="lock"
              iconColor="#8b5cf6"
              label="Change Password"
              isDark={isDark}
              onPress={() => {}}
              showChevron
            />
            <Divider isDark={isDark} />
            <SettingRow
              icon="shield"
              iconColor="#0ea5e9"
              label="Privacy & Data"
              isDark={isDark}
              onPress={() => {}}
              showChevron
            />
            <Divider isDark={isDark} />
            <SettingRow
              icon="question-circle"
              iconColor="#6b7280"
              label="Help & Support"
              isDark={isDark}
              onPress={() => {}}
              showChevron
            />
          </BlurView>
        </Animated.View>

        {/* ── Sign Out ── */}
        <Animated.View entering={FadeInUp.delay(380).springify()}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleSignOut}>
            <BlurView
              intensity={isDark ? 40 : 60}
              tint={isDark ? "dark" : "light"}
              style={{ ...blurCardStyle, borderColor: "rgba(239,68,68,0.25)" }}
            >
              <View style={{ paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#ef444420", alignItems: "center", justifyContent: "center" }}>
                  <FontAwesome name="sign-out" size={15} color="#ef4444" />
                </View>
                <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: "#ef4444" }}>
                  Sign Out
                </Text>
              </View>
            </BlurView>
          </TouchableOpacity>
        </Animated.View>

        {/* ── App version ── */}
        <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#374151" : "#d1d5db", textAlign: "center" }}>
          Arogyam v1.0 · Patient App
        </Text>
      </ScrollView>
    </View>
  );
}

/* ── Sub-components ── */

function StatCard({
  icon, label, value, color, isDark, onPress,
}: {
  icon: string; label: string; value: string; color: string;
  isDark: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.8} onPress={onPress}>
      <BlurView
        intensity={isDark ? 40 : 60}
        tint={isDark ? "dark" : "light"}
        style={{ borderRadius: 16, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)", overflow: "hidden" }}
      >
        <View style={{ padding: 14, alignItems: "center", gap: 6 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${color}20`, alignItems: "center", justifyContent: "center" }}>
            <FontAwesome name={icon as any} size={16} color={color} />
          </View>
          <Text style={{ fontFamily: "NeueBold", fontSize: 20, color: isDark ? "#fff" : "#111827" }}>
            {value}
          </Text>
          <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: isDark ? "#9ca3af" : "#6b7280", textAlign: "center" }}>
            {label}
          </Text>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}

function SettingRow({
  icon, iconColor, label, isDark, onPress, showChevron = false,
}: {
  icon: string; iconColor: string; label: string;
  isDark: boolean; onPress: () => void; showChevron?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${iconColor}20`, alignItems: "center", justifyContent: "center" }}>
        <FontAwesome name={icon as any} size={15} color={iconColor} />
      </View>
      <Text style={{ fontFamily: "NeueRegular", fontSize: 15, color: isDark ? "#fff" : "#111827", flex: 1 }}>
        {label}
      </Text>
      {showChevron && <FontAwesome name="chevron-right" size={12} color="#9ca3af" />}
    </TouchableOpacity>
  );
}

function Divider({ isDark }: { isDark: boolean }) {
  return (
    <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", marginLeft: 60 }} />
  );
}
