/**
 * Typed API helpers for rehab endpoints.
 * All requests go to the Express server.
 */
import { api } from "./api";

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

export type RehabStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type SessionStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH";

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
  repScores: number[] | null;
  status: SessionStatus;
}

export interface RehabPlan {
  id: string;
  patientId: string;
  doctorId: string;
  title: string;
  description: string | null;
  status: RehabStatus;
  startedAt: string;
  endsAt: string | null;
  createdAt: string;
  exercises: RehabExercise[];
  sessions?: RehabSession[];
}

export interface AIAnalysis {
  id: string;
  appointmentId: string;
  summary: string;
  keyFindings: string[];
  suggestedExercises: unknown[];
  confidence: number;
  generatedAt: string;
  doctorApproved: boolean;
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export const rehabApi = {
  getPlans: (patientId: string) =>
    api.get<{ plans: RehabPlan[] }>(`/api/rehab/plans?patientId=${patientId}`),

  getPlan: (id: string) => api.get<{ plan: RehabPlan }>(`/api/rehab/plans/${id}`),

  startSession: (planId: string, exerciseId: string, patientId: string) =>
    api.post<{ session: RehabSession }>("/api/rehab/sessions", {
      planId,
      exerciseId,
      patientId,
    }),

  completeSession: (
    sessionId: string,
    data: {
      repScores: number[];
      overallScore: number;
      feedbackNotes?: string;
    }
  ) =>
    api.patch<{ session: RehabSession }>(
      `/api/rehab/sessions/${sessionId}/complete`,
      data
    ),

  uploadRecording: async (
    appointmentId: string,
    fileUri: string,
    mediaType: "AUDIO" | "VIDEO",
    opts: {
      consentPatient: boolean;
      consentDoctor: boolean;
      patientId: string;
      doctorId: string;
      durationSec?: number;
    }
  ) => {
    const formData = new FormData();
    const filename = fileUri.split("/").pop() ?? "recording.m4a";
    const mimeType = mediaType === "AUDIO" ? "audio/m4a" : "video/mp4";
    (formData as any).append("media", { uri: fileUri, name: filename, type: mimeType });
    formData.append("consentPatient", String(opts.consentPatient));
    formData.append("consentDoctor", String(opts.consentDoctor));
    formData.append("patientId", opts.patientId);
    formData.append("doctorId", opts.doctorId);
    if (opts.durationSec !== undefined) {
      formData.append("durationSec", String(opts.durationSec));
    }

    const res = await fetch(`${API_URL}/api/appointments/${appointmentId}/recording`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Upload failed (${res.status})`);
    }
    return res.json();
  },

  uploadVideoForScoring: async (
    videoUri: string,
    exerciseConfig: object
  ) => {
    const POSE_URL =
      (process.env.EXPO_PUBLIC_POSE_WS_URL ?? "ws://localhost:8000/stream")
        .replace(/^ws/, "http")
        .replace(/\/stream$/, "");

    const formData = new FormData();
    const filename = videoUri.split("/").pop() ?? "session.mp4";
    (formData as any).append("video", {
      uri: videoUri,
      name: filename,
      type: "video/mp4",
    });
    formData.append("exerciseConfig", JSON.stringify(exerciseConfig));

    const res = await fetch(`${POSE_URL}/score-from-video`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(`Pose service error (${res.status})`);
    return res.json();
  },

  getAnalysis: (appointmentId: string) =>
    api.get<{ analysis: AIAnalysis }>(`/api/appointments/${appointmentId}/analysis`),
};
