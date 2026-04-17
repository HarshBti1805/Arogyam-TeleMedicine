import React, { useEffect, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
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
  withDelay,
  Easing,
  interpolate,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import AntDesign from "@expo/vector-icons/AntDesign";

SplashScreen.preventAutoHideAsync();

export default function SplashScreenComponent() {
  const [fontsLoaded] = useAppFonts();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? "#818CF8" : "#6366F1";
  const bgColor = isDark ? "#1e1b4b" : "#e0e7ff";

  // Animation values
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const logoFloat = useSharedValue(0);

  // Loading dots opacity values
  const dotOpacity1 = useSharedValue(1);
  const dotOpacity2 = useSharedValue(1);
  const dotOpacity3 = useSharedValue(1);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    // Logo entrance animation
    scale.value = withDelay(
      200,
      withSequence(
        withTiming(1.2, {
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
        }),
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) })
      )
    );

    opacity.value = withDelay(200, withTiming(1, { duration: 800 }));

    // Continuous floating animation
    logoFloat.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    // Loading dots animations
    dotOpacity1.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );

    dotOpacity2.value = withRepeat(
      withSequence(
        withDelay(200, withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.quad) })),
        withDelay(200, withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }))
      ),
      -1,
      true
    );

    dotOpacity3.value = withRepeat(
      withSequence(
        withDelay(400, withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.quad) })),
        withDelay(400, withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }))
      ),
      -1,
      true
    );

    // Navigate after animations complete
    const timer = setTimeout(() => {
      router.replace("/welcome");
    }, 3000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }, { translateY: logoFloat.value }],
      opacity: opacity.value,
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ translateY: interpolate(opacity.value, [0, 1], [20, 0]) }],
    };
  });

  // Loading dots animated styles
  const dotStyle1 = useAnimatedStyle(() => ({ opacity: dotOpacity1.value }));
  const dotStyle2 = useAnimatedStyle(() => ({ opacity: dotOpacity2.value }));
  const dotStyle3 = useAnimatedStyle(() => ({ opacity: dotOpacity3.value }));

  return (
    <View
      className="flex-1"
      onLayout={onLayoutRootView}
      style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]}
    >
      {/* Main content */}
      <View className="flex-1 justify-center items-center">
        {/* Logo container */}
        <Animated.View style={animatedLogoStyle}>
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 40,
              backgroundColor: isDark
                ? "rgba(129, 140, 248, 0.3)"
                : "rgba(99, 102, 241, 0.2)",
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 2,
              borderColor: primaryColor,
            }}
          >
            <AntDesign name="cloud" size={70} color={primaryColor} />
          </View>
        </Animated.View>

        {/* App name */}
        <Animated.View style={animatedTextStyle} className="mt-8 items-center">
          <Text
            style={{ fontFamily: "NeueRegular" }}
            className="text-5xl font-bold text-neutral-900 dark:text-white tracking-tight"
          >
            Arogyam
          </Text>
          <Text
            style={{ fontFamily: "NeueRegular" }}
            className="text-lg text-neutral-600 dark:text-neutral-400 mt-2"
          >
            Your TeleMedicine Companion
          </Text>
        </Animated.View>

        {/* Loading indicator */}
        <Animated.View entering={FadeIn.delay(1500)} exiting={FadeOut} className="mt-12">
          <View className="flex-row gap-2">
            <Animated.View
              style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: primaryColor }, dotStyle1]}
            />
            <Animated.View
              style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: primaryColor }, dotStyle2]}
            />
            <Animated.View
              style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: primaryColor }, dotStyle3]}
            />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}
