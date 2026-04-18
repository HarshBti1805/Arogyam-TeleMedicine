import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useColorScheme } from "nativewind";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as Location from "expo-location";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { router } from "expo-router";
import {
  doctors,
  fetchRoute,
  formatDistance,
  formatDuration,
  type DoctorPublic,
  type RouteResult,
} from "@/utils/api";

const SPECIALIZATIONS = [
  "All",
  "General Practice",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Orthopedics",
  "Neurology",
  "Psychiatry",
  "Oncology",
  "Gynecology",
  "Ophthalmology",
];

type Tab = "list" | "map";

export default function SearchDoctorsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? "#818CF8" : "#6366F1";

  const [tab, setTab] = useState<Tab>("list");
  const [query, setQuery] = useState("");
  const [selectedSpec, setSelectedSpec] = useState("All");
  const [cityFilter, setCityFilter] = useState("");
  const [results, setResults] = useState<DoctorPublic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [nearbyMode, setNearbyMode] = useState(false);

  // Map-specific state
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorPublic | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);

  const fetchLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    setUserLocation(loc);
    return loc;
  }, []);

  const doSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof doctors.search>[0] = { limit: 50 };
      if (query.trim()) params.q = query.trim();
      if (selectedSpec !== "All") params.specialization = selectedSpec;
      if (cityFilter.trim()) params.city = cityFilter.trim();
      if (nearbyMode && userLocation) {
        params.lat = userLocation.latitude;
        params.lng = userLocation.longitude;
        params.radiusKm = 25;
      }
      const data = await doctors.search(params);
      setResults(data.doctors);
    } catch (e: any) {
      setError(e?.message || "Search failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [query, selectedSpec, cityFilter, nearbyMode, userLocation]);

  useEffect(() => { doSearch(); }, []); // eslint-disable-line

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(doSearch, 400);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, selectedSpec, cityFilter, nearbyMode, userLocation]); // eslint-disable-line

  const handleNearbyToggle = async () => {
    if (!nearbyMode) {
      let loc = userLocation;
      if (!loc) {
        loc = await fetchLocation();
        if (!loc) { setError("Location permission denied."); return; }
      }
      setNearbyMode(true);
      // Switch to map so the user sees the result immediately
      setTab("map");
    } else {
      setNearbyMode(false);
      setSelectedDoctor(null);
      setRoute(null);
    }
  };

  // When nearby mode activates and results arrive, auto-select the closest doctor
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!nearbyMode || !userLocation) return;
    const withCoords = results.filter((d) => d.latitude != null && d.longitude != null);
    if (!withCoords.length) return;
    // Already auto-selected for this nearby session — don't repeat on every re-render
    if (autoSelectedRef.current) return;
    autoSelectedRef.current = true;

    // Sort by distance if available; else take first result (server already sorted)
    const closest = withCoords.reduce((best, d) => {
      if (d.distanceKm == null) return best;
      if (best.distanceKm == null || d.distanceKm < best.distanceKm) return d;
      return best;
    }, withCoords[0]);

    handleMarkerPress(closest);
  }, [nearbyMode, userLocation, results]); // eslint-disable-line

  // Reset auto-select flag when nearby mode turns off or search changes
  useEffect(() => {
    if (!nearbyMode) autoSelectedRef.current = false;
  }, [nearbyMode, query, selectedSpec, cityFilter]);

  /** Tap a doctor marker on the map: select, fetch route, fit map */
  const handleMarkerPress = useCallback(async (doctor: DoctorPublic) => {
    setSelectedDoctor(doctor);
    setRoute(null);

    if (
      userLocation &&
      doctor.latitude != null &&
      doctor.longitude != null
    ) {
      setRouteLoading(true);
      const r = await fetchRoute(
        userLocation.latitude,
        userLocation.longitude,
        doctor.latitude,
        doctor.longitude
      );
      setRoute(r);
      setRouteLoading(false);

      // Fit the map to show both points
      mapRef.current?.fitToCoordinates(
        [
          userLocation,
          { latitude: doctor.latitude, longitude: doctor.longitude },
        ],
        { edgePadding: { top: 80, right: 40, bottom: 220, left: 40 }, animated: true }
      );
    }
  }, [userLocation]);

  const mapCenter =
    userLocation ||
    results.find((d) => d.latitude && d.longitude)
      ? {
          latitude: userLocation?.latitude ?? results[0]?.latitude ?? 28.6,
          longitude: userLocation?.longitude ?? results[0]?.longitude ?? 77.2,
        }
      : { latitude: 28.6139, longitude: 77.209 };

  const blurStyle = {
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

      {/* ── Header + Filters ── */}
      <Animated.View entering={FadeInDown.delay(100).springify()} style={{ paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 }}>
        <Text style={{ fontFamily: "NeueBold", fontSize: 22, color: isDark ? "#fff" : "#111827", marginBottom: 2 }}>
          Find a Doctor
        </Text>
        <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280", marginBottom: 14 }}>
          Search by name, specialty or location
        </Text>

        {/* Search bar */}
        <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={blurStyle}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 2 }}>
            <FontAwesome name="search" size={15} color={isDark ? "#9ca3af" : "#6b7280"} />
            <TextInput
              style={{ flex: 1, marginLeft: 10, color: isDark ? "#fff" : "#111", fontFamily: "NeueRegular", fontSize: 15, paddingVertical: 10 }}
              placeholder="Doctor name, specialty, city…"
              placeholderTextColor="#9ca3af"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <FontAwesome name="times-circle" size={15} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        </BlurView>

        {/* Filters row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"}
            style={{ borderRadius: 12, overflow: "hidden", flexGrow: 1, minWidth: 110 }}>
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 2 }}>
              <FontAwesome name="map-marker" size={12} color="#9ca3af" />
              <TextInput
                style={{ flex: 1, marginLeft: 6, color: isDark ? "#fff" : "#111", fontFamily: "NeueRegular", fontSize: 13, paddingVertical: 7 }}
                placeholder="City filter"
                placeholderTextColor="#9ca3af"
                value={cityFilter}
                onChangeText={setCityFilter}
              />
            </View>
          </BlurView>

          <TouchableOpacity
            onPress={handleNearbyToggle}
            style={{ backgroundColor: nearbyMode ? primaryColor : isDark ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.1)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <FontAwesome name="location-arrow" size={13} color={nearbyMode ? "#fff" : primaryColor} />
            <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: nearbyMode ? "#fff" : primaryColor }}>Nearby</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setTab(tab === "list" ? "map" : "list"); setSelectedDoctor(null); setRoute(null); }}
            style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <FontAwesome name={tab === "list" ? "map" : "list"} size={13} color={isDark ? "#9ca3af" : "#6b7280"} />
            <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#9ca3af" : "#6b7280" }}>{tab === "list" ? "Map" : "List"}</Text>
          </TouchableOpacity>
        </View>

        {/* Specialization chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
          {SPECIALIZATIONS.map((spec) => (
            <TouchableOpacity
              key={spec}
              onPress={() => setSelectedSpec(spec)}
              style={{
                backgroundColor: selectedSpec === spec ? primaryColor : isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.7)",
                borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
                borderWidth: selectedSpec === spec ? 0 : 1,
                borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
              }}>
              <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: selectedSpec === spec ? "#fff" : isDark ? "#d1d5db" : "#374151" }}>
                {spec}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#6b7280" : "#9ca3af", marginTop: 6 }}>
          {loading ? "Searching…" : `${results.length} doctor${results.length !== 1 ? "s" : ""} found`}
        </Text>
      </Animated.View>

      {error ? (
        <Text style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginHorizontal: 16 }}>{error}</Text>
      ) : null}

      {loading && results.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={primaryColor} size="large" />
        </View>
      ) : tab === "list" ? (
        /* ── List view ── */
        <FlatList
          data={results}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <FontAwesome name="user-md" size={48} color={isDark ? "#4b5563" : "#d1d5db"} />
              <Text style={{ fontFamily: "NeueRegular", color: isDark ? "#6b7280" : "#9ca3af", marginTop: 16, textAlign: "center" }}>
                No doctors found.{"\n"}Try adjusting your filters.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <DoctorCard
              doctor={item}
              isDark={isDark}
              primaryColor={primaryColor}
              onPress={() => router.push(`/doctor/${item.id}`)}
            />
          )}
        />
      ) : (
        /* ── Map view ── */
        <Animated.View entering={FadeInUp.duration(300)} style={{ flex: 1, margin: 16, borderRadius: 24, overflow: "hidden" }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={PROVIDER_DEFAULT}
            initialRegion={{ latitude: mapCenter.latitude, longitude: mapCenter.longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
            showsUserLocation={!!userLocation}
            showsMyLocationButton={false}
            showsCompass
          >
            {/* Route polyline */}
            {route && (
              <Polyline
                coordinates={route.coordinates}
                strokeColor="#3b82f6"
                strokeWidth={4}
              />
            )}

            {/* Doctor markers — native platform pin, red / dark-red when selected */}
            {results.filter((d) => d.latitude && d.longitude).map((d) => (
              <Marker
                key={d.id}
                coordinate={{ latitude: d.latitude!, longitude: d.longitude! }}
                onPress={() => handleMarkerPress(d)}
                pinColor={selectedDoctor?.id === d.id ? "#b91c1c" : "#ef4444"}
                tracksViewChanges={false}
              />
            ))}
          </MapView>

          {/* Route loading indicator */}
          {routeLoading && (
            <View style={{ position: "absolute", top: 12, alignSelf: "center", backgroundColor: isDark ? "rgba(30,27,75,0.9)" : "rgba(255,255,255,0.9)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator size="small" color={primaryColor} />
              <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: isDark ? "#fff" : "#374151" }}>Getting directions…</Text>
            </View>
          )}

          {/* Selected doctor card */}
          {selectedDoctor && (
            <View style={{ position: "absolute", bottom: 16, left: 16, right: 16 }}>
              <BlurView intensity={isDark ? 70 : 90} tint={isDark ? "dark" : "light"} style={{ borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)" }}>
                <View style={{ padding: 16 }}>
                  {/* Route info bar */}
                  {route && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${primaryColor}20`, alignItems: "center", justifyContent: "center" }}>
                          <FontAwesome name="road" size={14} color={primaryColor} />
                        </View>
                        <View>
                          <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: isDark ? "#fff" : "#111827" }}>
                            {formatDistance(route.distanceM)}
                          </Text>
                          <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: isDark ? "#9ca3af" : "#6b7280" }}>Distance</Text>
                        </View>
                      </View>
                      <View style={{ width: 1, height: 32, backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }} />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#10b98120", alignItems: "center", justifyContent: "center" }}>
                          <FontAwesome name="clock-o" size={14} color="#10b981" />
                        </View>
                        <View>
                          <Text style={{ fontFamily: "NeueBold", fontSize: 14, color: isDark ? "#fff" : "#111827" }}>
                            {formatDuration(route.durationS)}
                          </Text>
                          <Text style={{ fontFamily: "NeueRegular", fontSize: 11, color: isDark ? "#9ca3af" : "#6b7280" }}>by car</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Doctor info row */}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: isDark ? "#fff" : "#111827" }}>
                        {selectedDoctor.fullName}
                      </Text>
                      <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: primaryColor, marginTop: 1 }}>
                        {selectedDoctor.specialization}
                      </Text>
                      {selectedDoctor.clinicName && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                          <FontAwesome name="map-marker" size={11} color="#9ca3af" />
                          <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }} numberOfLines={1}>
                            {selectedDoctor.clinicName}{selectedDoctor.city ? `, ${selectedDoctor.city}` : ""}
                          </Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => router.push(`/doctor/${selectedDoctor.id}`)}
                      style={{ backgroundColor: primaryColor, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 12, alignSelf: "center" }}
                    >
                      <Text style={{ fontFamily: "NeueBold", fontSize: 13, color: "#fff" }}>View</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Dismiss */}
                  <TouchableOpacity
                    onPress={() => { setSelectedDoctor(null); setRoute(null); }}
                    style={{ position: "absolute", top: 12, right: 12, padding: 4 }}
                  >
                    <FontAwesome name="times" size={16} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </BlurView>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}


function DoctorCard({
  doctor,
  isDark,
  primaryColor,
  onPress,
}: {
  doctor: DoctorPublic;
  isDark: boolean;
  primaryColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
      <BlurView
        intensity={isDark ? 40 : 60}
        tint={isDark ? "dark" : "light"}
        style={{ borderRadius: 20, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.5)", overflow: "hidden" }}
      >
        <View style={{ padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          {/* Avatar */}
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: `${primaryColor}20`, justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
            <FontAwesome name="user-md" size={24} color={primaryColor} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={{ fontFamily: "NeueBold", fontSize: 15, color: isDark ? "#fff" : "#111827" }}>
                {doctor.fullName}
              </Text>
              {doctor.isVerified && <FontAwesome name="check-circle" size={14} color="#10b981" />}
            </View>

            <Text style={{ fontFamily: "NeueRegular", fontSize: 13, color: primaryColor, marginTop: 2 }}>
              {doctor.specialization}
            </Text>

            {(doctor.clinicName || doctor.city) && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                <FontAwesome name="map-marker" size={11} color="#9ca3af" />
                <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }} numberOfLines={1}>
                  {doctor.clinicName ? `${doctor.clinicName}${doctor.city ? `, ${doctor.city}` : ""}` : doctor.city ?? ""}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <FontAwesome name="clock-o" size={11} color="#9ca3af" />
                <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>{doctor.experienceYears}y exp</Text>
              </View>
              {doctor.distanceKm !== undefined && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <FontAwesome name="location-arrow" size={11} color="#9ca3af" />
                  <Text style={{ fontFamily: "NeueRegular", fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>{doctor.distanceKm.toFixed(1)} km</Text>
                </View>
              )}
              {Number(doctor.consultationFee) > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Text style={{ fontFamily: "NeueBold", fontSize: 12, color: "#10b981" }}>
                    1st FREE · ${Number(doctor.consultationFee).toFixed(0)}/visit
                  </Text>
                </View>
              )}
            </View>
          </View>

          <FontAwesome name="chevron-right" size={13} color="#9ca3af" style={{ alignSelf: "center" }} />
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}
