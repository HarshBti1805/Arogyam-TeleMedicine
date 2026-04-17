import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useLocalSearchParams, router } from "expo-router";
import { useColorScheme } from "nativewind";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  doctors,
  appointments,
  paypal,
  fetchRoute,
  formatDistance,
  formatDuration,
  type DoctorPublic,
  type RouteResult,
  type AppointmentType,
} from "@/utils/api";
import { loadAuthUser as loadUser } from "@/utils/auth-storage";

export default function DoctorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primary = isDark ? "#818CF8" : "#6366F1";

  const [doctor, setDoctor] = useState<DoctorPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Location + routing
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Booking modal
  const [bookingOpen, setBookingOpen] = useState(false);

  // Auth
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isFree, setIsFree] = useState<boolean | null>(null);

  // ── Load doctor ──
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await doctors.getById(id);
        setDoctor(data.doctor);
      } catch (e: any) {
        setError(e.message || "Failed to load doctor");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ── Load patient auth + check free ──
  useEffect(() => {
    (async () => {
      const user = await loadUser();
      if (user?.patientProfile?.id) {
        setPatientId(user.patientProfile.id);
        if (id) {
          try {
            const res = await appointments.checkFree(user.patientProfile.id, id);
            setIsFree(res.isFree);
          } catch {
            setIsFree(null);
          }
        }
      }
    })();
  }, [id]);

  // Re-check free status after a booking is confirmed (so subsequent bookings are correct)
  const refreshFreeStatus = useCallback(async () => {
    if (!patientId || !id) return;
    try {
      const res = await appointments.checkFree(patientId, id);
      setIsFree(res.isFree);
    } catch { /* noop */ }
  }, [patientId, id]);

  // ── Get location + route ──
  useEffect(() => {
    if (!doctor?.latitude || !doctor?.longitude) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setUserLocation(loc);

      setRouteLoading(true);
      const r = await fetchRoute(loc.latitude, loc.longitude, doctor.latitude!, doctor.longitude!);
      setRoute(r);
      setRouteLoading(false);
    })();
  }, [doctor]);

  const fee = doctor ? Number(doctor.consultationFee ?? 0) : 0;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#0f172a" : "#f8fafc" }}>
        <ActivityIndicator color={primary} size="large" />
      </View>
    );
  }

  if (error || !doctor) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? "#0f172a" : "#f8fafc" }}>
        <Text style={{ color: "#ef4444", fontFamily: "NeueRegular", textAlign: "center", marginHorizontal: 32 }}>
          {error ?? "Doctor not found"}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: primary, fontFamily: "NeueRegular" }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasLocation = doctor.latitude != null && doctor.longitude != null;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={isDark ? ["#0f172a", "#1e1b4b", "#312e81"] : ["#f8fafc", "#e0e7ff", "#c7d2fe"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ position: "absolute", top: 52, left: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)", justifyContent: "center", alignItems: "center" }}
        >
          <FontAwesome name="arrow-left" size={16} color={isDark ? "#fff" : "#374151"} />
        </TouchableOpacity>

        {/* ── Map section ── */}
        <Animated.View entering={FadeInDown.delay(50)} style={{ height: 240, margin: 16, marginTop: 48, borderRadius: 24, overflow: "hidden" }}>
          {hasLocation ? (
            <MapView
              style={{ flex: 1 }}
              provider={PROVIDER_DEFAULT}
              initialRegion={{
                latitude: doctor.latitude!,
                longitude: doctor.longitude!,
                latitudeDelta: routeLoading || !route ? 0.05 : undefined ?? 0.05,
                longitudeDelta: routeLoading || !route ? 0.05 : undefined ?? 0.05,
              }}
              onMapReady={() => {
                /* fitToCoordinates on ref after route loads */
              }}
              showsUserLocation={!!userLocation}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
            >
              {route && <Polyline coordinates={route.coordinates} strokeColor={primary} strokeWidth={3} />}
              <Marker coordinate={{ latitude: doctor.latitude!, longitude: doctor.longitude! }} title={doctor.fullName} description={doctor.clinicName ?? ""}>
                <View style={{ backgroundColor: primary, borderRadius: 20, borderWidth: 2, borderColor: "#fff", paddingHorizontal: 8, paddingVertical: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontFamily: "NeueBold" }}>Clinic</Text>
                </View>
              </Marker>
            </MapView>
          ) : (
            <View style={{ flex: 1, backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", justifyContent: "center", alignItems: "center" }}>
              <FontAwesome name="map" size={40} color={isDark ? "#4b5563" : "#d1d5db"} />
              <Text style={{ fontFamily: "NeueRegular", color: isDark ? "#6b7280" : "#9ca3af", marginTop: 8 }}>No location set</Text>
            </View>
          )}

          {/* Route stats overlay */}
          {route && (
            <View style={{ position: "absolute", bottom: 10, left: 10, right: 10 }}>
              <BlurView intensity={isDark ? 70 : 85} tint={isDark ? "dark" : "light"} style={{ borderRadius: 16, overflow: "hidden" }}>
                <View style={{ flexDirection: "row", padding: 10, gap: 20, justifyContent: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <FontAwesome name="road" size={13} color={primary} />
                    <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: isDark ? "#fff" : "#111827" }}>{formatDistance(route.distanceM)}</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <FontAwesome name="clock-o" size={13} color="#10b981" />
                    <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: isDark ? "#fff" : "#111827" }}>{formatDuration(route.durationS)} away</Text>
                  </View>
                </View>
              </BlurView>
            </View>
          )}
          {routeLoading && (
            <View style={{ position: "absolute", top: 8, alignSelf: "center", backgroundColor: isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ActivityIndicator size="small" color={primary} />
              <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#fff" : "#374151" }}>Getting route…</Text>
            </View>
          )}
        </Animated.View>

        {/* ── Doctor profile card ── */}
        <Animated.View entering={FadeInUp.delay(100)} style={{ marginHorizontal: 16 }}>
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={{ borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)" }}>
            <View style={{ padding: 20 }}>
              {/* Name + verified */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Text style={{ fontFamily: "NeueBold", fontSize: 22, color: isDark ? "#fff" : "#111827", flex: 1 }}>
                  {doctor.fullName}
                </Text>
                {doctor.isVerified && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#10b98115", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <FontAwesome name="check-circle" size={13} color="#10b981" />
                    <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: "#10b981" }}>Verified</Text>
                  </View>
                )}
              </View>

              <Text style={{ fontFamily: "NeueRegular", fontSize: 15, color: primary, marginBottom: 12 }}>
                {doctor.specialization}
              </Text>

              {/* Stats row */}
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <StatChip icon="clock-o" label={`${doctor.experienceYears} yrs exp`} isDark={isDark} />
                {fee > 0 && <StatChip icon="dollar" label={`$${fee.toFixed(0)}/visit`} isDark={isDark} />}
                {doctor.city && <StatChip icon="map-marker" label={doctor.city} isDark={isDark} />}
                {doctor.distanceKm !== undefined && (
                  <StatChip icon="location-arrow" label={`${doctor.distanceKm.toFixed(1)} km`} isDark={isDark} />
                )}
              </View>

              {/* Clinic info */}
              {(doctor.clinicName || doctor.clinicAddress) && (
                <View style={{ backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", borderRadius: 14, padding: 14, marginBottom: 14 }}>
                  {doctor.clinicName && (
                    <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: isDark ? "#e5e7eb" : "#374151" }}>
                      {doctor.clinicName}
                    </Text>
                  )}
                  {doctor.clinicAddress && (
                    <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280", marginTop: 2 }}>
                      {doctor.clinicAddress}
                    </Text>
                  )}
                </View>
              )}

              {/* Bio */}
              {doctor.bio && (
                <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: isDark ? "#d1d5db" : "#374151", lineHeight: 22 }}>
                  {doctor.bio}
                </Text>
              )}
            </View>
          </BlurView>
        </Animated.View>

        {/* ── Pricing / free badge ── */}
        <Animated.View entering={FadeInUp.delay(180)} style={{ marginHorizontal: 16, marginTop: 14 }}>
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={{ borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)" }}>
            <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: isFree ? "#10b98120" : `${primary}20`, justifyContent: "center", alignItems: "center" }}>
                <FontAwesome name={isFree ? "gift" : "credit-card"} size={20} color={isFree ? "#10b981" : primary} />
              </View>
              <View style={{ flex: 1 }}>
                {isFree === true && (
                  <>
                    <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: "#10b981" }}>
                      🎉 First appointment is FREE
                    </Text>
                    <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280", marginTop: 2 }}>
                      Your first visit with this doctor costs nothing.
                    </Text>
                  </>
                )}
                {isFree === false && fee > 0 && (
                  <>
                    <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: isDark ? "#fff" : "#111827" }}>
                      ${fee.toFixed(2)} per consultation
                    </Text>
                    <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280", marginTop: 2 }}>
                      Pay via PayPal after booking.
                    </Text>
                  </>
                )}
                {isFree === null && (
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280" }}>
                    Sign in as a patient to see pricing.
                  </Text>
                )}
              </View>
            </View>
          </BlurView>
        </Animated.View>
      </ScrollView>

      {/* ── Sticky Book button ── */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <LinearGradient
          colors={isDark ? ["transparent", "rgba(15,23,42,0.97)"] : ["transparent", "rgba(248,250,252,0.97)"]}
          style={{ padding: 20, paddingTop: 30 }}
        >
          <TouchableOpacity
            onPress={() => {
              if (!patientId) {
                Alert.alert("Sign in required", "Please sign in as a patient to book an appointment.");
                return;
              }
              setBookingOpen(true);
            }}
            style={{ backgroundColor: primary, borderRadius: 20, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, shadowColor: primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 }}
          >
            <FontAwesome name="calendar-plus-o" size={18} color="#fff" />
            <Text style={{ fontFamily: "NeueBold", fontSize: 16, color: "#fff" }}>
              {isFree ? "Book Free Appointment" : "Book Appointment"}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* ── Booking modal ── */}
      {patientId && doctor && (
        <BookingModal
          visible={bookingOpen}
          onClose={() => setBookingOpen(false)}
          onBooked={refreshFreeStatus}
          doctor={doctor}
          patientId={patientId}
          isFree={isFree ?? false}
          fee={fee}
          isDark={isDark}
          primary={primary}
        />
      )}
    </View>
  );
}

