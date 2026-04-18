export type RehabStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type SessionStatus = "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH";

// ─── Pose / Scoring ───────────────────────────────────────────────────────────

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface LandmarkFrame {
  timestamp: number;
  landmarks: PoseLandmark[]; // 33 world landmarks
}

export interface ExerciseConfig {
  name: string;
  targetJoint: string;
  targetAngleMin: number;
  targetAngleMax: number;
  holdDurationSec: number;
  reps: number;
  sets: number;
}

export interface ScoringResult {
  repCount: number;
  perRepScore: number[];
  overallScore: number; // 0-100
  violations: string[];
  compensationFlags: string[];
}

export interface LiveFeedbackEvent {
  type: "rep_complete" | "form_warning" | "good_form";
  message: string;
  currentRepScore?: number;
}

// ─── Rehab Plan DTOs ──────────────────────────────────────────────────────────

export interface RehabExerciseDTO {
  id: string;
  planId: string;
  name: string;
  description?: string | null;
  targetJoint: string;
  targetAngleMin: number;
  targetAngleMax: number;
  holdDurationSec: number;
  reps: number;
  sets: number;
  videoDemoUrl?: string | null;
  order: number;
}

export interface RehabPlanDTO {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string | null;
  aiAnalysisId?: string | null;
  title: string;
  description?: string | null;
  status: RehabStatus;
  startedAt: string;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
  exercises?: RehabExerciseDTO[];
}

export interface RehabSessionDTO {
  id: string;
  planId: string;
  exerciseId: string;
  patientId: string;
  startedAt: string;
  completedAt?: string | null;
  overallScore?: number | null;
  repScores?: number[] | null;
  feedbackNotes?: string | null;
  status: SessionStatus;
}

export interface RehabAlertDTO {
  id: string;
  planId: string;
  doctorId: string;
  severity: AlertSeverity;
  reason: string;
  acknowledged: boolean;
  createdAt: string;
}

// ─── WebSocket event payloads ─────────────────────────────────────────────────

export interface WsEvent<T = unknown> {
  event: string;
  payload: T;
  roomId?: string;
}
