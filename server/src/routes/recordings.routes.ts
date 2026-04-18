/**
 * Recordings & Analysis routes (mounted at /api/appointments)
 *   POST   /api/appointments/:id/recording         — upload audio/video
 *   GET    /api/appointments/:id/recording         — get recording metadata
 *   GET    /api/appointments/:id/analysis          — get AI analysis
 *   POST   /api/appointments/:id/analysis/approve  — doctor approves analysis
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../config/databse";
import { runAnalysisPipeline } from "../services/analysisPipeline";

const router = Router();

// Store uploads in server/uploads/
const storage = multer.diskStorage({
  destination: path.join(process.cwd(), "uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /audio|video/;
    if (allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error("Only audio and video files are allowed"));
  },
});

const ConsentSchema = z.object({
  consentPatient: z
    .string()
    .transform((v) => v === "true")
    .or(z.boolean()),
  consentDoctor: z
    .string()
    .transform((v) => v === "true")
    .or(z.boolean()),
  durationSec: z
    .string()
    .transform(Number)
    .optional()
    .or(z.number().optional()),
  patientId: z.string(),
  doctorId: z.string(),
});

// POST /api/appointments/:id/recording
router.post("/:id/recording", upload.single("media"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No media file uploaded" });
    }

    const parsed = ConsentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    }

    const { consentPatient, consentDoctor, durationSec, patientId, doctorId } = parsed.data;

    if (!consentPatient || !consentDoctor) {
      return res.status(400).json({
        error: "Both patient and doctor consent are required before recording",
        code: "CONSENT_REQUIRED",
      });
    }

    const appointmentId = req.params.id;
    const mediaType = req.file.mimetype.startsWith("audio") ? "AUDIO" : "VIDEO";
    const mediaUrl = `/api/media/${req.file.filename}`;

    // Upsert in case of re-upload
    const recording = await prisma.appointmentRecording.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        mediaType,
        mediaUrl,
        durationSec: durationSec ? Number(durationSec) : undefined,
        consentPatient: Boolean(consentPatient),
        consentDoctor: Boolean(consentDoctor),
      },
      update: {
        mediaType,
        mediaUrl,
        durationSec: durationSec ? Number(durationSec) : undefined,
        consentPatient: Boolean(consentPatient),
        consentDoctor: Boolean(consentDoctor),
      },
    });

    // Fire-and-forget pipeline (non-blocking)
    setImmediate(() => {
      runAnalysisPipeline({
        recordingId: recording.id,
        appointmentId,
        filePath: req.file!.path,
        patientId,
        doctorId,
      }).catch((err) =>
        console.error("[recordings] Pipeline error:", err.message)
      );
    });

    res.status(201).json({ message: "Recording uploaded, analysis in progress", recording });
  } catch (err: any) {
    console.error("[recordings] Upload error:", err);
    res.status(500).json({ error: "Failed to upload recording", message: err.message });
  }
});

// GET /api/appointments/:id/recording
router.get("/:id/recording", async (req: Request, res: Response) => {
  try {
    const recording = await prisma.appointmentRecording.findUnique({
      where: { appointmentId: req.params.id },
      include: { transcript: true },
    });
    if (!recording) return res.status(404).json({ error: "Recording not found" });
    res.json({ recording });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch recording", message: err.message });
  }
});

// GET /api/appointments/:id/analysis
router.get("/:id/analysis", async (req: Request, res: Response) => {
  try {
    const analysis = await prisma.aIAnalysis.findUnique({
      where: { appointmentId: req.params.id },
    });
    if (!analysis) return res.status(404).json({ error: "Analysis not ready yet" });
    res.json({ analysis });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch analysis", message: err.message });
  }
});

// POST /api/appointments/:id/analysis/approve
router.post("/:id/analysis/approve", async (req: Request, res: Response) => {
  try {
    const analysis = await prisma.aIAnalysis.update({
      where: { appointmentId: req.params.id },
      data: { doctorApproved: true, doctorReviewedAt: new Date() },
    });
    res.json({ message: "Analysis approved", analysis });
  } catch (err: any) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Analysis not found" });
    }
    res.status(500).json({ error: "Failed to approve analysis", message: err.message });
  }
});

export default router;
