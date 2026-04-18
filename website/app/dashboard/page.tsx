"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  doctors as doctorsApi,
  appointments as appointmentsApi,
  ApiError,
  type AppointmentRecord,
} from "@/lib/api";
import { loadAuthUser, saveAuthUser } from "@/lib/auth-storage";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Calendar, type Appointment } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Calendar as CalendarIcon,
  Settings,
  LogOut,
  Clock,
  Search,
  ChevronRight,
  Stethoscope,
  Home,
  Activity,
  CheckCircle,
  Mail,
  Phone,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:5000";

// ── Derived patient shape ────────────────────────────────────────────────────
interface DerivedPatient {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  appointmentCount: number;
  lastAppointment: Date;
  lastStatus: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function derivePatients(appts: AppointmentRecord[]): DerivedPatient[] {
  const map = new Map<string, DerivedPatient>();
  for (const a of appts) {
    const p = a.patient;
    const existing = map.get(p.id);
    const dt = new Date(a.dateTime);
    if (!existing) {
      map.set(p.id, {
        id: p.id,
        fullName: p.fullName,
        email: p.user.email,
        phone: p.user.phone,
        appointmentCount: 1,
        lastAppointment: dt,
        lastStatus: a.status,
      });
    } else {
      existing.appointmentCount += 1;
      if (dt > existing.lastAppointment) {
        existing.lastAppointment = dt;
        existing.lastStatus = a.status;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    b.lastAppointment.getTime() - a.lastAppointment.getTime()
  );
}

function mapToCalendarAppointment(a: AppointmentRecord): Appointment {
  const dt = new Date(a.dateTime);
  return {
    id: a.id,
    patientName: a.patient.fullName,
    time: dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    type: a.type === "ONLINE" ? "Video Call" : "In-Person",
    date: dt,
    color: "bg-neutral-200 text-neutral-800",
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [searchQuery, setSearchQuery] = useState("");

  // Doctor identity — must be state so server and client first-render both start
  // with the same default ("Doctor"), then useEffect populates from localStorage.
  // Reading localStorage directly during render causes an SSR/client hydration mismatch.
  const [doctorName, setDoctorName] = useState("Doctor");
  const [doctorInitials, setDoctorInitials] = useState("DR");
  const [doctorId, setDoctorId] = useState<string | undefined>(undefined);

  const [apiAppointments, setApiAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safe to call localStorage only inside useEffect (runs client-side only)
    const user = loadAuthUser();
    const name: string = user?.doctorProfile?.fullName ?? "Doctor";
    const dId: string | undefined = user?.doctorProfile?.id;

    setDoctorName(name);
    setDoctorInitials(initials(name));
    setDoctorId(dId);

    if (!dId) {
      setLoading(false);
      return;
    }

    appointmentsApi
      .listForDoctor(dId)
      .then(({ appointments }) => setApiAppointments(appointments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const patients = useMemo(() => derivePatients(apiAppointments), [apiAppointments]);

  const calendarAppointments = useMemo(
    () => apiAppointments.map(mapToCalendarAppointment),
    [apiAppointments]
  );

  const todayAppointments = useMemo(() => {
    const today = new Date();
    return apiAppointments.filter((a) => {
      const d = new Date(a.dateTime);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    });
  }, [apiAppointments]);

  const upcomingToday = useMemo(
    () =>
      todayAppointments
        .filter((a) => new Date(a.dateTime) >= new Date())
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
        .slice(0, 5),
    [todayAppointments]
  );

  const filteredPatients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    );
  }, [patients, searchQuery]);

  const greet = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const sidebarItems = [
    { icon: Home, label: "Overview", id: "overview" },
    { icon: CalendarIcon, label: "Calendar", id: "calendar" },
    { icon: Users, label: "Patients", id: "patients" },
    { icon: Activity, label: "Rehab", id: "rehab" },
  ];

  // ── Appointment count by day-of-week for overview chart (last 7 days from real data)
  const weeklyChartData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts = new Array(7).fill(0);
    const now = new Date();
    for (const a of apiAppointments) {
      const d = new Date(a.dateTime);
      const diffMs = now.getTime() - d.getTime();
      if (diffMs >= 0 && diffMs < 7 * 24 * 60 * 60 * 1000) {
        counts[d.getDay()] += 1;
      }
    }
    return days.map((name, i) => ({ name, appointments: counts[i] }));
  }, [apiAppointments]);

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-72 bg-white border-r border-neutral-200 p-6 flex flex-col fixed h-full z-40"
      >
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-semibold text-neutral-900">Arogyam</span>
        </div>

        <nav className="flex-1 space-y-2">
          {sidebarItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ x: 5 }}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-poppins transition-all duration-200",
                activeTab === item.id
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </motion.button>
          ))}
        </nav>

        <div className="pt-6 border-t border-neutral-200 space-y-2">
          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-poppins transition-all",
              activeTab === "settings"
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            )}
          >
            <Settings className="w-5 h-5" />
            Settings
          </button>
          <Link href="/">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 font-poppins transition-all">
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </Link>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 p-8">
        {/* ── Overview Tab ─────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            <motion.header
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-between items-center mb-8"
            >
              <div>
                <h1 className="text-4xl font-neue-bold text-neutral-900">
                  {greet}, Dr. {doctorName.split(" ").at(-1)}
                </h1>
                <p className="text-neutral-600 font-poppins mt-1">
                  Here&apos;s your practice summary for today.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                  {doctorInitials}
                </div>
              </div>
            </motion.header>

            {/* Stats */}
            {loading ? (
              <div className="h-32 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {[
                    {
                      label: "Total Patients",
                      value: patients.length,
                      icon: Users,
                      sub: "unique patients",
                    },
                    {
                      label: "Today's Appointments",
                      value: todayAppointments.length,
                      icon: CalendarIcon,
                      sub: `${upcomingToday.length} still upcoming`,
                    },
                    {
                      label: "Total Appointments",
                      value: apiAppointments.length,
                      icon: Activity,
                      sub: "all time",
                    },
                  ].map((stat, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-neutral-600 font-poppins text-sm">
                          {stat.label}
                        </h3>
                        <div className="p-3 rounded-xl bg-neutral-900">
                          <stat.icon className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <p className="text-3xl font-neue-bold text-neutral-900 mb-1">
                        {stat.value}
                      </p>
                      <p className="text-sm text-neutral-500 font-poppins">{stat.sub}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Weekly chart */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="lg:col-span-2 bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-neue-bold text-neutral-900">
                        This Week&apos;s Appointments
                      </h3>
                      <div className="flex items-center gap-2 text-neutral-500">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-poppins">last 7 days</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={weeklyChartData}>
                        <defs>
                          <linearGradient id="colorApts" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#171717" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#171717" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                        <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                        <YAxis stroke="#6b7280" fontSize={12} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(255,255,255,0.95)",
                            border: "none",
                            borderRadius: 12,
                            boxShadow: "0 10px 40px rgba(0,0,0,.1)",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="appointments"
                          stroke="#171717"
                          strokeWidth={3}
                          fill="url(#colorApts)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>

                  {/* Upcoming today */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-neue-bold text-neutral-900">Upcoming Today</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("calendar")}
                        className="text-neutral-700 hover:text-neutral-900"
                      >
                        View All <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                    {upcomingToday.length === 0 ? (
                      <p className="text-neutral-400 font-poppins text-sm text-center py-6">
                        No upcoming appointments today.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {upcomingToday.map((apt) => (
                          <div
                            key={apt.id}
                            className="flex items-center gap-4 p-3 rounded-xl hover:bg-neutral-100 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold text-sm">
                              {apt.patient.fullName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-neue-bold text-neutral-900 truncate">
                                {apt.patient.fullName}
                              </p>
                              <p className="text-xs text-neutral-500 font-poppins">
                                {apt.type === "ONLINE" ? "Video Call" : "In-Person"}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 text-neutral-700">
                              <Clock className="w-3 h-3" />
                              <span className="text-sm font-poppins">
                                {new Date(apt.dateTime).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Quick actions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
                >
                  <h3 className="text-xl font-neue-bold text-neutral-900 mb-5">Quick Actions</h3>
                  <div className="flex flex-wrap gap-4">
                    {[
                      { icon: CalendarIcon, label: "View Calendar", tab: "calendar" },
                      { icon: Users, label: "Patient Directory", tab: "patients" },
                      { icon: Activity, label: "Rehab Management", tab: "rehab" },
                      { icon: Settings, label: "Edit Profile", tab: "settings" },
                    ].map((action) => (
                      <motion.button
                        key={action.tab}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab(action.tab)}
                        className="flex items-center gap-3 px-5 py-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-300 transition-all"
                      >
                        <div className="p-2 rounded-lg bg-neutral-900">
                          <action.icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-poppins text-neutral-700 text-sm">{action.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </>
        )}

        {/* ── Calendar Tab ──────────────────────────────────────────────────── */}
        {activeTab === "calendar" && (
          <>
            <motion.header
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-between items-center mb-8"
            >
              <div>
                <h1 className="text-4xl font-neue-bold text-neutral-900 flex items-center gap-3">
                  <CalendarIcon className="w-10 h-10 text-neutral-700" />
                  Calendar & Appointments
                </h1>
                <p className="text-neutral-600 font-poppins mt-1">
                  Your full appointment schedule
                </p>
              </div>
              <div className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                {doctorInitials}
              </div>
            </motion.header>

            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 xl:grid-cols-3 gap-6"
              >
                <div className="xl:col-span-2">
                  <Calendar
                    appointments={calendarAppointments}
                    onDateSelect={() => {}}
                    onAppointmentClick={(apt) => router.push(`/appointments/${apt.id}`)}
                  />
                </div>

                <div className="space-y-6">
                  <Card className="bg-white border-neutral-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-neutral-700" />
                        Schedule Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        {
                          label: "Today",
                          value: `${todayAppointments.length} Appointments`,
                        },
                        {
                          label: "Total (all time)",
                          value: `${apiAppointments.length} Appointments`,
                        },
                        {
                          label: "Unique Patients",
                          value: `${patients.length} Patients`,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="p-3 rounded-xl bg-neutral-100 border border-neutral-200"
                        >
                          <p className="font-poppins text-sm text-neutral-600">{item.label}</p>
                          <p className="font-semibold text-xl text-neutral-900">{item.value}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-neutral-200">
                    <CardHeader>
                      <CardTitle>Appointment Types</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        {
                          type: "Video Call",
                          count: apiAppointments.filter((a) => a.type === "ONLINE").length,
                        },
                        {
                          type: "In-Person",
                          count: apiAppointments.filter((a) => a.type === "ON_SITE").length,
                        },
                      ].map((item) => (
                        <div
                          key={item.type}
                          className="flex items-center justify-between p-3 rounded-xl bg-neutral-50"
                        >
                          <span className="px-2 py-1 rounded-lg text-sm font-poppins bg-neutral-200 text-neutral-800">
                            {item.type}
                          </span>
                          <span className="font-neue-bold text-neutral-900">{item.count}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* ── Patients Tab ──────────────────────────────────────────────────── */}
        {activeTab === "patients" && (
          <>
            <motion.header
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-between items-center mb-8"
            >
              <div>
                <h1 className="text-4xl font-neue-bold text-neutral-900 flex items-center gap-3">
                  <Users className="w-10 h-10 text-neutral-700" />
                  Patient Directory
                </h1>
                <p className="text-neutral-600 font-poppins mt-1">
                  All patients who have booked appointments with you
                </p>
              </div>
              <div className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                {doctorInitials}
              </div>
            </motion.header>

            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {/* Stats row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                    { label: "Total Patients", value: patients.length, icon: Users },
                    {
                      label: "Completed Visits",
                      value: apiAppointments.filter((a) => a.status === "COMPLETED").length,
                      icon: CheckCircle,
                    },
                    {
                      label: "Upcoming",
                      value: apiAppointments.filter(
                        (a) => a.status === "CONFIRMED" || a.status === "PENDING"
                      ).length,
                      icon: AlertCircle,
                    },
                  ].map((stat, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-white rounded-xl p-4 border border-neutral-200 shadow-sm flex items-center gap-4"
                    >
                      <div className="p-3 rounded-xl bg-neutral-900">
                        <stat.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-neue-bold text-neutral-900">{stat.value}</p>
                        <p className="text-sm text-neutral-600 font-poppins">{stat.label}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Search */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by name or email…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 bg-white font-poppins focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none w-full text-neutral-900"
                    />
                  </div>
                </div>

                {/* Patient list */}
                {filteredPatients.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-neutral-300 py-16 text-center">
                    <Users className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                    <p className="text-neutral-500 font-poppins">
                      {searchQuery
                        ? "No patients match your search."
                        : "No patients yet. They will appear here once they book appointments."}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-neutral-100">
                          <tr>
                            {["Patient", "Contact", "Appointments", "Last Visit", "Actions"].map(
                              (h) => (
                                <th
                                  key={h}
                                  className="text-left p-4 font-neue-bold text-neutral-900"
                                >
                                  {h}
                                </th>
                              )
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPatients.map((patient, idx) => (
                            <motion.tr
                              key={patient.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.04 }}
                              className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                            >
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold text-sm">
                                    {initials(patient.fullName)}
                                  </div>
                                  <div>
                                    <p className="font-neue-bold text-neutral-900">
                                      {patient.fullName}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                                    <Mail className="w-3 h-3" />
                                    {patient.email}
                                  </div>
                                  {patient.phone && (
                                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                                      <Phone className="w-3 h-3" />
                                      {patient.phone}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="text-sm font-semibold text-neutral-900">
                                  {patient.appointmentCount}
                                </span>
                                <span className="text-xs text-neutral-500 ml-1 font-poppins">
                                  visit{patient.appointmentCount !== 1 ? "s" : ""}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className="text-sm text-neutral-600 font-poppins">
                                  {patient.lastAppointment.toLocaleDateString()}
                                </span>
                                <p className="text-xs text-neutral-400 font-poppins capitalize mt-0.5">
                                  {patient.lastStatus.toLowerCase()}
                                </p>
                              </td>
                              <td className="p-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setActiveTab("rehab")}
                                  className="text-neutral-700 hover:bg-neutral-100"
                                >
                                  <Activity className="w-4 h-4 mr-1" />
                                  Rehab
                                </Button>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}

        {/* ── Rehab tab ── */}
        {activeTab === "rehab" && <RehabPanel />}

        {/* ── Settings tab ── */}
        {activeTab === "settings" && <SettingsPanel />}
      </main>
    </div>
  );
}

// ── Exercise Catalogue (hardcoded clinical parameters) ────────────────────────
const EXERCISE_CATALOGUE = [
  // ── Knee
  {
    id: "knee-flex", category: "Knee", emoji: "🦵",
    name: "Knee Flexion & Extension",
    description: "Bend and straighten the knee through full range of motion while seated. Improves joint mobility post-surgery or after immobilisation.",
    targetJoint: "knee_left", targetAngleMin: 90, targetAngleMax: 140,
    holdDurationSec: 2, reps: 10, sets: 3,
  },
  {
    id: "quad-set", category: "Knee", emoji: "🦵",
    name: "Quad Set",
    description: "Tighten the quadriceps by pressing the back of the knee into the floor. Activates quads without joint stress — ideal early post-op.",
    targetJoint: "knee_left", targetAngleMin: 0, targetAngleMax: 15,
    holdDurationSec: 5, reps: 10, sets: 3,
  },
  {
    id: "terminal-knee", category: "Knee", emoji: "🦵",
    name: "Terminal Knee Extension",
    description: "From 30° flexion, straighten the knee against resistance. Strengthens VMO and improves knee stability.",
    targetJoint: "knee_left", targetAngleMin: 0, targetAngleMax: 30,
    holdDurationSec: 2, reps: 12, sets: 3,
  },
  {
    id: "heel-slide", category: "Knee", emoji: "🦵",
    name: "Heel Slides",
    description: "Lying flat, slide heel toward the buttocks to increase knee flexion. Gentle ROM exercise for early rehab phases.",
    targetJoint: "knee_left", targetAngleMin: 80, targetAngleMax: 130,
    holdDurationSec: 3, reps: 10, sets: 3,
  },
  {
    id: "wall-squat", category: "Knee", emoji: "🦵",
    name: "Wall Squat",
    description: "Back against wall, slide down to 60–90° knee bend. Builds quad and glute strength with controlled load.",
    targetJoint: "knee_left", targetAngleMin: 60, targetAngleMax: 90,
    holdDurationSec: 5, reps: 8, sets: 3,
  },
  // ── Hip
  {
    id: "hip-flex", category: "Hip", emoji: "🍑",
    name: "Hip Flexion",
    description: "Lift the knee toward the chest in standing or lying position. Restores hip flexor strength and range after surgery or disuse.",
    targetJoint: "hip_flexion_left", targetAngleMin: 60, targetAngleMax: 90,
    holdDurationSec: 2, reps: 10, sets: 3,
  },
  {
    id: "glute-bridge", category: "Hip", emoji: "🍑",
    name: "Glute Bridge",
    description: "Lying on back, push hips toward the ceiling by squeezing glutes. Core and gluteal activation essential for lower-limb stability.",
    targetJoint: "hip_flexion_left", targetAngleMin: 130, targetAngleMax: 160,
    holdDurationSec: 3, reps: 12, sets: 3,
  },
  {
    id: "hip-abduction", category: "Hip", emoji: "🍑",
    name: "Hip Abduction (Side-lying)",
    description: "Lying on side, lift the top leg upward. Strengthens hip abductors and iliotibial band for walking and stair stability.",
    targetJoint: "hip_flexion_left", targetAngleMin: 20, targetAngleMax: 45,
    holdDurationSec: 2, reps: 12, sets: 3,
  },
  {
    id: "clamshell", category: "Hip", emoji: "🍑",
    name: "Clamshell",
    description: "Side-lying with knees bent, rotate the top knee upward like a clamshell opening. Activates hip external rotators and glute medius.",
    targetJoint: "hip_flexion_left", targetAngleMin: 30, targetAngleMax: 60,
    holdDurationSec: 2, reps: 15, sets: 3,
  },
  // ── Shoulder
  {
    id: "shoulder-abd", category: "Shoulder", emoji: "💪",
    name: "Shoulder Abduction",
    description: "Raise the arm to the side from hip to shoulder height. Core shoulder rehab movement for rotator cuff and impingement conditions.",
    targetJoint: "shoulder_abduction_left", targetAngleMin: 70, targetAngleMax: 110,
    holdDurationSec: 2, reps: 10, sets: 3,
  },
  {
    id: "shoulder-flex", category: "Shoulder", emoji: "💪",
    name: "Shoulder Forward Flexion",
    description: "Lift the arm forward and upward in the sagittal plane. Restores forward reach and overhead function.",
    targetJoint: "shoulder_abduction_left", targetAngleMin: 80, targetAngleMax: 140,
    holdDurationSec: 2, reps: 10, sets: 3,
  },
  {
    id: "pendulum", category: "Shoulder", emoji: "💪",
    name: "Pendulum Circles",
    description: "Lean forward, let the arm hang freely, and draw small circles. Gravity-assisted distraction — ideal in acute phases to reduce pain.",
    targetJoint: "shoulder_abduction_left", targetAngleMin: 20, targetAngleMax: 50,
    holdDurationSec: 0, reps: 20, sets: 2,
  },
  {
    id: "ext-rotation", category: "Shoulder", emoji: "💪",
    name: "External Shoulder Rotation",
    description: "Elbow at 90°, rotate the forearm outward away from the body. Strengthens infraspinatus and teres minor — key rotator cuff muscles.",
    targetJoint: "elbow_left", targetAngleMin: 85, targetAngleMax: 95,
    holdDurationSec: 2, reps: 12, sets: 3,
  },
  {
    id: "wall-push", category: "Shoulder", emoji: "💪",
    name: "Wall Push-Up",
    description: "Hands on wall at shoulder height, perform a controlled push-up. Low-load scapular stabilisation and shoulder press rehab.",
    targetJoint: "elbow_left", targetAngleMin: 30, targetAngleMax: 90,
    holdDurationSec: 1, reps: 12, sets: 3,
  },
  // ── Elbow
  {
    id: "elbow-flex", category: "Elbow", emoji: "💪",
    name: "Elbow Flexion & Extension",
    description: "Curl the forearm toward the shoulder and return. Restores elbow ROM after fracture, dislocation, or tendon repair.",
    targetJoint: "elbow_left", targetAngleMin: 30, targetAngleMax: 140,
    holdDurationSec: 2, reps: 10, sets: 3,
  },
  {
    id: "bicep-curl", category: "Elbow", emoji: "💪",
    name: "Bicep Curl (Light Resistance)",
    description: "Controlled curl with light dumbbell or band. Progressive loading of the biceps brachii in mid and late rehab stages.",
    targetJoint: "elbow_left", targetAngleMin: 50, targetAngleMax: 140,
    holdDurationSec: 1, reps: 12, sets: 3,
  },
  // ── Spine / Core
  {
    id: "cat-cow", category: "Spine", emoji: "🔄",
    name: "Cat-Cow",
    description: "On all fours, alternate arching and rounding the spine. Mobilises thoracic and lumbar vertebrae, reduces stiffness and pain.",
    targetJoint: "hip_flexion_left", targetAngleMin: 110, targetAngleMax: 150,
    holdDurationSec: 3, reps: 10, sets: 2,
  },
  {
    id: "bird-dog", category: "Spine", emoji: "🔄",
    name: "Bird Dog",
    description: "On all fours, extend opposite arm and leg simultaneously. Core stability and lumbar control — minimal spinal load.",
    targetJoint: "hip_flexion_left", targetAngleMin: 160, targetAngleMax: 180,
    holdDurationSec: 5, reps: 8, sets: 3,
  },
  {
    id: "dead-bug", category: "Spine", emoji: "🔄",
    name: "Dead Bug",
    description: "Lying on back with arms up and knees bent, lower opposite arm and leg toward the floor. Trains deep core while protecting the lumbar spine.",
    targetJoint: "hip_flexion_left", targetAngleMin: 80, targetAngleMax: 120,
    holdDurationSec: 3, reps: 8, sets: 3,
  },
  {
    id: "seated-row", category: "Spine", emoji: "🔄",
    name: "Seated Row (Band)",
    description: "Seated, pull a resistance band toward the lower chest. Strengthens rhomboids and mid-trapezius — corrects forward posture.",
    targetJoint: "elbow_left", targetAngleMin: 80, targetAngleMax: 90,
    holdDurationSec: 2, reps: 12, sets: 3,
  },
  // ── Ankle / Calf
  {
    id: "calf-raise", category: "Ankle", emoji: "🦶",
    name: "Calf Raise",
    description: "Rise up on tiptoes and slowly lower. Strengthens gastrocnemius and soleus — essential after ankle sprain or Achilles tendon rehab.",
    targetJoint: "knee_left", targetAngleMin: 155, targetAngleMax: 175,
    holdDurationSec: 2, reps: 15, sets: 3,
  },
  {
    id: "ankle-circles", category: "Ankle", emoji: "🦶",
    name: "Ankle Circles",
    description: "Rotate the ankle slowly in both directions. Reduces swelling, restores proprioception after sprain or immobilisation.",
    targetJoint: "knee_left", targetAngleMin: 150, targetAngleMax: 175,
    holdDurationSec: 1, reps: 20, sets: 2,
  },
];

const CATEGORIES = ["All", "Knee", "Hip", "Shoulder", "Elbow", "Spine", "Ankle"] as const;
const CATEGORY_COLORS: Record<string, string> = {
  Knee: "bg-blue-100 text-blue-700",
  Hip: "bg-purple-100 text-purple-700",
  Shoulder: "bg-orange-100 text-orange-700",
  Elbow: "bg-amber-100 text-amber-700",
  Spine: "bg-teal-100 text-teal-700",
  Ankle: "bg-green-100 text-green-700",
};

// ── Rehab Panel ───────────────────────────────────────────────────────────────
function RehabPanel() {
  type View = "patients" | "catalogue";

  const [view, setView] = useState<View>("patients");
  interface RehabPatient { id: string; fullName: string; email: string; }
  interface RehabPlan { id: string; patientId: string; title: string; status: string; exercises?: unknown[]; }
  interface RehabAlert { id: string; severity: string; reason: string; planId?: string; plan?: { title: string }; }

  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [patients, setPatients] = useState<RehabPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<RehabPatient | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [plans, setPlans] = useState<RehabPlan[]>([]);
  const [alerts, setAlerts] = useState<RehabAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState("Rehab Plan");
  const [ackingId, setAckingId] = useState<string | null>(null);

  useEffect(() => {
    const user = loadAuthUser();
    const dId = user?.doctorProfile?.id;
    if (!dId) { setLoading(false); return; }
    setDoctorId(dId);

    Promise.all([
      fetch(`${API_BASE}/api/appointments?doctorId=${dId}`).then((r) => r.json()),
      fetch(`${API_BASE}/api/rehab/plans?doctorId=${dId}`).then((r) => r.json()),
      fetch(`${API_BASE}/api/rehab/alerts?doctorId=${dId}`).then((r) => r.json()),
    ])
      .then(([apptData, plansData, alertsData]: [Record<string, unknown[]>, Record<string, unknown[]>, Record<string, unknown[]>]) => {
        const seen = new Set<string>();
        const unique: RehabPatient[] = [];
        for (const appt of (apptData.appointments ?? []) as Array<{ patient?: { id: string; fullName: string; user?: { email: string } } }>) {
          const p = appt.patient;
          if (p && !seen.has(p.id)) {
            seen.add(p.id);
            unique.push({ id: p.id, fullName: p.fullName, email: p.user?.email ?? "" });
          }
        }
        setPatients(unique);
        setPlans((plansData.plans ?? []) as RehabPlan[]);
        setAlerts((alertsData.alerts ?? []) as RehabAlert[]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAck = async (alertId: string) => {
    setAckingId(alertId);
    try {
      await fetch(`${API_BASE}/api/rehab/alerts/${alertId}/acknowledge`, { method: "PATCH" });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } finally { setAckingId(null); }
  };

  const toggleExercise = (id: string) => {
    setSelectedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleCreatePlan = async () => {
    if (!selectedPatient || !doctorId || selectedExercises.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const exercises = EXERCISE_CATALOGUE
        .filter((ex) => selectedExercises.has(ex.id))
        .map((ex, idx) => ({
          name: ex.name,
          description: ex.description,
          targetJoint: ex.targetJoint,
          targetAngleMin: ex.targetAngleMin,
          targetAngleMax: ex.targetAngleMax,
          holdDurationSec: ex.holdDurationSec,
          reps: ex.reps,
          sets: ex.sets,
          order: idx,
        }));

      const res = await fetch(`${API_BASE}/api/rehab/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          doctorId,
          title: planTitle || `Rehab Plan — ${selectedPatient.fullName}`,
          exercises,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create plan");
      }
      const { plan } = await res.json();
      setPlans((prev) => [plan, ...prev]);
      setSelectedExercises(new Set());
      setSelectedPatient(null);
      setPlanTitle("Rehab Plan");
      setView("patients");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to create plan");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCatalogue =
    categoryFilter === "All"
      ? EXERCISE_CATALOGUE
      : EXERCISE_CATALOGUE.filter((ex) => ex.category === categoryFilter);

  const severityColor = (s: string) =>
    ({
      HIGH: "text-red-600 bg-red-50 border-red-200",
      MEDIUM: "text-amber-600 bg-amber-50 border-amber-200",
      LOW: "text-blue-600 bg-blue-50 border-blue-200",
    }[s] ?? "text-gray-600 bg-gray-50 border-gray-200");

  if (loading)
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  // ── Catalogue view ────────────────────────────────────────────────────────
  if (view === "catalogue" && selectedPatient) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setView("patients"); setSelectedExercises(new Set()); }}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Prescribe Exercises for {selectedPatient.fullName}
            </h1>
            <p className="text-sm text-gray-500">Select exercises from the catalogue below</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Plan Title
          </label>
          <input
            value={planTitle}
            onChange={(e) => setPlanTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Post-ACL Reconstruction Rehab"
          />
        </div>

        <div className="flex gap-2 flex-wrap mb-5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                categoryFilter === cat
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {filteredCatalogue.map((ex) => {
            const selected = selectedExercises.has(ex.id);
            return (
              <button
                key={ex.id}
                onClick={() => toggleExercise(ex.id)}
                className={`text-left rounded-xl border-2 p-4 transition-all relative ${
                  selected
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                }`}
              >
                {selected && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                )}
                <div className="text-3xl mb-2">{ex.emoji}</div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-1 ${
                    CATEGORY_COLORS[ex.category] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {ex.category}
                </span>
                <h3 className="font-semibold text-gray-900 text-sm leading-tight">{ex.name}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                  {ex.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-500 font-mono">
                    {ex.reps}r × {ex.sets}s
                  </span>
                  {ex.holdDurationSec > 0 && (
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-500 font-mono">
                      hold {ex.holdDurationSec}s
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-500 font-mono">
                    {ex.targetAngleMin}°–{ex.targetAngleMax}°
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-6 px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {selectedExercises.size === 0
              ? "Select at least one exercise"
              : `${selectedExercises.size} exercise${selectedExercises.size !== 1 ? "s" : ""} selected`}
          </p>
          <div className="flex gap-3 items-center">
            {submitError && <p className="text-xs text-red-500">{submitError}</p>}
            <button
              onClick={handleCreatePlan}
              disabled={selectedExercises.size === 0 || submitting}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {submitting ? "Creating…" : "Create Plan →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Patients + plans + alerts view ────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Rehab Management</h1>

      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            Alerts ({alerts.length})
          </h2>
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${severityColor(alert.severity)}`}
            >
              <div>
                <span className="text-xs font-bold uppercase">{alert.severity}</span>
                <p className="text-sm mt-0.5">{alert.reason}</p>
                {alert.plan && (
                  <Link
                    href={`/rehab/plans/${alert.planId}`}
                    className="text-xs underline opacity-70 hover:opacity-100 block mt-0.5"
                  >
                    {alert.plan.title}
                  </Link>
                )}
              </div>
              <button
                onClick={() => handleAck(alert.id)}
                disabled={ackingId === alert.id}
                className="ml-4 text-xs px-3 py-1.5 rounded-lg border border-current opacity-60 hover:opacity-100 disabled:opacity-30"
              >
                {ackingId === alert.id ? "…" : "Dismiss"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          Your Patients — click to prescribe exercises
        </h2>
        {patients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No patients yet. Patients appear here once they book an appointment with you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {patients.map((p) => {
              const patientPlans = plans.filter((pl) => pl.patientId === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPatient(p);
                    setPlanTitle(`Rehab Plan — ${p.fullName}`);
                    setSelectedExercises(new Set());
                    setView("catalogue");
                  }}
                  className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-400 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {p.fullName?.charAt(0) ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{p.fullName}</p>
                      <p className="text-xs text-gray-400 truncate">{p.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {patientPlans.length} plan{patientPlans.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs text-blue-600 group-hover:underline font-medium">
                      + Prescribe →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {plans.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Active Plans
          </h2>
          <div className="grid gap-3">
            {plans.map((plan) => (
              <Link key={plan.id} href={`/rehab/plans/${plan.id}`} className="block">
                <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{plan.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(plan.exercises ?? []).length} exercises
                    </p>
                  </div>
                  <span
                    className={`ml-3 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                      {
                        ACTIVE: "bg-green-100 text-green-700",
                        PAUSED: "bg-amber-100 text-amber-700",
                        COMPLETED: "bg-blue-100 text-blue-700",
                        CANCELLED: "bg-red-100 text-red-700",
                      }[plan.status as string] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {plan.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings Panel ────────────────────────────────────────────────────────────
function SettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    bio: "",
    consultationFee: "",
    paypalEmail: "",
    experienceYears: "",
    clinicName: "",
    clinicAddress: "",
    city: "",
    country: "",
  });

  useEffect(() => {
    const user = loadAuthUser();
    if (user?.doctorProfile) {
      const p = user.doctorProfile;
      setDoctorId(p.id);
      setForm({
        fullName: p.fullName ?? "",
        bio: p.bio ?? "",
        consultationFee: p.consultationFee != null ? String(p.consultationFee) : "",
        paypalEmail: p.paypalEmail ?? "",
        experienceYears: p.experienceYears != null ? String(p.experienceYears) : "",
        clinicName: p.clinicName ?? "",
        clinicAddress: p.clinicAddress ?? "",
        city: p.city ?? "",
        country: p.country ?? "",
      });
    }
    setLoading(false);
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId) return;
    setError(null);
    setSaving(true);
    try {
      const { doctor } = await doctorsApi.updateProfile(doctorId, {
        fullName: form.fullName || undefined,
        bio: form.bio || undefined,
        consultationFee: form.consultationFee ? Number(form.consultationFee) : undefined,
        paypalEmail: form.paypalEmail || undefined,
        experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
        clinicName: form.clinicName || undefined,
        clinicAddress: form.clinicAddress || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
      });
      const user = loadAuthUser();
      if (user) {
        saveAuthUser({ ...user, doctorProfile: { ...user.doctorProfile, ...doctor } });
      }
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to save. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputCls =
    "w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 placeholder:text-neutral-400 font-poppins";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl"
    >
      <h1 className="text-3xl font-neue-bold text-neutral-900 mb-2">Profile & Settings</h1>
      <p className="text-neutral-500 font-poppins mb-8">
        Update your professional details and consultation fee.
      </p>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-poppins">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-poppins">
          ✓ Profile saved successfully.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
          <h2 className="text-lg font-neue-bold text-neutral-900">Personal information</h2>
          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
              Full name
            </label>
            <input
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              className={inputCls}
              placeholder="Dr. John Smith"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
              Bio (optional)
            </label>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              rows={3}
              className={inputCls + " resize-none"}
              placeholder="Brief professional summary visible to patients…"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
              Years of experience
            </label>
            <input
              type="number"
              name="experienceYears"
              value={form.experienceYears}
              onChange={handleChange}
              min="0"
              max="60"
              className={inputCls}
              placeholder="5"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
          <h2 className="text-lg font-neue-bold text-neutral-900">Clinic / Practice</h2>
          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
              Clinic name
            </label>
            <input
              type="text"
              name="clinicName"
              value={form.clinicName}
              onChange={handleChange}
              className={inputCls}
              placeholder="Apollo Clinic, City Hospital, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
              Address
            </label>
            <input
              type="text"
              name="clinicAddress"
              value={form.clinicAddress}
              onChange={handleChange}
              className={inputCls}
              placeholder="123 Main St"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                City
              </label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                className={inputCls}
                placeholder="Mumbai"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                Country
              </label>
              <input
                type="text"
                name="country"
                value={form.country}
                onChange={handleChange}
                className={inputCls}
                placeholder="India"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
          <h2 className="text-lg font-neue-bold text-neutral-900">Billing & Payments</h2>
          <p className="text-sm text-neutral-500 font-poppins -mt-2">
            Patients pay via PayPal for their second and subsequent appointments.
          </p>
          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
              Consultation fee (USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-poppins text-sm">
                $
              </span>
              <input
                type="number"
                name="consultationFee"
                value={form.consultationFee}
                onChange={handleChange}
                min="0"
                step="0.01"
                className={inputCls + " pl-8"}
                placeholder="50.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
              PayPal email
            </label>
            <input
              type="email"
              name="paypalEmail"
              value={form.paypalEmail}
              onChange={handleChange}
              className={inputCls}
              placeholder="doctor@paypal.com"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-neutral-900 text-white font-semibold font-poppins hover:bg-neutral-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            "Save changes"
          )}
        </button>
      </form>
    </motion.div>
  );
}
