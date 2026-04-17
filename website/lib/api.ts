/**
 * Thin HTTP client that talks to the shared backend in /server.
 *
 * IMPORTANT: This file does NOT contain backend logic. It only forwards
 * requests to the Express API in /server. Set NEXT_PUBLIC_API_URL in your
 * `.env.local`, e.g.:
 *
 *   NEXT_PUBLIC_API_URL=http://localhost:5000
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:5000";

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
};

// ---- Typed helpers for our endpoints ----

export type Role = "PATIENT" | "DOCTOR" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  role: Role;
  doctorProfile?: any;
  patientProfile?: any;
}

export interface DoctorProfile {
  id: string;
  fullName: string;
  specialization: string;
  licenseNumber: string;
  experienceYears: number;
  consultationFee: number | null;
  bio: string | null;
  clinicName: string | null;
  clinicAddress: string | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  paypalEmail: string | null;
}

export const doctors = {
  updateProfile: (
    id: string,
    payload: Partial<Omit<DoctorProfile, "id" | "licenseNumber" | "specialization">>
  ) => api.patch<{ message: string; doctor: DoctorProfile }>(`/api/doctors/${id}`, payload),
};

export const auth = {
  loginDoctor: (email: string, password: string) =>
    api.post<{ user: AuthUser }>("/api/auth/login", {
      email,
      password,
      role: "DOCTOR",
    }),

  registerDoctor: (payload: {
    email: string;
    password: string;
    fullName: string;
    specialization: string;
    licenseNumber: string;
    phone?: string;
    experienceYears?: number;
    consultationFee?: number;
    bio?: string;
    clinicName?: string;
    clinicAddress?: string;
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  }) => api.post<{ user: AuthUser }>("/api/auth/register/doctor", payload),
};
