import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Resolve the backend base URL.
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL env (works at build time / `expo start`)
 *  2. extra.apiUrl in app.json
 *  3. localhost fallback (10.0.2.2 on Android emulator)
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const extra =
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined) ||
    ((Constants as any).manifest?.extra as { apiUrl?: string } | undefined);
  if (extra?.apiUrl) return extra.apiUrl.replace(/\/$/, "");

  if (Platform.OS === "android") return "http://10.0.2.2:5000";
  return "http://localhost:5000";
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error || body?.message || `Request failed (${res.status})`,
      body
    );
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};

// ---- Typed helpers ----

export type Role = "PATIENT" | "DOCTOR" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  role: Role;
  patientProfile?: any;
  doctorProfile?: any;
}

export interface DoctorPublic {
  id: string;
  fullName: string;
  specialization: string;
  experienceYears: number;
  consultationFee: string | number | null;
  bio: string | null;
  isVerified: boolean;
  clinicName: string | null;
  clinicAddress: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm?: number;
  user: { id: string; email: string; phone: string | null; createdAt: string };
}

export const auth = {
  loginPatient: (email: string, password: string) =>
    api.post<{ user: AuthUser }>("/api/auth/login", {
      email,
      password,
      role: "PATIENT",
    }),
  registerPatient: (payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  }) => api.post<{ user: AuthUser }>("/api/auth/register/patient", payload),
};

export const doctors = {
  search: (params: {
    q?: string;
    name?: string;
    specialization?: string;
    city?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && `${v}`.length > 0) {
        query.append(k, String(v));
      }
    });
    const qs = query.toString();
    return api.get<{ count: number; doctors: DoctorPublic[] }>(
      `/api/doctors${qs ? `?${qs}` : ""}`
    );
  },
  nearby: (lat: number, lng: number, radiusKm = 25) =>
    api.get<{ count: number; doctors: DoctorPublic[] }>(
      `/api/doctors/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`
    ),
  getById: (id: string) =>
    api.get<{ doctor: DoctorPublic }>(`/api/doctors/${id}`),
};

// ---- Appointment types ----

export type AppointmentType = "ONLINE" | "ON_SITE";
export type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";

export interface AppointmentPayment {
  id: string;
  amount: number | string;
  currency: string;
  status: string;
  method: string;
  transactionId: string | null;
}

export interface Appointment {
  id: string;
  dateTime: string;
  status: AppointmentStatus;
  type: AppointmentType;
  isFree: boolean;
  symptoms: string | null;
  notes: string | null;
  meetingLink: string | null;
  createdAt: string;
  doctor: {
    id: string;
    fullName: string;
    specialization: string;
    clinicName: string | null;
    clinicAddress: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    consultationFee: string | number | null;
    paypalEmail: string | null;
    user: { email: string; phone: string | null };
  };
  patient: {
    id: string;
    fullName: string;
    user: { email: string; phone: string | null };
  };
  payment: AppointmentPayment | null;
}

export const appointments = {
  create: (payload: {
    patientId: string;
    doctorId: string;
    dateTime: string;
    type: AppointmentType;
    symptoms?: string;
    notes?: string;
  }) =>
    api.post<{ appointment: Appointment; isFree: boolean }>(
      "/api/appointments",
      payload
    ),
  listForPatient: (patientId: string) =>
    api.get<{ count: number; appointments: Appointment[] }>(
      `/api/appointments?patientId=${patientId}`
    ),
  checkFree: (patientId: string, doctorId: string) =>
    api.get<{ isFree: boolean }>(
      `/api/appointments/check-free?patientId=${patientId}&doctorId=${doctorId}`
    ),
  confirmPayment: (appointmentId: string, transactionId: string) =>
    api.post<{ payment: AppointmentPayment }>(
      `/api/appointments/${appointmentId}/payment`,
      { transactionId, status: "SUCCESS" }
    ),
};

export const paypal = {
  /**
   * Ask the server to create a PayPal order for this appointment.
   * Returns { orderId, approveUrl } — open approveUrl in a browser.
   */
  createOrder: (
    appointmentId: string,
    returnUrl: string,
    cancelUrl: string
  ) =>
    api.post<{ orderId: string; approveUrl: string }>(
      "/api/payments/paypal/create-order",
      { appointmentId, returnUrl, cancelUrl }
    ),

  /**
   * Capture the approved PayPal order and mark the payment as SUCCESS.
   * Call this after the user approves the payment in the browser.
   */
  captureOrder: (orderId: string, appointmentId: string) =>
    api.post<{ message: string; captureId: string }>(
      "/api/payments/paypal/capture-order",
      { orderId, appointmentId }
    ),

  /** Check current payment status for an appointment. */
  status: (appointmentId: string) =>
    api.get<{ payment: AppointmentPayment | null }>(
      `/api/payments/paypal/status/${appointmentId}`
    ),
};

// ---- OSRM routing (free, no API key) ----

export interface RouteResult {
  /** Decoded polyline as RN MapView-compatible LatLng array */
  coordinates: Array<{ latitude: number; longitude: number }>;
  distanceM: number;  // metres
  durationS: number;  // seconds
}

export async function fetchRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteResult | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${fromLng},${fromLat};${toLng},${toLat}` +
      `?overview=full&geometries=geojson`;

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;

    const route = data.routes[0];
    const coordinates: Array<{ latitude: number; longitude: number }> =
      route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      }));

    return {
      coordinates,
      distanceM: route.distance,
      durationS: route.duration,
    };
  } catch {
    return null;
  }
}

/** Format metres → "1.2 km" or "450 m" */
export function formatDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}

/** Format seconds → "5 min" or "1 h 20 min" */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}
