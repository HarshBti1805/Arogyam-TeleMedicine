import { Router, Request, Response } from "express";
import { prisma } from "../config/databse";
import { createOrder, captureOrder } from "../utils/paypal";

const router = Router();

/**
 * POST /api/payments/paypal/create-order
 * body: { appointmentId, returnUrl, cancelUrl }
 *
 * Creates a PayPal order for the appointment's consultation fee.
 * Returns { orderId, approveUrl } — client opens approveUrl in browser.
 */
router.post("/paypal/create-order", async (req: Request, res: Response) => {
  try {
    const { appointmentId, returnUrl, cancelUrl } = req.body ?? {};

    if (!appointmentId || !returnUrl || !cancelUrl) {
      return res
        .status(400)
        .json({ error: "appointmentId, returnUrl and cancelUrl are required" });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        isFree: true,
        doctor: {
          select: {
            fullName: true,
            consultationFee: true,
          },
        },
        payment: { select: { status: true } },
      },
    });

    if (!appointment)
      return res.status(404).json({ error: "Appointment not found" });
    if (appointment.isFree)
      return res.status(400).json({ error: "This appointment is free — no payment needed" });
    if (appointment.payment?.status === "SUCCESS")
      return res.status(400).json({ error: "Payment already completed" });

    const fee = Number(appointment.doctor.consultationFee ?? 0);
    if (fee <= 0)
      return res.status(400).json({
        error: "This doctor has not set a consultation fee yet. Please contact them or ask them to update their profile.",
        code: "NO_FEE_SET",
      });

    const order = await createOrder({
      amount: fee,
      description: `Consultation with ${appointment.doctor.fullName}`,
      returnUrl,
      cancelUrl,
    });

    // Store the PayPal order ID in the payment record so we can capture it later
    await prisma.payment.upsert({
      where: { appointmentId },
      update: { transactionId: order.id, status: "PENDING" },
      create: {
        appointmentId,
        amount: fee,
        currency: "USD",
        status: "PENDING",
        method: "PAYPAL",
        transactionId: order.id,
      },
    });

    return res.json({
      orderId: order.id,
      approveUrl: order.approveUrl,
    });
  } catch (err: any) {
    console.error("create-order error", err?.response?.data ?? err.message);
    return res.status(500).json({
      error: "Failed to create PayPal order",
      message: err?.response?.data?.message ?? err.message,
    });
  }
});

/**
 * POST /api/payments/paypal/capture-order
 * body: { orderId, appointmentId }
 *
 * Called after the payer has approved the order in PayPal's checkout page.
 * Captures (completes) the payment and marks the appointment payment as SUCCESS.
 */
router.post("/paypal/capture-order", async (req: Request, res: Response) => {
  try {
    const { orderId, appointmentId } = req.body ?? {};

    if (!orderId || !appointmentId) {
      return res
        .status(400)
        .json({ error: "orderId and appointmentId are required" });
    }

    const capture = await captureOrder(orderId);

    if (capture.status !== "COMPLETED") {
      return res.status(402).json({
        error: `Payment not completed. PayPal status: ${capture.status}`,
      });
    }

    // Update payment record with the capture ID and SUCCESS status
    const payment = await prisma.payment.update({
      where: { appointmentId },
      data: {
        transactionId: capture.captureId,
        status: "SUCCESS",
      },
    });

    return res.json({
      message: "Payment captured successfully",
      payment,
      captureId: capture.captureId,
    });
  } catch (err: any) {
    console.error("capture-order error", err?.response?.data ?? err.message);
    return res.status(500).json({
      error: "Failed to capture PayPal payment",
      message: err?.response?.data?.message ?? err.message,
    });
  }
});

/**
 * GET /api/payments/paypal/status/:appointmentId
 * Returns current payment status for an appointment.
 */
router.get("/paypal/status/:appointmentId", async (req: Request, res: Response) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { appointmentId: req.params.appointmentId },
    });
    return res.json({ payment });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
