/**
 * Integration test: POST /api/rehab/plans happy path.
 * Uses supertest + a lightweight Express app setup (no WS server started).
 */
import request from "supertest";
import express from "express";

// ─── Minimal app (no http.createServer, no WS) ───────────────────────────────

// Mock Prisma to avoid needing a live DB in CI
jest.mock("../config/databse", () => ({
  prisma: {
    rehabPlan: {
      create: jest.fn().mockResolvedValue({
        id: "plan-1",
        patientId: "patient-1",
        doctorId: "doctor-1",
        appointmentId: null,
        aiAnalysisId: null,
        title: "Test Plan",
        description: "A test rehab plan",
        status: "ACTIVE",
        startedAt: new Date().toISOString(),
        endsAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        exercises: [
          {
            id: "ex-1",
            planId: "plan-1",
            name: "Knee Flex",
            description: null,
            targetJoint: "knee_left",
            targetAngleMin: 90,
            targetAngleMax: 140,
            holdDurationSec: 3,
            reps: 10,
            sets: 3,
            videoDemoUrl: null,
            order: 0,
          },
        ],
      }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    rehabSession: {
      create: jest.fn().mockResolvedValue({ id: "session-1", planId: "plan-1" }),
      update: jest.fn().mockResolvedValue({
        id: "session-1",
        status: "COMPLETED",
        overallScore: 75,
        plan: { doctorId: "doctor-1" },
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    rehabAlert: {
      create: jest.fn().mockResolvedValue({ id: "alert-1" }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

// Mock broadcast to avoid WS dependency
jest.mock("../lib/wsServer", () => ({
  broadcast: jest.fn(),
  wss: { on: jest.fn(), clients: new Set() },
  joinRoom: jest.fn(),
  leaveAllRooms: jest.fn(),
}));

import rehabRouter from "../routes/rehab.routes";

const app = express();
app.use(express.json());
app.use("/api/rehab", rehabRouter);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/rehab/plans", () => {
  it("creates a plan with exercises and returns 201", async () => {
    const payload = {
      patientId: "patient-1",
      doctorId: "doctor-1",
      title: "Test Plan",
      description: "A test rehab plan",
      exercises: [
        {
          name: "Knee Flex",
          targetJoint: "knee_left",
          targetAngleMin: 90,
          targetAngleMax: 140,
          holdDurationSec: 3,
          reps: 10,
          sets: 3,
          order: 0,
        },
      ],
    };

    const res = await request(app).post("/api/rehab/plans").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.plan).toBeDefined();
    expect(res.body.plan.title).toBe("Test Plan");
    expect(res.body.plan.exercises).toHaveLength(1);
    expect(res.body.plan.exercises[0].name).toBe("Knee Flex");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app).post("/api/rehab/plans").send({
      title: "Incomplete Plan",
      // Missing patientId and doctorId
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 400 when exercises array has invalid items", async () => {
    const res = await request(app).post("/api/rehab/plans").send({
      patientId: "patient-1",
      doctorId: "doctor-1",
      title: "Bad Exercise Plan",
      exercises: [
        { name: "" }, // name too short
      ],
    });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/rehab/sessions/:id/complete", () => {
  it("completes a session and returns updated session", async () => {
    const res = await request(app)
      .patch("/api/rehab/sessions/session-1/complete")
      .send({ repScores: [80, 75, 90], overallScore: 81.7 });

    expect(res.status).toBe(200);
    expect(res.body.session).toBeDefined();
  });

  it("returns 400 when overallScore is out of range", async () => {
    const res = await request(app)
      .patch("/api/rehab/sessions/session-1/complete")
      .send({ repScores: [], overallScore: 150 }); // > 100

    expect(res.status).toBe(400);
  });
});
