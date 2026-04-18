import "dotenv/config";
import http from "http";
import express, { Application, Request, Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { WebSocket } from "ws";
import { prisma } from "./config/databse";
import { wss, joinRoom, leaveAllRooms, broadcast } from "./lib/wsServer";

import authRoutes from "./routes/auth.routes";
import doctorsRoutes from "./routes/doctors.routes";
import appointmentsRoutes from "./routes/appointments.routes";
import paymentsRoutes from "./routes/payments.routes";
import recordingsRoutes from "./routes/recordings.routes";
import rehabRoutes from "./routes/rehab.routes";
import mediaRoutes from "./routes/media.routes";

const app: Application = express();
const PORT = process.env.PORT || 5000;

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
  : true;
app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(express.json({ limit: "50mb" }));

app.get("/", (_req: Request, res: Response) => {
  res.send("Telemedicine API is running");
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Feature routes
app.use("/api/auth", authRoutes);
app.use("/api/doctors", doctorsRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/appointments", recordingsRoutes);
app.use("/api/rehab", rehabRoutes);
app.use("/api/media", mediaRoutes);

// --- Legacy raw user endpoints ---
app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const { email, password, phone, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, phone: phone || undefined, role: role || "PATIENT" },
      select: { id: true, email: true, phone: true, role: true, createdAt: true, updatedAt: true },
    });
    res.status(201).json({ message: "User created successfully", user });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "User with this email or phone already exists" });
    }
    res.status(500).json({ error: "Failed to create user", message: error.message });
  }
});

app.get("/api/users", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, phone: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ message: "Users retrieved successfully", count: users.length, users });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch users", message: error.message });
  }
});

app.get("/api/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, phone: true, role: true, createdAt: true, updatedAt: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User retrieved successfully", user });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch user", message: error.message });
  }
});

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────

const server = http.createServer(app);

// Attach the noServer WSS to our HTTP server via upgrade event
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", `ws://localhost:${PORT}`);
  const roomId = url.searchParams.get("room");
  if (roomId) joinRoom(ws, roomId);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.event === "webrtc.signal" && msg.roomId) {
        broadcast("webrtc.signal", msg.payload, msg.roomId);
      }
      if (msg.event === "join.room" && msg.roomId) {
        joinRoom(ws, msg.roomId);
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => leaveAllRooms(ws));
  ws.on("error", () => leaveAllRooms(ws));
});

server.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket ready on ws://0.0.0.0:${PORT}`);
});

export { broadcast };
