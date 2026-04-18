/**
 * Analysis pipeline: recording → Whisper transcription → GPT-4o-mini analysis
 * → save to DB → emit WebSocket event.
 *
 * Called asynchronously after a recording is uploaded — failures do NOT block
 * the recording response.
 */
import fs from "fs";
import OpenAI from "openai";
import { prisma } from "../config/databse";
import { broadcast } from "../lib/wsServer";
import type { LLMAnalysisResponse, SuggestedExerciseDTO } from "../types/analysis";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_WHISPER_RETRIES = 3;
const WHISPER_RETRY_DELAY_MS = 2000;

// ─── Helper: sleep ────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Step 1: Transcription ────────────────────────────────────────────────────

async function transcribeAudio(
  filePath: string,
  recordingId: string,
  retryCount = 0
): Promise<void> {
  try {
    const fileStream = fs.createReadStream(filePath);
    const response = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: fileStream,
      response_format: "verbose_json",
    });

    // verbose_json returns segments with timestamps
    const segments = (response as any).segments ?? [];
    const rawText = response.text ?? "";

    await prisma.transcript.create({
      data: {
        recordingId,
        rawText,
        segments: segments.map((s: any) => ({
          start: s.start,
          end: s.end,
          text: s.text,
        })),
        language: (response as any).language ?? "en",
      },
    });

    console.log(`[analysisPipeline] Transcript saved for recording ${recordingId}`);
    return;
  } catch (err: any) {
    if (retryCount < MAX_WHISPER_RETRIES - 1) {
      console.warn(
        `[analysisPipeline] Whisper attempt ${retryCount + 1} failed, retrying…`,
        err.message
      );
      await sleep(WHISPER_RETRY_DELAY_MS * (retryCount + 1));
      return transcribeAudio(filePath, recordingId, retryCount + 1);
    }
    throw new Error(`Whisper transcription failed after ${MAX_WHISPER_RETRIES} attempts: ${err.message}`);
  }
}

// ─── Step 2: LLM Analysis ────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are a clinical AI assistant. Analyze the following medical consultation transcript and return a JSON object with EXACTLY this shape:
{
  "summary": "<2-3 sentence plain-English consultation summary>",
  "keyFindings": ["finding 1", "finding 2", ...],
  "suggestedExercises": [
    {
      "name": "Exercise Name",
      "description": "Brief instructions",
      "targetJoint": "knee_left|knee_right|elbow_left|elbow_right|shoulder_abduction_left|shoulder_abduction_right|hip_flexion_left|hip_flexion_right",
      "targetAngleMin": <number degrees>,
      "targetAngleMax": <number degrees>,
      "holdDurationSec": <integer>,
      "reps": <integer>,
      "sets": <integer>
    }
  ],
  "confidence": <float 0.0-1.0>
}
Return ONLY the JSON. No markdown, no explanation.`;

async function analyzeTranscript(
  rawText: string,
  appointmentId: string
): Promise<void> {
  let parsed: LLMAnalysisResponse | null = null;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: `Transcript:\n\n${rawText}` },
      ],
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content ?? "{}";
    parsed = JSON.parse(content) as LLMAnalysisResponse;

    // Validate minimal shape
    if (!parsed.summary || !Array.isArray(parsed.keyFindings) || !Array.isArray(parsed.suggestedExercises)) {
      throw new Error("LLM returned malformed JSON — missing required fields");
    }
  } catch (err: any) {
    console.error(`[analysisPipeline] LLM analysis failed: ${err.message}`);
    // Save a placeholder so the doctor sees "Analysis unavailable"
    await prisma.aIAnalysis.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        summary: "Analysis unavailable — please review transcript manually.",
        keyFindings: [],
        suggestedExercises: [],
        confidence: 0,
      },
      update: {
        summary: "Analysis unavailable — please review transcript manually.",
      },
    });
    return;
  }

  await prisma.aIAnalysis.upsert({
    where: { appointmentId },
    create: {
      appointmentId,
      summary: parsed.summary,
      keyFindings: parsed.keyFindings,
      suggestedExercises: parsed.suggestedExercises as any,
      confidence: parsed.confidence ?? 0.8,
    },
    update: {
      summary: parsed.summary,
      keyFindings: parsed.keyFindings,
      suggestedExercises: parsed.suggestedExercises as any,
      confidence: parsed.confidence ?? 0.8,
    },
  });

  console.log(`[analysisPipeline] AIAnalysis saved for appointment ${appointmentId}`);
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function runAnalysisPipeline(params: {
  recordingId: string;
  appointmentId: string;
  filePath: string;
  patientId: string;
  doctorId: string;
}): Promise<void> {
  const { recordingId, appointmentId, filePath, patientId, doctorId } = params;

  // Notify clients the recording was received
  broadcast("recording.uploaded", { appointmentId }, appointmentId);
  broadcast("recording.uploaded", { appointmentId }, patientId);
  broadcast("recording.uploaded", { appointmentId }, doctorId);

  // Step 1: Transcription
  try {
    await transcribeAudio(filePath, recordingId);
    broadcast("transcription.complete", { appointmentId }, appointmentId);
    broadcast("transcription.complete", { appointmentId }, patientId);
    broadcast("transcription.complete", { appointmentId }, doctorId);
  } catch (err: any) {
    console.error(`[analysisPipeline] Transcription permanently failed: ${err.message}`);
    // Emit partial event so doctor knows transcript is pending
    broadcast(
      "transcription.failed",
      { appointmentId, reason: "Transcript pending — will retry later." },
      doctorId
    );
    return; // Cannot analyse without a transcript
  }

  // Fetch the transcript we just saved
  const transcript = await prisma.transcript.findUnique({ where: { recordingId } });
  if (!transcript?.rawText) {
    console.error("[analysisPipeline] Transcript empty after save — aborting analysis");
    return;
  }

  // Step 2: LLM analysis
  await analyzeTranscript(transcript.rawText, appointmentId);

  const analysis = await prisma.aIAnalysis.findUnique({ where: { appointmentId } });

  // Notify both parties
  broadcast(
    "analysis.result.ready",
    { appointmentId, analysis },
    patientId
  );
  broadcast(
    "analysis.result.ready",
    { appointmentId, analysis },
    doctorId
  );
  broadcast(
    "analysis.result.ready",
    { appointmentId, analysis },
    appointmentId
  );
}
