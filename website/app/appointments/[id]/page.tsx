"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  recordings,
  type AIAnalysis,
  type Recording,
  type SuggestedExercise,
} from "@/lib/rehab-api";
import { API_URL, api } from "@/lib/api";
import {
  ArrowLeft,
  Video,
  Mic,
  MapPin,
  Clock,
  User,
  FileText,
  Brain,
  CheckCircle,
  Upload,
  Play,
  Loader2,
  AlertCircle,
  Activity,
  Zap,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Wifi,
  WifiOff,
  Volume2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AppointmentDetail {
  id: string;
  dateTime: string;
  status: string;
  type: "ONLINE" | "ON_SITE";
  isFree: boolean;
  symptoms: string | null;
  notes: string | null;
  meetingLink: string | null;
  patient: {
    id: string;
    fullName: string;
    user: { email: string; phone: string | null };
  };
  doctor: {
    id: string;
    fullName: string;
    specialization: string;
  };
}

type Tab = "consult" | "recording" | "analysis";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  CONFIRMED: "bg-blue-100 text-blue-700 border-blue-200",
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AppointmentDetailPage() {
  const { id: appointmentId } = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("consult");
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loadingAppt, setLoadingAppt] = useState(true);
  const [loadingRec, setLoadingRec] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [approving, setApproving] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch appointment detail ────────────────────────────────────────────────
  useEffect(() => {
    api
      .get<{ appointment: AppointmentDetail }>(`/api/appointments/${appointmentId}`)
      .then(({ appointment: a }) => setAppointment(a))
      .catch(() => setError("Failed to load appointment."))
      .finally(() => setLoadingAppt(false));
  }, [appointmentId]);

  // ── Fetch recording ────────────────────────────────────────────────────────
  const fetchRecording = useCallback(async () => {
    try {
      const { recording: rec } = await recordings.get(appointmentId);
      setRecording(rec);
    } catch {
      // no recording yet
    } finally {
      setLoadingRec(false);
    }
  }, [appointmentId]);

  useEffect(() => { fetchRecording(); }, [fetchRecording]);

  // ── Fetch analysis ─────────────────────────────────────────────────────────
  const fetchAnalysis = useCallback(async () => {
    setLoadingAnalysis(true);
    try {
      const { analysis: a } = await recordings.getAnalysis(appointmentId);
      setAnalysis(a);
      setAnalysisInProgress(false);
    } catch {
      setAnalysis(null);
    } finally {
      setLoadingAnalysis(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    if (tab === "analysis") fetchAnalysis();
  }, [tab, fetchAnalysis]);

  // ── WebSocket for real-time analysis events ────────────────────────────────
  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_API_URL?.replace("http", "ws") ?? "ws://localhost:5000";
    const ws = new WebSocket(`${base}?room=${appointmentId}`);

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === "analysis.pipeline.started") {
          setAnalysisInProgress(true);
        }
        if (
          msg.event === "analysis.result.ready" ||
          msg.event === "transcription.complete"
        ) {
          setAnalysisInProgress(false);
          setAnalysis(msg.payload?.analysis ?? null);
          fetchRecording(); // refresh transcript
        }
      } catch {}
    };

    return () => ws.close();
  }, [appointmentId, fetchRecording]);

  // ── Upload recording file ──────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const form = new FormData();
    form.append("file", file);

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_URL}/api/appointments/${appointmentId}/recording`);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable)
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.statusText}`));
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(form);
      });
      setUploadDone(true);
      setAnalysisInProgress(true);
      fetchRecording();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Approve analysis ───────────────────────────────────────────────────────
  const handleApprove = async () => {
    setApproving(true);
    try {
      const { analysis: a } = await recordings.approveAnalysis(appointmentId);
      setAnalysis(a);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApproving(false);
    }
  };

  // ── Navigate to rehab plan creation ───────────────────────────────────────
  const handleCreatePlan = (exercises: SuggestedExercise[]) => {
    const params = new URLSearchParams({
      appointmentId,
      exercises: JSON.stringify(exercises),
      analysisId: analysis?.id ?? "",
    });
    router.push(`/rehab/create?${params}`);
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loadingAppt) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const apptDate = appointment ? new Date(appointment.dateTime) : null;
  const isOnline = appointment?.type === "ONLINE";

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "consult", label: "Consultation", icon: isOnline ? Video : MapPin },
    { id: "recording", label: "Recording & Transcript", icon: Mic },
    { id: "analysis", label: "AI Analysis", icon: Brain },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* ── Top Header ── */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-neutral-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-neutral-600" />
            </button>
            <div>
              <h1 className="font-neue-bold text-neutral-900 text-lg">
                Appointment
              </h1>
              <p className="text-xs text-neutral-400 font-poppins">{appointmentId}</p>
            </div>
          </div>

          {/* WS indicator */}
          <div className="flex items-center gap-2">
            {wsConnected ? (
              <span className="flex items-center gap-1.5 text-xs text-green-600 font-poppins">
                <Wifi className="w-3.5 h-3.5" /> Live
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-neutral-400 font-poppins">
                <WifiOff className="w-3.5 h-3.5" /> Offline
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-sm text-red-700"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* ── Appointment Hero Card ── */}
        {appointment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 mb-6"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Patient avatar + info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-neutral-900 flex items-center justify-center text-white font-bold text-xl shrink-0">
                  {appointment.patient.fullName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-neue-bold text-neutral-900 truncate">
                    {appointment.patient.fullName}
                  </h2>
                  <p className="text-sm text-neutral-500 font-poppins">
                    {appointment.patient.user.email}
                  </p>
                  {appointment.patient.user.phone && (
                    <p className="text-sm text-neutral-500 font-poppins">
                      {appointment.patient.user.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Meta badges */}
              <div className="flex flex-wrap gap-3 md:text-right">
                {/* Date / time */}
                {apptDate && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100">
                    <Clock className="w-4 h-4 text-neutral-500" />
                    <div>
                      <p className="text-xs text-neutral-500 font-poppins">
                        {apptDate.toLocaleDateString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-sm font-semibold text-neutral-900">
                        {apptDate.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Type */}
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                    isOnline
                      ? "bg-blue-50 text-blue-700"
                      : "bg-green-50 text-green-700"
                  }`}
                >
                  {isOnline ? (
                    <Video className="w-4 h-4" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  <span className="text-sm font-semibold font-poppins">
                    {isOnline ? "Video Call" : "In-Person"}
                  </span>
                </div>

                {/* Status */}
                <span
                  className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                    STATUS_COLORS[appointment.status] ??
                    "bg-neutral-100 text-neutral-700 border-neutral-200"
                  }`}
                >
                  {appointment.status}
                </span>

                {/* Free badge */}
                {appointment.isFree && (
                  <span className="px-3 py-2 rounded-xl text-sm font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    Free
                  </span>
                )}
              </div>
            </div>

            {/* Symptoms / notes */}
            {(appointment.symptoms || appointment.notes) && (
              <div className="mt-5 pt-5 border-t border-neutral-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                {appointment.symptoms && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                      Symptoms
                    </p>
                    <p className="text-sm text-neutral-700 font-poppins">
                      {appointment.symptoms}
                    </p>
                  </div>
                )}
                {appointment.notes && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">
                      Notes
                    </p>
                    <p className="text-sm text-neutral-700 font-poppins">
                      {appointment.notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Tab Nav ── */}
        <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all font-poppins ${
                tab === t.id
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: Consultation
        ══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {tab === "consult" && (
            <motion.div
              key="consult"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {isOnline ? (
                /* ── Video call card ──────────────────────────────────── */
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                  {/* Dark banner */}
                  <div className="bg-neutral-900 px-6 py-10 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                      <Video className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-neue-bold text-white mb-1">
                      Video Consultation
                    </h3>
                    <p className="text-neutral-400 text-sm font-poppins mb-6 max-w-sm">
                      This is an online appointment. Start the video call when both you
                      and the patient are ready. The call session is end-to-end encrypted.
                    </p>

                    {appointment?.meetingLink ? (
                      <a
                        href={appointment.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-xl font-semibold hover:bg-neutral-100 transition-colors"
                      >
                        <Video className="w-5 h-5" />
                        Join Meeting
                        <ExternalLink className="w-4 h-4 opacity-60" />
                      </a>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <button className="flex items-center gap-2 px-6 py-3 bg-white text-neutral-900 rounded-xl font-semibold hover:bg-neutral-100 transition-colors">
                          <Video className="w-5 h-5" />
                          Start Video Call
                        </button>
                        <p className="text-xs text-neutral-500">
                          WebRTC session will be created when you start
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Info row */}
                  <div className="px-6 py-4 grid grid-cols-3 divide-x divide-neutral-100">
                    {[
                      { label: "Protocol", value: "WebRTC" },
                      { label: "Encryption", value: "E2E" },
                      { label: "Max duration", value: "60 min" },
                    ].map((item) => (
                      <div key={item.label} className="px-4 first:pl-0 last:pr-0 text-center">
                        <p className="text-xs text-neutral-400 font-poppins">{item.label}</p>
                        <p className="text-sm font-semibold text-neutral-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* ── In-person card ───────────────────────────────────── */
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-green-50">
                      <MapPin className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-neue-bold text-neutral-900">In-Person Appointment</h3>
                      <p className="text-sm text-neutral-500 font-poppins">
                        Patient visits the clinic
                      </p>
                    </div>
                  </div>
                  {appointment?.doctor && (
                    <div className="bg-neutral-50 rounded-xl p-4 text-sm text-neutral-700 font-poppins">
                      <p className="font-semibold">{appointment.doctor.fullName}</p>
                      <p className="text-neutral-500">{appointment.doctor.specialization}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Quick actions ──────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: Mic,
                    label: "Go to Recording",
                    sub: recording ? "Recording exists" : "Upload a recording",
                    tab: "recording" as Tab,
                    badge: recording ? "green" : "gray",
                  },
                  {
                    icon: Brain,
                    label: "View AI Analysis",
                    sub: analysis ? "Analysis ready" : "Awaiting recording",
                    tab: "analysis" as Tab,
                    badge: analysis ? "blue" : "gray",
                  },
                  {
                    icon: Activity,
                    label: "Create Rehab Plan",
                    sub: "Open plan builder",
                    tab: null,
                    href: `/rehab/create?appointmentId=${appointmentId}`,
                    badge: "purple",
                  },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      if (action.tab) setTab(action.tab);
                      else if (action.href) router.push(action.href);
                    }}
                    className="flex items-center gap-4 bg-white rounded-2xl border border-neutral-200 p-5 hover:border-neutral-400 hover:shadow-sm transition-all group text-left"
                  >
                    <div
                      className={`p-3 rounded-xl ${
                        action.badge === "green"
                          ? "bg-green-50"
                          : action.badge === "blue"
                          ? "bg-blue-50"
                          : action.badge === "purple"
                          ? "bg-purple-50"
                          : "bg-neutral-100"
                      }`}
                    >
                      <action.icon
                        className={`w-5 h-5 ${
                          action.badge === "green"
                            ? "text-green-600"
                            : action.badge === "blue"
                            ? "text-blue-600"
                            : action.badge === "purple"
                            ? "text-purple-600"
                            : "text-neutral-500"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900 text-sm">{action.label}</p>
                      <p className="text-xs text-neutral-500 font-poppins mt-0.5">
                        {action.sub}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-700 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: Recording & Transcript
          ══════════════════════════════════════════════════════════════ */}
          {tab === "recording" && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* Analysis in-progress banner */}
              {analysisInProgress && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 px-5 py-4 bg-blue-50 border border-blue-200 rounded-xl"
                >
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-700">
                      AI analysis in progress
                    </p>
                    <p className="text-xs text-blue-600 font-poppins">
                      Transcribing audio and generating insights — results will appear
                      automatically.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Playback card */}
              {loadingRec ? (
                <div className="bg-white rounded-2xl border border-neutral-200 p-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
                </div>
              ) : recording ? (
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                  {/* Media header */}
                  <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl ${
                          recording.mediaType === "AUDIO"
                            ? "bg-purple-50"
                            : "bg-blue-50"
                        }`}
                      >
                        {recording.mediaType === "AUDIO" ? (
                          <Volume2 className="w-5 h-5 text-purple-600" />
                        ) : (
                          <Video className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900">
                          {recording.mediaType === "AUDIO" ? "Audio" : "Video"} Recording
                        </p>
                        {recording.durationSec != null && (
                          <p className="text-xs text-neutral-400 font-poppins">
                            Duration:{" "}
                            {Math.floor(recording.durationSec / 60)}m{" "}
                            {recording.durationSec % 60}s
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={fetchRecording}
                      className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw className="w-4 h-4 text-neutral-400" />
                    </button>
                  </div>

                  {/* Player */}
                  <div className="p-6">
                    {recording.mediaType === "AUDIO" ? (
                      <audio
                        controls
                        className="w-full"
                        style={{ accentColor: "#171717" }}
                      >
                        <source src={`${API_URL}${recording.mediaUrl}`} />
                        Your browser does not support audio playback.
                      </audio>
                    ) : (
                      <video
                        controls
                        className="w-full rounded-xl bg-black max-h-80"
                        style={{ accentColor: "#171717" }}
                      >
                        <source src={`${API_URL}${recording.mediaUrl}`} />
                        Your browser does not support video playback.
                      </video>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Upload section ──────────────────────────────────── */
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm">
                  <div className="px-6 py-4 border-b border-neutral-100">
                    <h3 className="font-neue-bold text-neutral-900">Upload Recording</h3>
                    <p className="text-sm text-neutral-500 font-poppins mt-0.5">
                      Upload the consultation audio or video to trigger AI analysis
                    </p>
                  </div>
                  <div className="p-6">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />

                    {uploadDone ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center gap-3 py-8 text-center"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
                          <CheckCircle className="w-7 h-7 text-green-600" />
                        </div>
                        <p className="font-semibold text-neutral-900">
                          Upload complete!
                        </p>
                        <p className="text-sm text-neutral-500 font-poppins">
                          AI analysis has started. Results will appear automatically.
                        </p>
                      </motion.div>
                    ) : uploading ? (
                      <div className="py-8">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-poppins text-neutral-700">
                            Uploading…
                          </span>
                          <span className="text-sm font-semibold text-neutral-900">
                            {uploadProgress}%
                          </span>
                        </div>
                        <div className="w-full bg-neutral-100 rounded-full h-2">
                          <motion.div
                            className="bg-neutral-900 h-2 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-neutral-200 rounded-xl p-10 flex flex-col items-center gap-3 hover:border-neutral-400 hover:bg-neutral-50 transition-all group"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-neutral-100 group-hover:bg-neutral-200 flex items-center justify-center transition-colors">
                          <Upload className="w-7 h-7 text-neutral-500" />
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-neutral-900">
                            Click to upload recording
                          </p>
                          <p className="text-sm text-neutral-500 font-poppins mt-1">
                            MP3, WAV, M4A, MP4, MOV supported
                          </p>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Transcript card */}
              {recording?.transcript && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-neutral-200 shadow-sm"
                >
                  <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-neutral-500" />
                    <div>
                      <h3 className="font-neue-bold text-neutral-900">Transcript</h3>
                      <p className="text-xs text-neutral-400 font-poppins">
                        Language: {recording.transcript.language?.toUpperCase() ?? "EN"}
                      </p>
                    </div>
                  </div>

                  <div className="p-6">
                    {recording.transcript.segments?.length > 0 ? (
                      /* Segmented transcript */
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                        {recording.transcript.segments.map((seg, i) => (
                          <div key={i} className="flex gap-3">
                            <span className="shrink-0 text-xs text-neutral-400 font-mono mt-0.5 w-12 text-right">
                              {Math.floor(seg.start / 60)
                                .toString()
                                .padStart(2, "0")}
                              :
                              {Math.floor(seg.start % 60)
                                .toString()
                                .padStart(2, "0")}
                            </span>
                            <p className="text-sm text-neutral-700 font-poppins leading-relaxed">
                              {seg.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Raw text fallback */
                      <div className="bg-neutral-50 rounded-xl p-4 text-sm text-neutral-700 leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap font-poppins">
                        {recording.transcript.rawText || "Transcript is empty."}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* No transcript yet */}
              {recording && !recording.transcript && !analysisInProgress && (
                <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700 font-poppins">
                    Transcript is not ready yet. It will appear here once processing
                    completes.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB: AI Analysis
          ══════════════════════════════════════════════════════════════ */}
          {tab === "analysis" && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* In-progress / loading */}
              {(loadingAnalysis || analysisInProgress) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-10 flex flex-col items-center gap-4 text-center"
                >
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center">
                      <Brain className="w-8 h-8 text-neutral-400" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <Loader2 className="w-3 h-3 text-white animate-spin" />
                    </div>
                  </div>
                  <div>
                    <p className="font-neue-bold text-neutral-900 text-lg">
                      Analysing consultation…
                    </p>
                    <p className="text-sm text-neutral-500 font-poppins mt-1">
                      Whisper is transcribing • GPT-4o is generating insights
                    </p>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {["Transcription", "Key Findings", "Exercise Plan"].map(
                      (step, i) => (
                        <span
                          key={step}
                          className="px-3 py-1 rounded-full text-xs font-poppins bg-neutral-100 text-neutral-500"
                          style={{ animationDelay: `${i * 0.3}s` }}
                        >
                          {step}
                        </span>
                      )
                    )}
                  </div>
                </motion.div>
              )}

              {/* Analysis content */}
              {!loadingAnalysis && !analysisInProgress && analysis && (
                <>
                  {/* Summary card */}
                  <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-50">
                          <Brain className="w-5 h-5 text-purple-600" />
                        </div>
                        <h3 className="font-neue-bold text-neutral-900">
                          Clinical Summary
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-16 rounded-full bg-neutral-100 overflow-hidden"
                          title={`Confidence ${Math.round(analysis.confidence * 100)}%`}
                        >
                          <div
                            className="h-full bg-neutral-900 rounded-full"
                            style={{ width: `${analysis.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-neutral-400 font-poppins">
                          {Math.round(analysis.confidence * 100)}% confidence
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <p className="text-sm text-neutral-700 leading-relaxed font-poppins">
                        {analysis.summary}
                      </p>
                    </div>
                  </div>

                  {/* Key Findings */}
                  {analysis.keyFindings.length > 0 && (
                    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-amber-50">
                          <Zap className="w-5 h-5 text-amber-600" />
                        </div>
                        <h3 className="font-neue-bold text-neutral-900">Key Findings</h3>
                      </div>
                      <div className="p-6">
                        <ul className="space-y-3">
                          {analysis.keyFindings.map((finding, i) => (
                            <motion.li
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.07 }}
                              className="flex items-start gap-3"
                            >
                              <span className="mt-1.5 w-2 h-2 rounded-full bg-neutral-900 shrink-0" />
                              <span className="text-sm text-neutral-700 font-poppins leading-relaxed">
                                {finding}
                              </span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Suggested Exercises */}
                  {analysis.suggestedExercises.length > 0 && (
                    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-green-50">
                            <Activity className="w-5 h-5 text-green-600" />
                          </div>
                          <h3 className="font-neue-bold text-neutral-900">
                            Suggested Exercises
                          </h3>
                        </div>
                        <span className="text-xs text-neutral-400 font-poppins">
                          {analysis.suggestedExercises.length} exercise
                          {analysis.suggestedExercises.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analysis.suggestedExercises.map((ex, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="border border-neutral-100 rounded-xl p-4 bg-neutral-50"
                          >
                            <p className="font-semibold text-neutral-900 text-sm">
                              {ex.name}
                            </p>
                            {ex.description && (
                              <p className="text-xs text-neutral-500 mt-1 leading-relaxed font-poppins">
                                {ex.description}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <ExerciseBadge label={ex.targetJoint.replace(/_/g, " ")} />
                              <ExerciseBadge
                                label={`${ex.targetAngleMin}°–${ex.targetAngleMax}°`}
                              />
                              <ExerciseBadge
                                label={`${ex.reps} reps × ${ex.sets} sets`}
                              />
                              {ex.holdDurationSec > 0 && (
                                <ExerciseBadge label={`Hold ${ex.holdDurationSec}s`} />
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Action bar */}
                      <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div>
                          {analysis.doctorApproved ? (
                            <span className="flex items-center gap-2 text-sm font-semibold text-green-700">
                              <CheckCircle className="w-4 h-4" />
                              Analysis Approved
                              {analysis.doctorReviewedAt && (
                                <span className="text-xs font-normal text-neutral-400">
                                  {new Date(
                                    analysis.doctorReviewedAt
                                  ).toLocaleString()}
                                </span>
                              )}
                            </span>
                          ) : (
                            <button
                              onClick={handleApprove}
                              disabled={approving}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {approving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                              {approving ? "Approving…" : "Approve Analysis"}
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            handleCreatePlan(analysis.suggestedExercises)
                          }
                          className="flex items-center gap-2 px-5 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
                        >
                          <Activity className="w-4 h-4" />
                          Create Rehab Plan →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* No analysis yet */}
              {!loadingAnalysis && !analysisInProgress && !analysis && (
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-10 flex flex-col items-center gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center">
                    <Brain className="w-7 h-7 text-neutral-300" />
                  </div>
                  <div>
                    <p className="font-neue-bold text-neutral-900">
                      No analysis yet
                    </p>
                    <p className="text-sm text-neutral-500 font-poppins mt-1">
                      Upload a recording in the Recording tab to start the AI
                      analysis pipeline.
                    </p>
                  </div>
                  <button
                    onClick={() => setTab("recording")}
                    className="px-5 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-800 transition-colors"
                  >
                    Go to Recording →
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ExerciseBadge({ label }: { label: string }) {
  return (
    <span className="px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-xs text-neutral-600 font-mono capitalize">
      {label}
    </span>
  );
}
