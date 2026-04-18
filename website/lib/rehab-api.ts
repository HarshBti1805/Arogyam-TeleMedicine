/**
 * Typed fetch helpers for rehab and recording endpoints.
 * All requests go to the Express server — no backend logic in this file.
 */
import { API_URL, api } from "./api";

// ─── Types (mirror server/src/types/) ────────────────────────────────────────

export type RehabStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type SessionStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface SuggestedExercise {
  name: string;
  description: string;
  targetJoint: string;
  targetAngleMin: number;
  targetAngleMax: number;
  holdDurationSec: number;
  reps: number;
  sets: number;
}

export interface AIAnalysis {
  id: string;
  appointmentId: string;
  summary: string;
  keyFindings: string[];
  suggestedExercises: SuggestedExercise[];
  confidence: number;
  generatedAt: string;
  doctorReviewedAt: string | null;
  doctorApproved: boolean;
}

export interface Transcript {
  id: string;
  rawText: string;
  segments: { start: number; end: number; text: string }[];
  language: string;
}

export interface Recording {
  id: string;
  appointmentId: string;
  mediaType: "AUDIO" | "VIDEO";
  mediaUrl: string;
  durationSec: number | null;
  transcript: Transcript | null;
}

export interface RehabExercise {
  id: string;
  planId: string;
  name: string;
  description: string | null;
  targetJoint: string;
  targetAngleMin: number;
  targetAngleMax: number;
  holdDurationSec: number;
  reps: number;
  sets: number;
  videoDemoUrl: string | null;
  order: number;
}

export interface RehabSession {
  id: string;
  planId: string;
  exerciseId: string;
  patientId: string;
  startedAt: string;
  completedAt: string | null;
  overallScore: number | null;
  status: SessionStatus;
}

export interface RehabAlert {
  id: string;
  planId: string;
  doctorId: string;
  severity: AlertSeverity;
  reason: string;
  acknowledged: boolean;
  createdAt: string;
  plan?: { title: string; patientId: string };
}

export interface RehabPlan {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;
  aiAnalysisId: string | null;
  title: string;
  description: string | null;
  status: RehabStatus;
  startedAt: string;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  exercises: RehabExercise[];
  sessions?: RehabSession[];
  alerts?: RehabAlert[];
}

export interface CreatePlanPayload {
  patientId: string;
  doctorId: string;
  appointmentId?: string;
  aiAnalysisId?: string;
  title: string;
  description?: string;
  endsAt?: string;
  exercises: Omit<RehabExercise, "id" | "planId">[];
}

// ─── Recording & Analysis ─────────────────────────────────────────────────────

export const recordings = {
  get: (appointmentId: string) =>
    api.get<{ recording: Recording }>(`/api/appointments/${appointmentId}/recording`),

  getAnalysis: (appointmentId: string) =>
    api.get<{ analysis: AIAnalysis }>(`/api/appointments/${appointmentId}/analysis`),

  approveAnalysis: (appointmentId: string) =>
    api.post<{ analysis: AIAnalysis }>(`/api/appointments/${appointmentId}/analysis/approve`, {}),
};

// ─── Rehab Plans ──────────────────────────────────────────────────────────────

export const rehabPlans = {
  create: (payload: CreatePlanPayload) =>
    api.post<{ plan: RehabPlan }>("/api/rehab/plans", payload),

  list: (filter: { patientId?: string; doctorId?: string }) => {
    const q = new URLSearchParams(filter as any).toString();
    return api.get<{ plans: RehabPlan[] }>(`/api/rehab/plans?${q}`);
  },

  get: (id: string) =>
    api.get<{ plan: RehabPlan }>(`/api/rehab/plans/${id}`),

  update: (id: string, payload: Partial<CreatePlanPayload> & { status?: RehabStatus }) =>
    api.patch<{ plan: RehabPlan }>(`/api/rehab/plans/${id}`, payload),
};

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const rehabSessions = {
  list: (filter: { planId?: string; patientId?: string }) => {
    const q = new URLSearchParams(filter as any).toString();
    return api.get<{ sessions: RehabSession[] }>(`/api/rehab/sessions?${q}`);
  },
};

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const rehabAlerts = {
  list: (doctorId: string) =>
    api.get<{ alerts: RehabAlert[] }>(`/api/rehab/alerts?doctorId=${doctorId}`),

  acknowledge: (id: string) =>
    api.patch<{ alert: RehabAlert }>(`/api/rehab/alerts/${id}/acknowledge`, {}),
};
