import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useColorScheme } from "nativewind";
import * as SplashScreen from "expo-splash-screen";
import { useAppFonts } from "@/utils/fonts";
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { IconSymbol } from "@/components/ui/icon-symbol";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { clearAuthUser } from "@/utils/auth-storage";

SplashScreen.preventAutoHideAsync();

export default function HomeScreen() {
  const [fontsLoaded] = useAppFonts();

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? "#818CF8" : "#6366F1";

  // Animations
  const floatAnim = useSharedValue(0);
  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    // Floating animation
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Pulse animation for background
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const animatedFloatStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: floatAnim.value }],
    };
  });

  const animatedPulseStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulseAnim.value, [0, 1], [1, 1.05]);
    const opacity = interpolate(pulseAnim.value, [0, 1], [0.3, 0.5]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  // Feature cards data
  const features = [
    {
      id: 1,
      title: "Video Consult",
      description: "Connect with doctors instantly",
      icon: "video.fill",
      color: "#10b981",
    },
    {
      id: 2,
      title: "Prescriptions",
      description: "View your medications",
      icon: "doc.text.fill",
      color: "#3b82f6",
    },
    {
      id: 3,
      title: "Health Records",
      description: "Access your medical history",
      icon: "folder.fill",
      color: "#8b5cf6",
    },
    {
      id: 4,
      title: "Lab Reports",
      description: "Check test results",
      icon: "chart.bar.fill",
      color: "#f59e0b",
    },
  ];

  // Quick actions
  const quickActions = [
    { id: 1, title: "Book Appointment", icon: "calendar", color: primaryColor },
    { id: 2, title: "Find Doctor", icon: "stethoscope", color: "#10b981" },
    { id: 3, title: "Emergency", icon: "cross.case.fill", color: "#ef4444" },
  ];

  return (
    <View className="flex-1" onLayout={onLayoutRootView}>
      {/* Dynamic Background Gradient */}
      <LinearGradient
        colors={
          isDark
            ? ["#0f172a", "#1e1b4b", "#312e81"]
            : ["#f8fafc", "#e0e7ff", "#c7d2fe"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient Background Blobs */}
      <Animated.View
        style={[
          animatedPulseStyle,
          {
            position: "absolute",
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: 200,
            backgroundColor: isDark ? "#4f46e5" : "#818cf8",
          },
        ]}
      />
      <Animated.View
        style={[
          animatedPulseStyle,
          {
            position: "absolute",
            bottom: -50,
            left: -100,
            width: 300,
            height: 300,
            borderRadius: 150,
            backgroundColor: isDark ? "#818cf8" : "#4f46e5",
          },
        ]}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={[animatedFloatStyle]}
          className="px-6 pt-16 pb-6"
        >
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text
                style={{ fontFamily: "NeueRegular" }}
                className="text-2xl text-neutral-600 dark:text-neutral-300"
              >
                Good Morning
              </Text>
              <Text
                style={{ fontFamily: "NeueBold" }}
                className="text-3xl text-neutral-900 dark:text-white mt-1"
              >
                Welcome Back!
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={async () => {
                  await clearAuthUser();
                  router.replace("/(auth)/login");
                }}
                style={{
                  shadowColor: primaryColor,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                  minWidth: 80,
                }}
                className="px-4 py-2 rounded-full justify-center items-center"
              >
                <BlurView
                  intensity={isDark ? 40 : 60}
                  tint={isDark ? "dark" : "light"}
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    borderRadius: 20,
                    overflow: "hidden",
                  }}
                />
                <Text
                  style={{ fontFamily: "NeueRegular" }}
                  className="text-sm font-semibold text-indigo-600 dark:text-indigo-400"
                >
                  Logout
                </Text>
              </TouchableOpacity>
              {/* <TouchableOpacity
                style={{
                  shadowColor: primaryColor,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                }}
                className="w-12 h-12 rounded-full justify-center items-center"
              >
                <BlurView
                  intensity={isDark ? 40 : 60}
                  tint={isDark ? "dark" : "light"}
                  style={{
                    position: "absolute",
                    width: "100%",
                    height: "100%",
                    borderRadius: 24,
                    overflow: "hidden",
                  }}
                />
                <AntDesign name="bell" size={20} color={primaryColor} />
              </TouchableOpacity> */}
            </View>
          </View>
        </Animated.View>

        {/* Stats Cards */}
        <Animated.View
          entering={FadeInUp.delay(300).springify()}
          className="px-6 mb-6"
        >
          <View className="flex-row gap-3">
            <View className="flex-1">
              <BlurView
                intensity={isDark ? 40 : 60}
                tint={isDark ? "dark" : "light"}
                style={{
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.5)",
                  overflow: "hidden",
                }}
              >
                <View className="p-4">
                  <Text
                    style={{ fontFamily: "NeueBold" }}
                    className="text-2xl text-neutral-900 dark:text-white mb-1"
                  >
                    12
                  </Text>
                  <Text
                    style={{ fontFamily: "NeueRegular" }}
                    className="text-sm text-neutral-600 dark:text-neutral-400"
                  >
                    Appointments
                  </Text>
                </View>
              </BlurView>
            </View>
            <View className="flex-1">
              <BlurView
                intensity={isDark ? 40 : 60}
                tint={isDark ? "dark" : "light"}
                style={{
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.5)",
                  overflow: "hidden",
                }}
              >
                <View className="p-4">
                  <Text
                    style={{ fontFamily: "NeueBold" }}
                    className="text-2xl text-neutral-900 dark:text-white mb-1"
                  >
                    5
                  </Text>
                  <Text
                    style={{ fontFamily: "NeueRegular" }}
                    className="text-sm text-neutral-600 dark:text-neutral-400"
                  >
                    Prescriptions
                  </Text>
                </View>
              </BlurView>
            </View>
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View
          entering={FadeInUp.delay(400).springify()}
          className="px-6 mb-6"
        >
          <Text
            style={{ fontFamily: "NeueBold" }}
            className="text-xl text-neutral-900 dark:text-white mb-4"
          >
            Quick Actions
          </Text>
          <View className="flex-row gap-3">
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={action.id}
                style={{ flex: 1 }}
                activeOpacity={0.7}
              >
                <BlurView
                  intensity={isDark ? 40 : 60}
                  tint={isDark ? "dark" : "light"}
                  style={{
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(255,255,255,0.5)",
                    overflow: "hidden",
                  }}
                >
                  <View className="p-4 items-center">
                    <View
                      style={{
                        backgroundColor: `${action.color}20`,
                        borderRadius: 16,
                        padding: 12,
                        marginBottom: 8,
                      }}
                    >
                      {/* <IconSymbol
                        size={24}
                        color={action.color}
                        name={action.icon}
                      /> */}
                    </View>
                    <Text
                      style={{ fontFamily: "NeueRegular" }}
                      className="text-xs text-center text-neutral-900 dark:text-white"
                      numberOfLines={2}
                    >
                      {action.title}
                    </Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Features Grid */}
        <Animated.View
          entering={FadeInUp.delay(500).springify()}
          className="px-6 mb-6"
        >
          <Text
            style={{ fontFamily: "NeueBold" }}
            className="text-xl text-neutral-900 dark:text-white mb-4"
          >
            Services
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {features.map((feature, index) => (
              <TouchableOpacity
                key={feature.id}
                style={{ width: "47%" }}
                activeOpacity={0.7}
              >
                <BlurView
                  intensity={isDark ? 40 : 60}
                  tint={isDark ? "dark" : "light"}
                  style={{
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(255,255,255,0.5)",
                    overflow: "hidden",
                  }}
                >
                  <View className="p-5">
                    <View
                      style={{
                        backgroundColor: `${feature.color}20`,
                        borderRadius: 16,
                        padding: 12,
                        width: 56,
                        height: 56,
                        justifyContent: "center",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      {/* <IconSymbol
                        size={28}
                        color={feature.color}
                        name={feature.icon}
                      /> */}
                    </View>
                    <Text
                      style={{ fontFamily: "NeueBold" }}
                      className="text-base text-neutral-900 dark:text-white mb-1"
                    >
                      {feature.title}
                    </Text>
                    <Text
                      style={{ fontFamily: "NeueRegular" }}
                      className="text-xs text-neutral-600 dark:text-neutral-400"
                    >
                      {feature.description}
                    </Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Upcoming Appointments */}
        <Animated.View
          entering={FadeInUp.delay(600).springify()}
          className="px-6"
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text
              style={{ fontFamily: "NeueBold" }}
              className="text-xl text-neutral-900 dark:text-white"
            >
              Upcoming Appointments
            </Text>
            <TouchableOpacity>
              <Text
                style={{ fontFamily: "NeueRegular" }}
                className="text-sm text-indigo-600 dark:text-indigo-400"
              >
                View All
              </Text>
            </TouchableOpacity>
          </View>
          <BlurView
            intensity={isDark ? 40 : 60}
            tint={isDark ? "dark" : "light"}
            style={{
              borderRadius: 24,
              borderWidth: 1,
              borderColor: isDark
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.5)",
              overflow: "hidden",
            }}
          >
            <View className="p-5">
              <View className="flex-row items-center gap-4">
                <View
                  style={{
                    backgroundColor: `${primaryColor}20`,
                    borderRadius: 16,
                    padding: 12,
                  }}
                >
                  <IconSymbol size={24} color={primaryColor} name="calendar" />
                </View>
                <View className="flex-1">
                  <Text
                    style={{ fontFamily: "NeueBold" }}
                    className="text-base text-neutral-900 dark:text-white mb-1"
                  >
                    Dr. Sarah Johnson
                  </Text>
                  <Text
                    style={{ fontFamily: "NeueRegular" }}
                    className="text-sm text-neutral-600 dark:text-neutral-400 mb-1"
                  >
                    General Physician
                  </Text>
                  <Text
                    style={{ fontFamily: "NeueRegular" }}
                    className="text-xs text-neutral-500 dark:text-neutral-500"
                  >
                    Today, 2:00 PM
                  </Text>
                </View>
                <FontAwesome
                  name="chevron-right"
                  size={16}
                  color={isDark ? "#9ca3af" : "#6b7280"}
                />
              </View>
            </View>
          </BlurView>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
