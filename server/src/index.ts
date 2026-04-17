import "dotenv/config";
import express, { Application, Request, Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { prisma } from "./config/databse";

import authRoutes from "./routes/auth.routes";
import doctorsRoutes from "./routes/doctors.routes";
import appointmentsRoutes from "./routes/appointments.routes";
import paymentsRoutes from "./routes/payments.routes";

const app: Application = express();
const PORT = process.env.PORT || 5000;

// CORS - open during development. Restrict origins for production via env.
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
  : true; // allow all
app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(express.json({ limit: "5mb" }));

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

// --- Legacy raw user endpoints (kept for backwards compatibility) ---

app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const { email, password, phone, role } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        phone: phone || undefined,
        role: role || "PATIENT",
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.status(201).json({ message: "User created successfully", user });
  } catch (error: any) {
    console.error("Error creating user:", error);
    if (error.code === "P2002") {
      return res
        .status(409)
        .json({ error: "User with this email or phone already exists" });
    }
    res
      .status(500)
      .json({ error: "Failed to create user", message: error.message });
  }
});

app.get("/api/users", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      message: "Users retrieved successfully",
      count: users.length,
      users,
    });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch users", message: error.message });
  }
});

app.get("/api/users/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User retrieved successfully", user });
  } catch (error: any) {
    console.error("Error fetching user:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch user", message: error.message });
  }
});

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT} (LAN: http://172.21.253.38:${PORT})`);
});
