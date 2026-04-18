/**
 * Rehab routes (mounted at /api/rehab)
 *   POST   /api/rehab/plans
 *   GET    /api/rehab/plans?patientId=|doctorId=
 *   GET    /api/rehab/plans/:id
 *   PATCH  /api/rehab/plans/:id
 *   POST   /api/rehab/sessions
 *   PATCH  /api/rehab/sessions/:id/complete
 *   GET    /api/rehab/sessions?planId=|patientId=
 *   GET    /api/rehab/alerts?doctorId=
 *   PATCH  /api/rehab/alerts/:id/acknowledge
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/databse";
import { broadcast } from "../lib/wsServer";

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const ExerciseSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  targetJoint: z.string().min(1),
  targetAngleMin: z.number(),
  targetAngleMax: z.number(),
  holdDurationSec: z.number().int().default(3),
  reps: z.number().int().default(10),
  sets: z.number().int().default(3),
  videoDemoUrl: z.string().optional(),
  order: z.number().int().default(0),
});

const CreatePlanSchema = z.object({
  patientId: z.string(),
  doctorId: z.string(),
  appointmentId: z.string().optional(),
  aiAnalysisId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  endsAt: z.string().datetime().optional(),
  exercises: z.array(ExerciseSchema).default([]),
});

const UpdatePlanSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).optional(),
  endsAt: z.string().datetime().optional().nullable(),
  exercises: z.array(ExerciseSchema).optional(),
});

const CreateSessionSchema = z.object({
  planId: z.string(),
  exerciseId: z.string(),
  patientId: z.string(),
});

const CompleteSessionSchema = z.object({
  repScores: z.array(z.number()),
  overallScore: z.number().min(0).max(100),
  feedbackNotes: z.string().optional(),
  completedAt: z.string().datetime().optional(),
});

// ─── Plans ────────────────────────────────────────────────────────────────────

router.post("/plans", async (req: Request, res: Response) => {
  const parsed = CreatePlanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { exercises, ...planData } = parsed.data;

  try {
    const plan = await prisma.rehabPlan.create({
      data: {
        ...planData,
        endsAt: planData.endsAt ? new Date(planData.endsAt) : undefined,
        exercises: {
          create: exercises.map((ex, idx) => ({
            ...ex,
            order: ex.order ?? idx,
          })),
        },
      },
      include: { exercises: { orderBy: { order: "asc" } } },
    });

    broadcast("rehab.plan.created", { planId: plan.id }, plan.patientId);

    res.status(201).json({ plan });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create rehab plan", message: err.message });
  }
});

router.get("/plans", async (req: Request, res: Response) => {
  const { patientId, doctorId } = req.query;
  if (!patientId && !doctorId) {
    return res.status(400).json({ error: "patientId or doctorId query param required" });
  }

  try {
    const plans = await prisma.rehabPlan.findMany({
      where: {
        ...(patientId ? { patientId: String(patientId) } : {}),
        ...(doctorId ? { doctorId: String(doctorId) } : {}),
      },
      include: {
        exercises: { orderBy: { order: "asc" } },
        sessions: { select: { id: true, overallScore: true, status: true } },
        _count: { select: { alerts: { where: { acknowledged: false } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch plans", message: err.message });
  }
});

router.get("/plans/:id", async (req: Request, res: Response) => {
  try {
    const plan = await prisma.rehabPlan.findUnique({
      where: { id: req.params.id },
      include: {
        exercises: { orderBy: { order: "asc" } },
        sessions: { orderBy: { startedAt: "asc" } },
        alerts: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    res.json({ plan });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch plan", message: err.message });
  }
});

router.patch("/plans/:id", async (req: Request, res: Response) => {
  const parsed = UpdatePlanSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { exercises, endsAt, ...rest } = parsed.data;

  try {
    const plan = await prisma.rehabPlan.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        endsAt: endsAt !== undefined ? (endsAt ? new Date(endsAt) : null) : undefined,
        ...(exercises !== undefined
          ? {
              exercises: {
                deleteMany: {},
                create: exercises.map((ex, idx) => ({ ...ex, order: ex.order ?? idx })),
              },
            }
          : {}),
      },
      include: { exercises: { orderBy: { order: "asc" } } },
    });
    res.json({ plan });
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ error: "Plan not found" });
    res.status(500).json({ error: "Failed to update plan", message: err.message });
  }
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

router.post("/sessions", async (req: Request, res: Response) => {
  const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  try {
    const session = await prisma.rehabSession.create({ data: parsed.data });
    broadcast("rehab.session.started", { sessionId: session.id, planId: session.planId }, session.patientId);
    res.status(201).json({ session });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to start session", message: err.message });
  }
});

router.patch("/sessions/:id/complete", async (req: Request, res: Response) => {
  const parsed = CompleteSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const { repScores, overallScore, feedbackNotes, completedAt } = parsed.data;

  try {
    const session = await prisma.rehabSession.update({
      where: { id: req.params.id },
      data: {
        status: "COMPLETED",
        overallScore,
        repScores,
        feedbackNotes,
        completedAt: completedAt ? new Date(completedAt) : new Date(),
      },
      include: { plan: { select: { doctorId: true } } },
    });

    broadcast("rehab.session.completed", { sessionId: session.id, overallScore }, session.patientId);

    // Auto-create alert if score is too low
    if (overallScore < 60) {
      const severity = overallScore < 40 ? "HIGH" : "MEDIUM";
      const alert = await prisma.rehabAlert.create({
        data: {
          planId: session.planId,
          doctorId: session.plan.doctorId,
          severity,
          reason: `Session score ${overallScore.toFixed(1)} is below threshold (${severity === "HIGH" ? "40" : "60"}).`,
        },
      });
      broadcast("rehab.alert.created", { alertId: alert.id, severity, planId: alert.planId }, session.plan.doctorId);
    }

    res.json({ session });
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ error: "Session not found" });
    res.status(500).json({ error: "Failed to complete session", message: err.message });
  }
});

router.get("/sessions", async (req: Request, res: Response) => {
  const { planId, patientId } = req.query;
  if (!planId && !patientId) {
    return res.status(400).json({ error: "planId or patientId query param required" });
  }

  try {
    const sessions = await prisma.rehabSession.findMany({
      where: {
        ...(planId ? { planId: String(planId) } : {}),
        ...(patientId ? { patientId: String(patientId) } : {}),
      },
      include: { exercise: true },
      orderBy: { startedAt: "desc" },
    });
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch sessions", message: err.message });
  }
});

// ─── Alerts ──────────────────────────────────────────────────────────────────

router.get("/alerts", async (req: Request, res: Response) => {
  const { doctorId } = req.query;
  if (!doctorId) {
    return res.status(400).json({ error: "doctorId query param required" });
  }

  try {
    const alerts = await prisma.rehabAlert.findMany({
      where: { doctorId: String(doctorId), acknowledged: false },
      include: { plan: { select: { title: true, patientId: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ alerts });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch alerts", message: err.message });
  }
});

router.patch("/alerts/:id/acknowledge", async (req: Request, res: Response) => {
  try {
    const alert = await prisma.rehabAlert.update({
      where: { id: req.params.id },
      data: { acknowledged: true },
    });
    res.json({ alert });
  } catch (err: any) {
    if (err.code === "P2025") return res.status(404).json({ error: "Alert not found" });
    res.status(500).json({ error: "Failed to acknowledge alert", message: err.message });
  }
});

export default router;
