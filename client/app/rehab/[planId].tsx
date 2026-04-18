import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { rehabApi, type RehabPlan, type RehabExercise } from "@/utils/rehabApi";

const STATUS_META: Record<string, { color: string; icon: string }> = {
  ACTIVE:    { color: "#10b981", icon: "play-circle" },
  PAUSED:    { color: "#f59e0b", icon: "pause-circle" },
  COMPLETED: { color: "#6366f1", icon: "check-circle" },
  CANCELLED: { color: "#ef4444", icon: "times-circle" },
};

const JOINT_COLORS: Record<string, string> = {
  KNEE: "#6366f1",
  SHOULDER: "#10b981",
  HIP: "#f59e0b",
  ANKLE: "#8b5cf6",
  ELBOW: "#0ea5e9",
  WRIST: "#ec4899",
  SPINE: "#ef4444",
};

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? "#818CF8" : "#6366F1";

  const [plan, setPlan] = useState<RehabPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rehabApi
      .getPlan(planId)
      .then(({ plan: p }) => setPlan(p))
      .catch((e) => setError(e.message ?? "Failed to load plan."))
      .finally(() => setLoading(false));
  }, [planId]);

  const handleStartSession = async (exercise: RehabExercise) => {
    if (!plan) return;
    try {
      const { session } = await rehabApi.startSession(planId, exercise.id, plan.patientId);
      router.push(`/rehab/session/${session.id}?exerciseId=${exercise.id}&planId=${planId}`);
    } catch (e: any) {
      setError(e.message ?? "Could not start session.");
    }
  };

  const completedSessions = (plan?.sessions ?? []).filter((s) => s.status === "COMPLETED").length;
  const totalExercises = plan?.exercises.length ?? 0;
  const progress = totalExercises ? Math.min(100, Math.round((completedSessions / totalExercises) * 100)) : 0;

  const blurCard = {
    borderRadius: 20 as const,
    borderWidth: 1,
    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)",
    overflow: "hidden" as const,
  };

  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={isDark ? ["#0f172a", "#1e1b4b", "#312e81"] : ["#f8fafc", "#e0e7ff", "#c7d2fe"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      </View>
    );
  }

  if (error || !plan) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={isDark ? ["#0f172a", "#1e1b4b", "#312e81"] : ["#f8fafc", "#e0e7ff", "#c7d2fe"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
          <FontAwesome name="exclamation-circle" size={48} color="#ef4444" />
          <Text style={{ fontFamily: "NeueBold", fontSize: 18, color: isDark ? "#fff" : "#111827", textAlign: "center" }}>
            {error ?? "Plan not found"}
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: primaryColor, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: "#fff" }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const meta = STATUS_META[plan.status] ?? { color: "#6b7280", icon: "circle" };
  const startDate = new Date(plan.startedAt).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
  const endDate = plan.endsAt ? new Date(plan.endsAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? ["#0f172a", "#1e1b4b", "#312e81"] : ["#f8fafc", "#e0e7ff", "#c7d2fe"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <Animated.View entering={FadeInDown.delay(80).springify()} style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}
          >
            <FontAwesome name="chevron-left" size={14} color={primaryColor} />
            <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: primaryColor }}>Rehab Plans</Text>
          </TouchableOpacity>

          <Text style={{ fontFamily: "NeueBold", fontSize: 24, color: isDark ? "#fff" : "#111827", marginBottom: 4 }}>
            {plan.title}
          </Text>
          {plan.description ? (
            <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: isDark ? "#9ca3af" : "#6b7280", lineHeight: 20 }}>
              {plan.description}
            </Text>
          ) : null}
        </Animated.View>

        {/* ── Plan info card ── */}
        <Animated.View entering={FadeInDown.delay(140).springify()} style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCard}>
            <View style={{ padding: 18 }}>
              {/* Status + progress */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <FontAwesome name={meta.icon as any} size={18} color={meta.color} />
                  <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: meta.color }}>
                    {plan.status.charAt(0) + plan.status.slice(1).toLowerCase()}
                  </Text>
                </View>
                <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: primaryColor }}>
                  {progress}% done
                </Text>
              </View>

              {/* Progress bar */}
              <View style={{ height: 8, backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", borderRadius: 4 }}>
                <View style={{ height: 8, width: `${progress}%`, backgroundColor: progress === 100 ? "#10b981" : primaryColor, borderRadius: 4 }} />
              </View>

              {/* Meta row */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontFamily: "NeueBold", fontSize: 18, color: isDark ? "#fff" : "#111827" }}>{totalExercises}</Text>
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: isDark ? "#9ca3af" : "#6b7280" }}>Exercises</Text>
                </View>
                <View style={{ width: 1, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }} />
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontFamily: "NeueBold", fontSize: 18, color: isDark ? "#fff" : "#111827" }}>{completedSessions}</Text>
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: isDark ? "#9ca3af" : "#6b7280" }}>Sessions Done</Text>
                </View>
                <View style={{ width: 1, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }} />
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: isDark ? "#fff" : "#111827" }}>{startDate}</Text>
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: isDark ? "#9ca3af" : "#6b7280" }}>Started</Text>
                </View>
              </View>

              {endDate && (
                <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <FontAwesome name="flag-checkered" size={12} color="#9ca3af" />
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>
                    Target completion: {endDate}
                  </Text>
                </View>
              )}
            </View>
          </BlurView>
        </Animated.View>

        {/* ── Exercises ── */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontFamily: "NeueBold", fontSize: 18, color: isDark ? "#fff" : "#111827", marginBottom: 12 }}>
            Exercises
          </Text>

          {plan.exercises.length === 0 ? (
            <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurCard}>
              <View style={{ padding: 32, alignItems: "center", gap: 8 }}>
                <FontAwesome name="list-ul" size={32} color={isDark ? "#4b5563" : "#c7d2fe"} />
                <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: isDark ? "#6b7280" : "#374151" }}>
                  No exercises yet
                </Text>
              </View>
            </BlurView>
          ) : (
            plan.exercises
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((ex, idx) => (
                <ExerciseCard
                  key={ex.id}
                  exercise={ex}
                  index={idx}
                  isDark={isDark}
                  primaryColor={primaryColor}
                  onStart={() => handleStartSession(ex)}
                />
              ))
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ExerciseCard({
  exercise: ex,
  index,
  isDark,
  primaryColor,
  onStart,
}: {
  exercise: RehabExercise;
  index: number;
  isDark: boolean;
  primaryColor: string;
  onStart: () => void;
}) {
  const jointKey = (ex.targetJoint ?? "").toUpperCase().split("_")[0];
  const jointColor = JOINT_COLORS[jointKey] ?? primaryColor;

  return (
    <Animated.View entering={FadeInUp.delay(250 + index * 60).springify()} style={{ marginBottom: 12 }}>
      <BlurView
        intensity={isDark ? 40 : 60}
        tint={isDark ? "dark" : "light"}
        style={{ borderRadius: 20, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)", overflow: "hidden" }}
      >
        <View style={{ padding: 16 }}>
          {/* Title row */}
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${jointColor}20`, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: jointColor }}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: isDark ? "#fff" : "#111827" }}>
                {ex.name}
              </Text>
              {ex.description ? (
                <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280", marginTop: 2, lineHeight: 18 }}>
                  {ex.description}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Tags */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            <ExTag icon="map-marker" color={jointColor} isDark={isDark}>
              {ex.targetJoint.replace(/_/g, " ")}
            </ExTag>
            <ExTag icon="arrows-h" color="#0ea5e9" isDark={isDark}>
              {ex.targetAngleMin}°–{ex.targetAngleMax}°
            </ExTag>
            <ExTag icon="repeat" color="#8b5cf6" isDark={isDark}>
              {ex.reps} reps × {ex.sets} sets
            </ExTag>
            <ExTag icon="clock-o" color="#f59e0b" isDark={isDark}>
              hold {ex.holdDurationSec}s
            </ExTag>
          </View>

          {/* Start button */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={onStart}
            style={{ backgroundColor: primaryColor, borderRadius: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <FontAwesome name="play" size={13} color="#fff" />
            <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: "#fff" }}>
              Start Session
            </Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Animated.View>
  );
}

function ExTag({ icon, color, isDark, children }: {
  icon: string; color: string; isDark: boolean; children: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
      <FontAwesome name={icon as any} size={10} color={color} />
      <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: isDark ? "#d1d5db" : "#374151" }}>
        {children}
      </Text>
    </View>
  );
}
