import React, { useEffect, useCallback, useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
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
import AntDesign from "@expo/vector-icons/AntDesign";
import { router } from "expo-router";
import { auth, ApiError } from "@/utils/api";
import { saveAuthUser } from "@/utils/auth-storage";

SplashScreen.preventAutoHideAsync();

export default function RegisterScreen() {
  const navigation = useNavigation();
  const [fontsLoaded] = useAppFonts();

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? "#818CF8" : "#6366F1";

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleRegister = useCallback(async () => {
    setErrorMsg(null);
    if (!name.trim() || !email.trim() || !password) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (!termsAccepted) {
      setErrorMsg("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const { user } = await auth.registerPatient({
        email: email.trim(),
        password,
        fullName: name.trim(),
      });
      await saveAuthUser(user);
      router.replace("/(home)/home");
    } catch (e) {
      if (e instanceof ApiError) {
        setErrorMsg(e.message);
      } else if (e instanceof TypeError && String(e.message).includes("Network")) {
        setErrorMsg("Cannot reach the server. Make sure you're on the same Wi-Fi network and the server is running.");
      } else {
        setErrorMsg("Registration failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [name, email, password, confirmPassword, termsAccepted]);

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
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center px-6 py-8">
            {/* Logo Section */}
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              style={[animatedFloatStyle]}
              className="items-center mb-6"
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
                <AntDesign name="cloud" size={50} color={primaryColor} />
              </View>
              <Text
                style={{ fontFamily: "NeueRegular" }}
                className="text-4xl text-neutral-900 dark:text-white tracking-tighter mb-2 text-center"
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                Create Account
              </Text>
              <Text
                style={{ fontFamily: "NeueRegular" }}
                className="text-base text-neutral-600 dark:text-neutral-300 text-center px-2"
                numberOfLines={2}
              >
                Join Arogyam and start your journey
              </Text>
            </Animated.View>

            {/* Register Form Card */}
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
                  {/* Name Input */}
                  <View>
                    <TextInput
                      label="Full Name"
                      value={name}
                      onChangeText={setName}
                      mode="outlined"
                      autoCapitalize="words"
                      autoComplete="name"
                      left={
                        <TextInput.Icon
                          icon={() => (
                            <IconSymbol
                              size={20}
                              color={isDark ? "#9ca3af" : "#6b7280"}
                              name="person.fill"
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
                      autoComplete="password-new"
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

                  {/* Confirm Password Input */}
                  <View>
                    <TextInput
                      label="Confirm Password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      mode="outlined"
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoComplete="password-new"
                      left={
                        <TextInput.Icon
                          icon={() => (
                            <IconSymbol
                              size={20}
                              color={isDark ? "#9ca3af" : "#6b7280"}
                              name="lock.shield.fill"
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
                                showConfirmPassword
                                  ? "eye.slash.fill"
                                  : "eye.fill"
                              }
                            />
                          )}
                          onPress={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
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

                  {/* Terms and Conditions */}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      setTermsAccepted((v) => !v);
                      setErrorMsg(null);
                    }}
                    style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
                  >
                    {/* Checkbox */}
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: termsAccepted
                          ? primaryColor
                          : isDark
                          ? "rgba(255,255,255,0.3)"
                          : "rgba(99,102,241,0.5)",
                        backgroundColor: termsAccepted
                          ? primaryColor
                          : "transparent",
                        justifyContent: "center",
                        alignItems: "center",
                        marginTop: 1,
                        flexShrink: 0,
                      }}
                    >
                      {termsAccepted && (
                        <AntDesign name="check" size={13} color="#fff" />
                      )}
                    </View>
                    <Text
                      className="text-sm text-neutral-600 dark:text-neutral-300 flex-1 leading-5"
                      style={{ fontFamily: "NeueRegular" }}
                    >
                      By creating an account, you agree to our{" "}
                      <Text className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        Terms of Service
                      </Text>{" "}
                      and{" "}
                      <Text className="text-indigo-600 dark:text-indigo-400 font-semibold">
                        Privacy Policy
                      </Text>
                    </Text>
                  </TouchableOpacity>

                  {/* Register Button */}
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
                        onPress={handleRegister}
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
                        <Text style={{ fontFamily: "NeueRegular" }}>
                          {submitting ? "Creating..." : "Create Account"}
                        </Text>
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

            {/* Sign In Link */}
            <Animated.View
              entering={FadeInUp.delay(1000)}
              className="flex-row justify-center items-center mt-6 gap-2"
            >
              <Text className="text-base text-neutral-600 dark:text-neutral-300">
                Already have an account?
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("login" as never)}
              >
                <Text className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                  Sign In
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
