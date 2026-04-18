import { google } from "googleapis";

const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const GOOGLE_IMPERSONATED_USER = process.env.GOOGLE_IMPERSONATED_USER;
const APPOINTMENT_TIMEZONE = process.env.APPOINTMENT_TIMEZONE || "Asia/Kolkata";
const APPOINTMENT_DURATION_MINUTES = Number(
  process.env.APPOINTMENT_DURATION_MINUTES || 30
);

type AppointmentBookingInput = {
  appointmentId: string;
  dateTime: Date;
  type: "ONLINE" | "ON_SITE";
  symptoms?: string | null;
  notes?: string | null;
  doctorName: string;
  doctorEmail: string;
  patientName: string;
  patientEmail: string;
  clinicName?: string | null;
  clinicAddress?: string | null;
};

export type CalendarBookingResult = {
  eventId: string;
  eventLink: string | null;
  meetingLink: string | null;
};

export type GoogleCalendarHealth = {
  configured: boolean;
  authenticated: boolean;
  calendarAccessible: boolean;
  writable: boolean;
  calendarId: string | null;
  message: string;
};

function hasGoogleCalendarConfig(): boolean {
  return !!GOOGLE_CLIENT_EMAIL && !!GOOGLE_PRIVATE_KEY && !!GOOGLE_CALENDAR_ID;
}

function getCalendarClient() {
  if (!hasGoogleCalendarConfig()) {
    throw new Error(
      "Google Calendar is not configured. Set GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_CALENDAR_ID."
    );
  }

  const auth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: GOOGLE_IMPERSONATED_USER || undefined,
  });

  return google.calendar({ version: "v3", auth });
}

function buildDescription(input: AppointmentBookingInput): string {
  const lines = [
    `Appointment ID: ${input.appointmentId}`,
    `Type: ${input.type === "ONLINE" ? "Online Consultation" : "In-Clinic Consultation"}`,
    `Doctor: ${input.doctorName} <${input.doctorEmail}>`,
    `Patient: ${input.patientName} <${input.patientEmail}>`,
  ];

  if (input.type === "ON_SITE") {
    const location = [input.clinicName, input.clinicAddress].filter(Boolean).join(", ");
    if (location) lines.push(`Clinic: ${location}`);
  }

  if (input.symptoms) lines.push(`Symptoms: ${input.symptoms}`);
  if (input.notes) lines.push(`Notes: ${input.notes}`);

  return lines.join("\n");
}

export function isGoogleCalendarEnabled(): boolean {
  return hasGoogleCalendarConfig();
}

export async function createGoogleCalendarBooking(
  input: AppointmentBookingInput
): Promise<CalendarBookingResult> {
  const calendar = getCalendarClient();

  const start = new Date(input.dateTime);
  const end = new Date(start.getTime() + APPOINTMENT_DURATION_MINUTES * 60_000);

  const location =
    input.type === "ON_SITE"
      ? [input.clinicName, input.clinicAddress].filter(Boolean).join(", ") || undefined
      : undefined;

  const event = await calendar.events.insert({
    calendarId: GOOGLE_CALENDAR_ID!,
    conferenceDataVersion: input.type === "ONLINE" ? 1 : 0,
    sendUpdates: "all",
    requestBody: {
      summary: `${input.type === "ONLINE" ? "Online" : "Clinic"} Consultation · ${input.patientName} with Dr. ${input.doctorName}`,
      description: buildDescription(input),
      location,
      start: {
        dateTime: start.toISOString(),
        timeZone: APPOINTMENT_TIMEZONE,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: APPOINTMENT_TIMEZONE,
      },
      attendees: [
        { email: input.doctorEmail, displayName: input.doctorName },
        { email: input.patientEmail, displayName: input.patientName },
      ],
      reminders: {
        useDefault: true,
      },
      ...(input.type === "ONLINE"
        ? {
            conferenceData: {
              createRequest: {
                requestId: `appt-${input.appointmentId}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
          }
        : {}),
    },
  });

  return {
    eventId: event.data.id || "",
    eventLink: event.data.htmlLink ?? null,
    meetingLink: event.data.hangoutLink ?? null,
  };
}

export async function getGoogleCalendarHealth(): Promise<GoogleCalendarHealth> {
  if (!hasGoogleCalendarConfig()) {
    return {
      configured: false,
      authenticated: false,
      calendarAccessible: false,
      writable: false,
      calendarId: GOOGLE_CALENDAR_ID ?? null,
      message:
        "Missing GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, or GOOGLE_CALENDAR_ID.",
    };
  }

  try {
    const calendar = getCalendarClient();

    await calendar.calendars.get({ calendarId: GOOGLE_CALENDAR_ID! });

    const start = new Date(Date.now() + 60_000);
    const end = new Date(start.getTime() + 60_000);

    const probeEvent = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID!,
      sendUpdates: "none",
      requestBody: {
        summary: "Arogyam Calendar Health Check",
        description: "Temporary probe event created by /health/calendar",
        start: {
          dateTime: start.toISOString(),
          timeZone: APPOINTMENT_TIMEZONE,
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: APPOINTMENT_TIMEZONE,
        },
      },
    });

    if (probeEvent.data.id) {
      await calendar.events.delete({
        calendarId: GOOGLE_CALENDAR_ID!,
        eventId: probeEvent.data.id,
        sendUpdates: "none",
      });
    }

    return {
      configured: true,
      authenticated: true,
      calendarAccessible: true,
      writable: true,
      calendarId: GOOGLE_CALENDAR_ID!,
      message: "Google Calendar is configured and writable.",
    };
  } catch (err: any) {
    return {
      configured: true,
      authenticated: false,
      calendarAccessible: false,
      writable: false,
      calendarId: GOOGLE_CALENDAR_ID!,
      message: err?.message || "Google Calendar health check failed.",
    };
  }
}