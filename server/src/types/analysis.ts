export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface SuggestedExerciseDTO {
  name: string;
  description: string;
  targetJoint: string;
  targetAngleMin: number;
  targetAngleMax: number;
  holdDurationSec: number;
  reps: number;
  sets: number;
}

export interface AIAnalysisDTO {
  id: string;
  appointmentId: string;
  summary: string;
  keyFindings: string[];
  suggestedExercises: SuggestedExerciseDTO[];
  confidence: number;
  generatedAt: string;
  doctorReviewedAt?: string | null;
  doctorApproved: boolean;
}

export interface TranscriptDTO {
  id: string;
  recordingId: string;
  rawText: string;
  segments: TranscriptSegment[];
  language: string;
  createdAt: string;
}

export interface RecordingDTO {
  id: string;
  appointmentId: string;
  mediaType: "AUDIO" | "VIDEO";
  mediaUrl: string;
  durationSec?: number | null;
  consentPatient: boolean;
  consentDoctor: boolean;
  createdAt: string;
}

/** Shape returned by GPT-4o-mini for structured analysis */
export interface LLMAnalysisResponse {
  summary: string;
  keyFindings: string[];
  suggestedExercises: SuggestedExerciseDTO[];
  confidence: number;
}
