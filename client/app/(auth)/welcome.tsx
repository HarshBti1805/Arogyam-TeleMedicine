import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useColorScheme } from "nativewind";
import { router } from "expo-router";
import { useAppFonts } from "@/utils/fonts";
import * as SplashScreen from "expo-splash-screen";

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeInDown,
  FadeInUp,
  interpolate,
} from "react-native-reanimated";
import AntDesign from "@expo/vector-icons/AntDesign";
import { Feather } from "@expo/vector-icons";

SplashScreen.preventAutoHideAsync();

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen() {
  const [fontsLoaded] = useAppFonts();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? "#818CF8" : "#6366F1";
  const secondaryColor = isDark ? "#A78BFA" : "#8B5CF6";
  const bgColor = isDark ? "#0f172a" : "#f8fafc";

  // Animation values
  const floatAnim = useSharedValue(0);
  const pulseAnim = useSharedValue(0);
  const rotateAnim = useSharedValue(0);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    // Floating animation
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Pulse animation for decorative elements
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Slow rotation for background elements
    rotateAnim.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnim.value }],
  }));

  const animatedPulseStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulseAnim.value, [0, 1], [1, 1.1]);
    const opacity = interpolate(pulseAnim.value, [0, 1], [0.15, 0.25]);
    return { transform: [{ scale }], opacity };
  });

  const animatedRotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateAnim.value}deg` }],
  }));

  return (
    <View
      className="flex-1"
      onLayout={onLayoutRootView}
      style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]}
    >
      {/* Decorative background circles */}
      <Animated.View
        style={[
          animatedPulseStyle,
          {
            position: "absolute",
            top: -height * 0.15,
            right: -width * 0.3,
            width: width * 0.8,
            height: width * 0.8,
            borderRadius: width * 0.4,
            backgroundColor: primaryColor,
          },
        ]}
      />
      <Animated.View
        style={[
          animatedPulseStyle,
          {
            position: "absolute",
            bottom: -height * 0.1,
            left: -width * 0.25,
            width: width * 0.6,
            height: width * 0.6,
            borderRadius: width * 0.3,
            backgroundColor: secondaryColor,
            opacity: 0.12,
          },
        ]}
      />

      {/* Floating decorative icons */}
      <Animated.View
        style={[
          animatedRotateStyle,
          {
            position: "absolute",
            top: height * 0.12,
            left: width * 0.1,
            opacity: 0.15,
          },
        ]}
      >
        <Feather name="heart" size={28} color={primaryColor} />
      </Animated.View>
      <Animated.View
        style={[
          animatedFloatStyle,
          {
            position: "absolute",
            top: height * 0.18,
            right: width * 0.12,
            opacity: 0.15,
          },
        ]}
      >
        <Feather name="activity" size={24} color={secondaryColor} />
      </Animated.View>
      <Animated.View
        style={[
          animatedRotateStyle,
          {
            position: "absolute",
            bottom: height * 0.22,
            right: width * 0.08,
            opacity: 0.12,
          },
        ]}
      >
        <Feather name="shield" size={26} color={primaryColor} />
      </Animated.View>

      <View className="flex-1 justify-center px-8">
        {/* Logo section */}
        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={[animatedFloatStyle]}
          className="items-center mb-10"
        >
          {/* Outer glow ring */}
          <View
            style={{
              width: 160,
              height: 160,
              borderRadius: 48,
              backgroundColor: isDark
                ? "rgba(129, 140, 248, 0.08)"
                : "rgba(99, 102, 241, 0.08)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            {/* Inner container */}
            <View
              style={{
                width: 130,
                height: 130,
                borderRadius: 40,
                backgroundColor: isDark
                  ? "rgba(129, 140, 248, 0.2)"
                  : "rgba(99, 102, 241, 0.15)",
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 2,
                borderColor: isDark
                  ? "rgba(129, 140, 248, 0.3)"
                  : "rgba(99, 102, 241, 0.2)",
              }}
            >
              <AntDesign name="medicine-box" size={65} color={primaryColor} />
            </View>
          </View>
        </Animated.View>

        {/* Welcome text */}
        <Animated.View entering={FadeInUp.delay(400).springify()}>
          <Text
            style={{ fontFamily: "NeueBold" }}
            className="text-4xl text-neutral-800 dark:text-neutral-100 tracking-tight mb-2 text-center"
          >
            Welcome to
          </Text>
          <Text
            style={{ 
              fontFamily: "NeueBold",
              color: primaryColor,
            }}
            className="text-5xl tracking-tight mb-5 text-center"
          >
            Arogyam
          </Text>
          <Text
            style={{ fontFamily: "NeueRegular", lineHeight: 26 }}
            className="text-base text-neutral-500 dark:text-neutral-400 text-center px-2"
          >
            Your trusted companion for seamless telemedicine experiences.
            Connect with healthcare professionals from anywhere, anytime.
          </Text>
        </Animated.View>

        {/* Feature highlights */}
        <Animated.View
          entering={FadeInUp.delay(500).springify()}
          className="mt-8 mb-10"
        >
          <View className="flex-row justify-center gap-6">
            <View className="items-center">
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  backgroundColor: isDark
                    ? "rgba(129, 140, 248, 0.15)"
                    : "rgba(99, 102, 241, 0.1)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Feather name="video" size={22} color={primaryColor} />
              </View>
              <Text
                style={{ fontFamily: "NeueRegular" }}
                className="text-xs text-neutral-500 dark:text-neutral-400"
              >
                Video Calls
              </Text>
            </View>
            <View className="items-center">
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  backgroundColor: isDark
                    ? "rgba(167, 139, 250, 0.15)"
                    : "rgba(139, 92, 246, 0.1)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Feather name="calendar" size={22} color={secondaryColor} />
              </View>
              <Text
                style={{ fontFamily: "NeueRegular" }}
                className="text-xs text-neutral-500 dark:text-neutral-400"
              >
                Appointments
              </Text>
            </View>
            <View className="items-center">
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  backgroundColor: isDark
                    ? "rgba(129, 140, 248, 0.15)"
                    : "rgba(99, 102, 241, 0.1)",
                  justifyContent: "center",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Feather name="file-text" size={22} color={primaryColor} />
              </View>
              <Text
                style={{ fontFamily: "NeueRegular" }}
                className="text-xs text-neutral-500 dark:text-neutral-400"
              >
                Health Records
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Action buttons */}
        <Animated.View
          entering={FadeInUp.delay(600).springify()}
          className="gap-4"
        >
          <TouchableOpacity
            onPress={() => router.push("/onboarding")}
            activeOpacity={0.85}
            style={{
              backgroundColor: primaryColor,
              borderRadius: 16,
              paddingVertical: 18,
              shadowColor: primaryColor,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <View className="flex-row items-center justify-center gap-2">
              <Text
                style={{ fontFamily: "NeueRegular" }}
                className="text-center text-white text-lg font-semibold"
              >
                Get Started
              </Text>
              <Feather name="arrow-right" size={20} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/register")}
            activeOpacity={0.8}
            style={{
              borderRadius: 16,
              paddingVertical: 18,
              borderWidth: 1.5,
              borderColor: isDark
                ? "rgba(129, 140, 248, 0.4)"
                : "rgba(99, 102, 241, 0.3)",
              backgroundColor: isDark
                ? "rgba(129, 140, 248, 0.08)"
                : "rgba(99, 102, 241, 0.05)",
            }}
          >
            <Text
              style={{ fontFamily: "NeueRegular", color: primaryColor }}
              className="text-center text-lg font-semibold"
            >
              Skip to Register
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
