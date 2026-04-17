import { Router, Request, Response } from "express";
import { prisma } from "../config/databse";

const router = Router();

const apptSelect = {
  id: true,
  dateTime: true,
  status: true,
  type: true,
  isFree: true,
  symptoms: true,
  notes: true,
  meetingLink: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: {
      id: true,
      fullName: true,
      user: { select: { email: true, phone: true } },
    },
  },
  doctor: {
    select: {
      id: true,
      fullName: true,
      specialization: true,
      clinicName: true,
      clinicAddress: true,
      city: true,
      latitude: true,
      longitude: true,
      consultationFee: true,
      paypalEmail: true,
      user: { select: { email: true, phone: true } },
    },
  },
  payment: true,
} as const;

/**
 * Check whether an appointment between this patient and doctor would be free
 * (first-ever appointment for that pair).
 */
async function isFirstAppointment(
  patientId: string,
  doctorId: string
): Promise<boolean> {
  const count = await prisma.appointment.count({
    where: { patientId, doctorId },
  });
  return count === 0;
}

/**
 * POST /api/appointments
 * body: { patientId, doctorId, dateTime, type, symptoms?, notes? }
 * Creates the appointment and, if it's the patient's first with this doctor,
 * marks it free. Otherwise creates a PENDING payment record.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { patientId, doctorId, dateTime, type, symptoms, notes } =
      req.body ?? {};

    if (!patientId || !doctorId || !dateTime || !type) {
      return res
        .status(400)
        .json({ error: "patientId, doctorId, dateTime and type are required" });
    }

    if (!["ONLINE", "ON_SITE"].includes(type)) {
      return res
        .status(400)
        .json({ error: 'type must be "ONLINE" or "ON_SITE"' });
    }

    // Validate patient and doctor exist
    const [patient, doctor] = await Promise.all([
      prisma.patientProfile.findUnique({ where: { id: patientId } }),
      prisma.doctorProfile.findUnique({ where: { id: doctorId } }),
    ]);

    if (!patient) return res.status(404).json({ error: "Patient not found" });
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });

    const free = await isFirstAppointment(patientId, doctorId);
    const fee = Number(doctor.consultationFee ?? 0);

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        dateTime: new Date(dateTime),
        type,
        isFree: free,
        symptoms: symptoms || undefined,
        notes: notes || undefined,
        // If not free, create a pending payment record
        ...(!free && fee > 0
          ? {
              payment: {
                create: {
                  amount: fee,
                  currency: "USD",
                  status: "PENDING",
                  method: "PAYPAL",
                },
              },
            }
          : {}),
      },
      select: apptSelect,
    });

    return res.status(201).json({
      message: "Appointment created",
      appointment,
      isFree: free,
    });
  } catch (err: any) {
    console.error("POST /appointments error", err);
    return res
      .status(500)
      .json({ error: "Failed to create appointment", message: err.message });
  }
});

/**
 * GET /api/appointments?patientId=&doctorId=
 * Returns appointments filtered by patient or doctor.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { patientId, doctorId } = req.query as Record<
      string,
      string | undefined
    >;

    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (doctorId) where.doctorId = doctorId;

    if (!patientId && !doctorId) {
      return res
        .status(400)
        .json({ error: "Provide at least patientId or doctorId" });
    }

    const appointments = await prisma.appointment.findMany({
      where,
      select: apptSelect,
      orderBy: { dateTime: "asc" },
    });

    return res.json({ count: appointments.length, appointments });
  } catch (err: any) {
    console.error("GET /appointments error", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch appointments", message: err.message });
  }
});

/**
 * GET /api/appointments/check-free?patientId=&doctorId=
 * Quick check: is the next appointment between this pair free?
 */
router.get("/check-free", async (req: Request, res: Response) => {
  try {
    const { patientId, doctorId } = req.query as Record<string, string>;
    if (!patientId || !doctorId) {
      return res
        .status(400)
        .json({ error: "patientId and doctorId are required" });
    }
    const free = await isFirstAppointment(patientId, doctorId);
    return res.json({ isFree: free });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Failed to check", message: err.message });
  }
});

/**
 * GET /api/appointments/:id
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      select: apptSelect,
    });
    if (!appt) return res.status(404).json({ error: "Appointment not found" });
    return res.json({ appointment: appt });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Failed to fetch appointment", message: err.message });
  }
});

/**
 * PATCH /api/appointments/:id/status
 * body: { status: "CONFIRMED" | "CANCELLED" | "COMPLETED" }
 */
router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const { status } = req.body ?? {};
    const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of ${validStatuses.join(", ")}` });
    }
    const appt = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status },
      select: apptSelect,
    });
    return res.json({ message: "Status updated", appointment: appt });
  } catch (err: any) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Appointment not found" });
    return res
      .status(500)
      .json({ error: "Failed to update status", message: err.message });
  }
});

/**
 * PATCH /api/appointments/:id/payment
 * body: { transactionId, status? }
 * Patient calls this after completing PayPal payment to record the transaction.
 */
router.patch("/:id/payment", async (req: Request, res: Response) => {
  try {
    const { transactionId, status = "SUCCESS" } = req.body ?? {};
    if (!transactionId) {
      return res.status(400).json({ error: "transactionId is required" });
    }

    // Upsert payment record
    const appt = await prisma.appointment.findUnique({
      where: { id: req.params.id },
      select: { payment: true, isFree: true, doctor: { select: { consultationFee: true } } },
    });
    if (!appt) return res.status(404).json({ error: "Appointment not found" });

    if (appt.isFree) {
      return res.status(400).json({ error: "This appointment is free — no payment needed" });
    }

    const payment = appt.payment
      ? await prisma.payment.update({
          where: { appointmentId: req.params.id },
          data: { transactionId, status },
        })
      : await prisma.payment.create({
          data: {
            appointmentId: req.params.id,
            amount: appt.doctor.consultationFee ?? 0,
            currency: "USD",
            status,
            method: "PAYPAL",
            transactionId,
          },
        });

    return res.json({ message: "Payment recorded", payment });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Failed to record payment", message: err.message });
  }
});

export default router;
