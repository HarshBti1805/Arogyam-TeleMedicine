import React, { useEffect, useCallback } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
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
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { TextInput, Button, HelperText } from "react-native-paper";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useNavigation } from "@react-navigation/native";
import { auth, ApiError } from "@/utils/api";
import { saveAuthUser } from "@/utils/auth-storage";

SplashScreen.preventAutoHideAsync();

export default function LoginScreen() {
  const [fontsLoaded] = useAppFonts();
  const { colorScheme } = useColorScheme();
  const navigation = useNavigation();
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? "#818CF8" : "#6366F1";

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Form state
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleLogin = React.useCallback(async () => {
    setErrorMsg(null);
    if (!email.trim() || !password) {
      setErrorMsg("Please enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const { user } = await auth.loginPatient(email.trim(), password);
      await saveAuthUser(user);
      router.replace("/(home)/home");
    } catch (e) {
      setErrorMsg(
        e instanceof ApiError
          ? e.message
          : "Could not sign in. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [email, password]);

  // Animations
  const floatAnim = useSharedValue(0);
  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    // Floating animation for logo
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

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      onLayout={onLayoutRootView}
    >
      <View className="flex-1">
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
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center px-5 py-12">
            {/* Logo Section */}
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              style={[animatedFloatStyle]}
              className="items-center mb-8 "
            >
              <View
                style={{
                  shadowColor: primaryColor,
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.5,
                  shadowRadius: 20,
                  elevation: 10,
                  backgroundColor: isDark
                    ? "rgba(129, 140, 248, 0.2)"
                    : "rgba(99, 102, 241, 0.1)",
                }}
                className="w-24 h-24 rounded-3xl justify-center items-center mb-4"
              >
                <IconSymbol
                  size={50}
                  color={primaryColor}
                  name="lock.shield.fill"
                />
              </View>
              <Text
                style={{ fontFamily: "NeueRegular" }}
                className="text-4xl text-neutral-900 dark:text-white tracking-tighter mb-2"
              >
                Welcome Back
              </Text>
              <Text style={{ fontFamily: "NeueRegular" }}>
                Sign in to continue to Arogyam
              </Text>
            </Animated.View>

            {/* Login Form Card */}
            <Animated.View entering={FadeInUp.delay(400).springify()}>
              <BlurView
                intensity={isDark ? 40 : 60}
                tint={isDark ? "dark" : "light"}
                style={{
                  overflow: "hidden",
                  borderRadius: 32,
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.5)",
                }}
              >
                <View className="p-6 gap-4">
                  {/* Email Input */}
                  <View>
                    <TextInput
                      label="Email"
                      value={email}
                      onChangeText={setEmail}
                      mode="outlined"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      left={
                        <TextInput.Icon
                          icon={() => (
                            <IconSymbol
                              size={20}
                              color={isDark ? "#9ca3af" : "#6b7280"}
                              name="envelope.fill"
                            />
                          )}
                        />
                      }
                      style={{
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(255,255,255,0.8)",
                      }}
                      contentStyle={{
                        color: isDark ? "#fff" : "#000",
                      }}
                      theme={{
                        colors: {
                          primary: primaryColor,
                          outline: isDark
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(0,0,0,0.2)",
                          onSurface: isDark ? "#fff" : "#000",
                        },
                      }}
                    />
                  </View>

                  {/* Password Input */}
                  <View>
                    <TextInput
                      label="Password"
                      value={password}
                      onChangeText={setPassword}
                      mode="outlined"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password"
                      left={
                        <TextInput.Icon
                          icon={() => (
                            <IconSymbol
                              size={20}
                              color={isDark ? "#9ca3af" : "#6b7280"}
                              name="lock.fill"
                            />
                          )}
                        />
                      }
                      right={
                        <TextInput.Icon
                          icon={() => (
                            <IconSymbol
                              size={20}
                              color={isDark ? "#9ca3af" : "#6b7280"}
                              name={
                                showPassword ? "eye.slash.fill" : "eye.fill"
                              }
                            />
                          )}
                          onPress={() => setShowPassword(!showPassword)}
                        />
                      }
                      style={{
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(255,255,255,0.8)",
                      }}
                      contentStyle={{
                        color: isDark ? "#fff" : "#000",
                      }}
                      theme={{
                        colors: {
                          primary: primaryColor,
                          outline: isDark
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(0,0,0,0.2)",
                          onSurface: isDark ? "#fff" : "#000",
                        },
                      }}
                    />
                  </View>

                  {/* Forgot Password Link */}
                  <Animated.View
                    entering={FadeInUp.delay(600)}
                    className="items-end"
                  >
                    <Text className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                      Forgot Password?
                    </Text>
                  </Animated.View>

                  {/* Login Button */}
                  <Animated.View entering={FadeInUp.delay(700).springify()}>
                    <LinearGradient
                      colors={
                        isDark ? ["#4f46e5", "#4338ca"] : ["#6366f1", "#4f46e5"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        borderRadius: 16,
                        overflow: "hidden",
                        shadowColor: "#4f46e5",
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.3,
                        shadowRadius: 16,
                        elevation: 8,
                      }}
                    >
                      <Button
                        mode="contained"
                        onPress={handleLogin}
                        loading={submitting}
                        disabled={submitting}
                        style={{
                          paddingVertical: 8,
                          backgroundColor: "transparent",
                        }}
                        contentStyle={{
                          paddingVertical: 8,
                        }}
                        labelStyle={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: "#fff",
                        }}
                      >
                        {submitting ? "Signing in..." : "Sign In"}
                      </Button>
                    </LinearGradient>
                    {errorMsg ? (
                      <HelperText type="error" visible style={{ marginTop: 4 }}>
                        {errorMsg}
                      </HelperText>
                    ) : null}
                  </Animated.View>

                  {/* Divider */}
                  <Animated.View
                    entering={FadeInUp.delay(800)}
                    className="flex-row items-center gap-4 my-2"
                  >
                    <View className="flex-1 h-px bg-neutral-300 dark:bg-neutral-700" />
                    <Text className="text-sm text-neutral-500 dark:text-neutral-400">
                      OR
                    </Text>
                    <View className="flex-1 h-px bg-neutral-300 dark:bg-neutral-700" />
                  </Animated.View>

                  {/* Social Login Buttons */}
                  <Animated.View
                    entering={FadeInUp.delay(900)}
                    className="flex-row gap-3"
                  >
                    <View className="flex-1">
                      <Button
                        mode="outlined"
                        onPress={() => {}}
                        icon={() => (
                          <IconSymbol
                            size={20}
                            color={isDark ? "#fff" : "#000"}
                            name="apple.logo"
                          />
                        )}
                        style={{
                          borderColor: isDark
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(0,0,0,0.2)",
                        }}
                        contentStyle={{
                          paddingVertical: 8,
                        }}
                        labelStyle={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: isDark ? "#fff" : "#000",
                        }}
                      >
                        Apple
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button
                        mode="outlined"
                        onPress={() => {}}
                        icon={() => (
                          <IconSymbol
                            size={20}
                            color={isDark ? "#fff" : "#000"}
                            name="globe"
                          />
                        )}
                        style={{
                          borderColor: isDark
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(0,0,0,0.2)",
                        }}
                        contentStyle={{
                          paddingVertical: 8,
                        }}
                        labelStyle={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: isDark ? "#fff" : "#000",
                        }}
                      >
                        Google
                      </Button>
                    </View>
                  </Animated.View>
                </View>
              </BlurView>
            </Animated.View>

            {/* Sign Up Link */}
            <Animated.View
              entering={FadeInUp.delay(1000)}
              className="flex-row justify-center items-center mt-6 gap-2"
            >
              <Text className="text-base text-neutral-600 dark:text-neutral-300">
                Don&apos;t have an account?
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("register" as never)}
              >
                <Text className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                  Sign Up
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