// ── Small stat chip ──
function StatChip({ icon, label, isDark }: { icon: string; label: string; isDark: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
      <FontAwesome name={icon as any} size={11} color={isDark ? "#9ca3af" : "#6b7280"} />
      <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#d1d5db" : "#374151" }}>{label}</Text>
    </View>
  );
}

// ── Booking modal ──
interface BookingModalProps {
  visible: boolean;
  onClose: () => void;
  onBooked?: () => void;
  doctor: DoctorPublic;
  patientId: string;
  isFree: boolean;
  fee: number;
  isDark: boolean;
  primary: string;
}

type BookingStep = "form" | "payment" | "done";

function BookingModal({ visible, onClose, onBooked, doctor, patientId, isFree, fee, isDark, primary }: BookingModalProps) {
  const [step, setStep] = useState<BookingStep>("form");
  const [type, setType] = useState<AppointmentType>("ONLINE");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdAppointment, setCreatedAppointment] = useState<any>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const resetState = () => {
    setStep("form");
    setType("ONLINE");
    setSymptoms("");
    setNotes("");
    setErrorMsg(null);
    setCreatedAppointment(null);
    setPaymentConfirmed(false);
  };

  const handleClose = () => { resetState(); onClose(); };

  const dateStr = date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const handleBook = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await appointments.create({
        patientId,
        doctorId: doctor.id,
        dateTime: date.toISOString(),
        type,
        symptoms: symptoms || undefined,
        notes: notes || undefined,
      });
      setCreatedAppointment(res.appointment);
      // Refresh the parent's isFree so subsequent bookings show the correct flow
      onBooked?.();
      if (res.isFree) {
        setStep("done");
      } else {
        setStep("payment");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to book. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayWithPayPal = async () => {
    if (!createdAppointment) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      // Build deep-link URLs so PayPal can redirect back into the app
      const returnUrl = Linking.createURL("paypal-return", {
        queryParams: { appointmentId: createdAppointment.id },
      });
      const cancelUrl = Linking.createURL("paypal-cancel", {
        queryParams: { appointmentId: createdAppointment.id },
      });

      const { orderId, approveUrl } = await paypal.createOrder(
        createdAppointment.id,
        returnUrl,
        cancelUrl
      );

      // Open PayPal checkout inside an in-app browser.
      // openAuthSessionAsync detects when PayPal redirects to our app scheme
      // and closes the browser automatically, returning the redirect URL.
      const result = await WebBrowser.openAuthSessionAsync(approveUrl, returnUrl);

      if (result.type === "success") {
        // User approved — capture the payment on the server
        await paypal.captureOrder(orderId, createdAppointment.id);
        setPaymentConfirmed(true);
        setStep("done");
      } else {
        // User cancelled or closed the browser
        setErrorMsg("Payment was cancelled. Your appointment is saved — you can pay later.");
      }
    } catch (e: any) {
      const msg: string = e.message ?? "";
      setErrorMsg(
        msg.includes("NO_FEE_SET") || msg.toLowerCase().includes("consultation fee")
          ? "The doctor hasn't set their consultation fee yet. Please contact them or choose a different doctor."
          : msg || "Payment failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const modalBg = isDark ? "#1e1b4b" : "#fff";
  const textPrimary = isDark ? "#fff" : "#111827";
  const textSecondary = isDark ? "#9ca3af" : "#6b7280";
  const inputBg = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)";
  const inputBorder = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View style={{ backgroundColor: modalBg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: "92%" }}>
          {/* Handle */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)", alignSelf: "center", marginBottom: 20 }} />

          {/* ── STEP: form ── */}
          {step === "form" && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontFamily: "NeueBold", fontSize: 20, color: textPrimary, marginBottom: 4 }}>Book Appointment</Text>
              <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: textSecondary, marginBottom: 20 }}>with {doctor.fullName}</Text>

              {/* Appointment type */}
              <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: textPrimary, marginBottom: 10 }}>Appointment type</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                {(["ONLINE", "ON_SITE"] as AppointmentType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setType(t)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: "center", gap: 6, backgroundColor: type === t ? primary : isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.04)", borderWidth: 1, borderColor: type === t ? primary : inputBorder }}
                  >
                    <FontAwesome name={t === "ONLINE" ? "video-camera" : "hospital-o"} size={18} color={type === t ? "#fff" : textSecondary} />
                    <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: type === t ? "#fff" : textSecondary }}>
                      {t === "ONLINE" ? "Online" : "In-person"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date */}
              <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: textPrimary, marginBottom: 10 }}>Date & Time</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, backgroundColor: inputBg, borderWidth: 1, borderColor: inputBorder }}>
                  <FontAwesome name="calendar" size={15} color={primary} />
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: textPrimary }}>{dateStr}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTimePicker(true)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, backgroundColor: inputBg, borderWidth: 1, borderColor: inputBorder }}>
                  <FontAwesome name="clock-o" size={15} color={primary} />
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: textPrimary }}>{timeStr}</Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={(_, d) => { setShowDatePicker(false); if (d) setDate(d); }}
                  themeVariant={isDark ? "dark" : "light"}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={date}
                  mode="time"
                  onChange={(_, d) => { setShowTimePicker(false); if (d) setDate(d); }}
                  themeVariant={isDark ? "dark" : "light"}
                />
              )}

              {/* Symptoms */}
              <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: textPrimary, marginBottom: 10 }}>Symptoms / Reason</Text>
              <TextInput
                style={{ backgroundColor: inputBg, borderWidth: 1, borderColor: inputBorder, borderRadius: 16, padding: 14, color: textPrimary, fontFamily: "NeueRegular", fontSize: 14, minHeight: 80, textAlignVertical: "top", marginBottom: 14 }}
                placeholder="Describe your symptoms…"
                placeholderTextColor={textSecondary}
                value={symptoms}
                onChangeText={setSymptoms}
                multiline
              />

              {/* Notes */}
              <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: textPrimary, marginBottom: 10 }}>Additional notes (optional)</Text>
              <TextInput
                style={{ backgroundColor: inputBg, borderWidth: 1, borderColor: inputBorder, borderRadius: 16, padding: 14, color: textPrimary, fontFamily: "NeueRegular", fontSize: 14, minHeight: 60, textAlignVertical: "top", marginBottom: 20 }}
                placeholder="Any other details…"
                placeholderTextColor={textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
              />

              {/* Free / paid badge */}
              {isFree && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#10b98115", borderRadius: 16, padding: 14, marginBottom: 20 }}>
                  <FontAwesome name="gift" size={20} color="#10b981" />
                  <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: "#10b981", flex: 1 }}>
                    This appointment is FREE — first visit with {doctor.fullName.split(" ")[0]}!
                  </Text>
                </View>
              )}
              {!isFree && fee > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${primary}15`, borderRadius: 16, padding: 14, marginBottom: 20 }}>
                  <FontAwesome name="paypal" size={18} color={primary} />
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#c7d2fe" : "#4338ca", flex: 1 }}>
                    You will be redirected to PayPal to pay ${fee.toFixed(2)} after booking.
                  </Text>
                </View>
              )}

              {errorMsg && <Text style={{ color: "#ef4444", fontFamily: "NeueRegular", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{errorMsg}</Text>}

              <View style={{ flexDirection: "row", gap: 10, paddingBottom: 20 }}>
                <TouchableOpacity onPress={handleClose} style={{ flex: 1, paddingVertical: 14, borderRadius: 18, alignItems: "center", borderWidth: 1, borderColor: inputBorder }}>
                  <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleBook} disabled={submitting} style={{ flex: 2, paddingVertical: 14, borderRadius: 18, alignItems: "center", backgroundColor: primary, shadowColor: primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 }}>
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: "#fff" }}>Confirm Booking</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ── STEP: payment ── */}
          {step === "payment" && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ alignItems: "center", marginBottom: 24 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#0070BA20", justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
                  <FontAwesome name="paypal" size={30} color="#0070BA" />
                </View>
                <Text style={{ fontFamily: "NeueBold", fontSize: 20, color: textPrimary }}>Complete Payment</Text>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 14, color: textSecondary, marginTop: 4, textAlign: "center" }}>
                  Your appointment is saved. Tap below to pay ${fee.toFixed(2)} via PayPal.
                </Text>
              </View>

              {/* Booking summary */}
              <View style={{ backgroundColor: inputBg, borderRadius: 18, padding: 16, marginBottom: 24, gap: 8 }}>
                <SummaryRow label="Doctor" value={doctor.fullName} isDark={isDark} />
                <SummaryRow label="Date" value={dateStr} isDark={isDark} />
                <SummaryRow label="Time" value={timeStr} isDark={isDark} />
                <SummaryRow label="Type" value={type === "ONLINE" ? "Online consultation" : "In-person visit"} isDark={isDark} />
                <View style={{ height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }} />
                <SummaryRow label="Amount" value={`$${fee.toFixed(2)}`} isDark={isDark} bold />
              </View>

              {errorMsg && (
                <View style={{ backgroundColor: "#ef444415", borderRadius: 14, padding: 12, marginBottom: 16 }}>
                  <Text style={{ color: "#ef4444", fontFamily: "NeueRegular", fontSize: 13, textAlign: "center" }}>{errorMsg}</Text>
                </View>
              )}

              {/* Primary CTA — opens PayPal in-app browser, auto-captures on return */}
              <TouchableOpacity
                onPress={handlePayWithPayPal}
                disabled={submitting}
                style={{ backgroundColor: "#0070BA", borderRadius: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14, shadowColor: "#0070BA", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 }}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <>
                      <FontAwesome name="paypal" size={20} color="#fff" />
                      <Text style={{ fontFamily: "NeueBold", fontSize: 16, color: "#fff" }}>Pay ${fee.toFixed(2)} with PayPal</Text>
                    </>
                  )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep("done")} style={{ paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: textSecondary }}>Pay later — save appointment for now</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ── STEP: done ── */}
          {step === "done" && (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#10b98120", justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
                <FontAwesome name="check-circle" size={36} color="#10b981" />
              </View>
              <Text style={{ fontFamily: "NeueBold", fontSize: 22, color: textPrimary, marginBottom: 8 }}>Appointment Booked!</Text>
              <Text style={{ fontFamily: "NeueRegular", fontSize: 15, color: textSecondary, textAlign: "center", marginBottom: 24, lineHeight: 22 }}>
                {isFree
                  ? `Your free appointment with ${doctor.fullName} is confirmed for ${dateStr} at ${timeStr}.`
                  : paymentConfirmed
                    ? `Payment confirmed! Your appointment with ${doctor.fullName} is all set for ${dateStr} at ${timeStr}.`
                    : `Your appointment with ${doctor.fullName} is saved for ${dateStr} at ${timeStr}. Complete payment to confirm.`}
              </Text>
              <TouchableOpacity
                onPress={() => { handleClose(); router.back(); }}
                style={{ backgroundColor: primary, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 40 }}
              >
                <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: "#fff" }}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SummaryRow({ label, value, isDark, bold }: { label: string; value: string; isDark: boolean; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280" }}>{label}</Text>
      <Text style={{ fontFamily: bold ? "NeueBold" : "NeueRegular", fontSize: 13, color: isDark ? "#fff" : "#111827" }}>{value}</Text>
    </View>
  );
}
