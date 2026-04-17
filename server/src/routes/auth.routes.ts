import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/databse";

const router = Router();

/**
 * Shape of the user object we return to clients (never includes password).
 */
const userSelect = {
  id: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  patientProfile: true,
  doctorProfile: true,
} as const;

/**
 * POST /api/auth/register/patient
 * body: { email, password, phone?, fullName, dob?, gender?, bloodGroup?, allergies?,
 *         city?, latitude?, longitude? }
 */
router.post("/register/patient", async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      phone,
      fullName,
      dob,
      gender,
      bloodGroup,
      allergies,
      city,
      latitude,
      longitude,
    } = req.body ?? {};

    if (!email || !password || !fullName) {
      return res
        .status(400)
        .json({ error: "email, password and fullName are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        phone: phone || undefined,
        role: "PATIENT",
        patientProfile: {
          create: {
            fullName,
            dob: dob ? new Date(dob) : undefined,
            gender: gender || undefined,
            bloodGroup: bloodGroup || undefined,
            allergies: allergies || undefined,
            city: city || undefined,
            latitude:
              typeof latitude === "number" ? latitude : undefined,
            longitude:
              typeof longitude === "number" ? longitude : undefined,
          },
        },
      },
      select: userSelect,
    });

    return res.status(201).json({ message: "Patient registered", user });
  } catch (err: any) {
    console.error("register/patient error", err);
    if (err.code === "P2002") {
      return res
        .status(409)
        .json({ error: "Email or phone already in use" });
    }
    return res
      .status(500)
      .json({ error: "Failed to register patient", message: err.message });
  }
});

/**
 * POST /api/auth/register/doctor
 * body: { email, password, phone?, fullName, specialization, licenseNumber,
 *         experienceYears?, consultationFee?, bio?,
 *         clinicName?, clinicAddress?, city?, country?, latitude, longitude }
 */
router.post("/register/doctor", async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      phone,
      fullName,
      specialization,
      licenseNumber,
      experienceYears,
      consultationFee,
      bio,
      clinicName,
      clinicAddress,
      city,
      country,
      latitude,
      longitude,
    } = req.body ?? {};

    if (
      !email ||
      !password ||
      !fullName ||
      !specialization ||
      !licenseNumber
    ) {
      return res.status(400).json({
        error:
          "email, password, fullName, specialization and licenseNumber are required",
      });
    }

    if (
      latitude !== undefined &&
      longitude !== undefined &&
      (typeof latitude !== "number" || typeof longitude !== "number")
    ) {
      return res
        .status(400)
        .json({ error: "latitude and longitude must be numbers" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        phone: phone || undefined,
        role: "DOCTOR",
        doctorProfile: {
          create: {
            fullName,
            specialization,
            licenseNumber,
            experienceYears:
              typeof experienceYears === "number" ? experienceYears : 0,
            consultationFee:
              typeof consultationFee === "number" ? consultationFee : 0,
            bio: bio || undefined,
            clinicName: clinicName || undefined,
            clinicAddress: clinicAddress || undefined,
            city: city || undefined,
            country: country || undefined,
            latitude:
              typeof latitude === "number" ? latitude : undefined,
            longitude:
              typeof longitude === "number" ? longitude : undefined,
          },
        },
      },
      select: userSelect,
    });

    return res.status(201).json({ message: "Doctor registered", user });
  } catch (err: any) {
    console.error("register/doctor error", err);
    if (err.code === "P2002") {
      return res.status(409).json({
        error: "Email, phone or license number already in use",
      });
    }
    return res
      .status(500)
      .json({ error: "Failed to register doctor", message: err.message });
  }
});

/**
 * POST /api/auth/login
 * body: { email, password, role? }   (role optional, used as a hint)
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body ?? {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { ...userSelect, password: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (role && user.role !== role) {
      return res.status(403).json({
        error: `Account exists but is not a ${role}. It is a ${user.role}.`,
      });
    }

    // strip password before returning
    const { password: _pw, ...safeUser } = user as any;
    return res.json({ message: "Login successful", user: safeUser });
  } catch (err: any) {
    console.error("login error", err);
    return res
      .status(500)
      .json({ error: "Login failed", message: err.message });
  }
});

export default router;
