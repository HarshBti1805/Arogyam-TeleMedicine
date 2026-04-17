"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { doctors as doctorsApi, ApiError } from "@/lib/api";
import { loadAuthUser, saveAuthUser } from "@/lib/auth-storage";
import {
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";
import { Calendar, type Appointment } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Calendar as CalendarIcon,
  FileText,
  DollarSign,
  Bell,
  Settings,
  LogOut,
  TrendingUp,
  Clock,
  Video,
  Pill,
  Search,
  Plus,
  ChevronRight,
  Stethoscope,
  Home,
  User,
  BarChart3,
  MessageCircle,
  Phone,
  VideoIcon,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  ChevronLeft,
  Mail,
  Heart,
  Activity,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Monitor,
  Filter,
  Download,
  Eye,
  Edit,
  CheckCircle,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Patient interface
interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  bloodType: string;
  address: string;
  lastVisit: string;
  condition: string;
  status: "Active" | "Inactive" | "Critical";
  avatar?: string;
}

// Chat message interface
interface ChatMessage {
  id: string;
  sender: "doctor" | "patient";
  content: string;
  timestamp: string;
  type: "text" | "image" | "file";
}

// Prescription interface
interface Prescription {
  id: string;
  patientName: string;
  patientId: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  date: string;
  status: "Active" | "Completed" | "Cancelled";
  notes?: string;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [consultationMode, setConsultationMode] = useState<
    "chat" | "video" | null
  >(null);
  const [chatMessage, setChatMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [patientFilter, setPatientFilter] = useState<
    "all" | "active" | "inactive" | "critical"
  >("all");
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Sample patients data
  const patients: Patient[] = useMemo(
    () => [
      {
        id: "1",
        name: "Sarah Johnson",
        email: "sarah.j@email.com",
        phone: "+1 234 567 8901",
        age: 32,
        gender: "Female",
        bloodType: "A+",
        address: "123 Main St, New York",
        lastVisit: "2024-01-15",
        condition: "Diabetes Type 2",
        status: "Active",
      },
      {
        id: "2",
        name: "Michael Chen",
        email: "michael.c@email.com",
        phone: "+1 234 567 8902",
        age: 45,
        gender: "Male",
        bloodType: "B+",
        address: "456 Oak Ave, Los Angeles",
        lastVisit: "2024-01-14",
        condition: "Hypertension",
        status: "Active",
      },
      {
        id: "3",
        name: "Emily Davis",
        email: "emily.d@email.com",
        phone: "+1 234 567 8903",
        age: 28,
        gender: "Female",
        bloodType: "O-",
        address: "789 Pine Rd, Chicago",
        lastVisit: "2024-01-13",
        condition: "Anxiety Disorder",
        status: "Active",
      },
      {
        id: "4",
        name: "Robert Wilson",
        email: "robert.w@email.com",
        phone: "+1 234 567 8904",
        age: 55,
        gender: "Male",
        bloodType: "AB+",
        address: "321 Elm St, Houston",
        lastVisit: "2024-01-12",
        condition: "Heart Disease",
        status: "Critical",
      },
      {
        id: "5",
        name: "Lisa Anderson",
        email: "lisa.a@email.com",
        phone: "+1 234 567 8905",
        age: 38,
        gender: "Female",
        bloodType: "A-",
        address: "654 Maple Dr, Phoenix",
        lastVisit: "2024-01-10",
        condition: "Asthma",
        status: "Active",
      },
      {
        id: "6",
        name: "James Brown",
        email: "james.b@email.com",
        phone: "+1 234 567 8906",
        age: 62,
        gender: "Male",
        bloodType: "O+",
        address: "987 Cedar Ln, Philadelphia",
        lastVisit: "2024-01-08",
        condition: "Arthritis",
        status: "Inactive",
      },
      {
        id: "7",
        name: "Patricia Garcia",
        email: "patricia.g@email.com",
        phone: "+1 234 567 8907",
        age: 41,
        gender: "Female",
        bloodType: "B-",
        address: "147 Birch Blvd, San Antonio",
        lastVisit: "2024-01-05",
        condition: "Migraine",
        status: "Active",
      },
      {
        id: "8",
        name: "David Martinez",
        email: "david.m@email.com",
        phone: "+1 234 567 8908",
        age: 35,
        gender: "Male",
        bloodType: "A+",
        address: "258 Walnut Way, San Diego",
        lastVisit: "2024-01-03",
        condition: "Back Pain",
        status: "Active",
      },
      {
        id: "9",
        name: "Jennifer Lee",
        email: "jennifer.l@email.com",
        phone: "+1 234 567 8909",
        age: 29,
        gender: "Female",
        bloodType: "AB-",
        address: "369 Spruce St, Dallas",
        lastVisit: "2024-01-01",
        condition: "Allergies",
        status: "Inactive",
      },
      {
        id: "10",
        name: "William Taylor",
        email: "william.t@email.com",
        phone: "+1 234 567 8910",
        age: 48,
        gender: "Male",
        bloodType: "O+",
        address: "741 Oak Dr, San Jose",
        lastVisit: "2023-12-28",
        condition: "COPD",
        status: "Critical",
      },
    ],
    [],
  );

  // Sample chat messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      sender: "patient",
      content:
        "Hello Dr. Smith, I have been experiencing some headaches lately.",
      timestamp: "10:30 AM",
      type: "text",
    },
    {
      id: "2",
      sender: "doctor",
      content:
        "Hello! I am sorry to hear that. How long have you been experiencing these headaches?",
      timestamp: "10:32 AM",
      type: "text",
    },
    {
      id: "3",
      sender: "patient",
      content:
        "It started about a week ago. They usually occur in the afternoon.",
      timestamp: "10:33 AM",
      type: "text",
    },
    {
      id: "4",
      sender: "doctor",
      content:
        "I see. Are you staying hydrated? Sometimes dehydration can cause afternoon headaches.",
      timestamp: "10:35 AM",
      type: "text",
    },
    {
      id: "5",
      sender: "patient",
      content:
        "I try to drink water but maybe not enough. I will try to increase my intake.",
      timestamp: "10:36 AM",
      type: "text",
    },
  ]);

  // Sample prescriptions data
  const prescriptions: Prescription[] = useMemo(
    () => [
      {
        id: "1",
        patientName: "Sarah Johnson",
        patientId: "1",
        medication: "Metformin 500mg",
        dosage: "1 tablet",
        frequency: "Twice daily",
        duration: "30 days",
        date: "2024-01-15",
        status: "Active",
        notes: "Take with meals",
      },
      {
        id: "2",
        patientName: "Michael Chen",
        patientId: "2",
        medication: "Lisinopril 10mg",
        dosage: "1 tablet",
        frequency: "Once daily",
        duration: "30 days",
        date: "2024-01-14",
        status: "Active",
        notes: "Take in the morning",
      },
      {
        id: "3",
        patientName: "Emily Davis",
        patientId: "3",
        medication: "Sertraline 50mg",
        dosage: "1 tablet",
        frequency: "Once daily",
        duration: "60 days",
        date: "2024-01-13",
        status: "Active",
        notes: "Take with or without food",
      },
      {
        id: "4",
        patientName: "Robert Wilson",
        patientId: "4",
        medication: "Aspirin 81mg",
        dosage: "1 tablet",
        frequency: "Once daily",
        duration: "90 days",
        date: "2024-01-12",
        status: "Active",
        notes: "Take with food",
      },
      {
        id: "5",
        patientName: "Lisa Anderson",
        patientId: "5",
        medication: "Albuterol Inhaler",
        dosage: "2 puffs",
        frequency: "As needed",
        duration: "30 days",
        date: "2024-01-10",
        status: "Active",
        notes: "Use for shortness of breath",
      },
      {
        id: "6",
        patientName: "James Brown",
        patientId: "6",
        medication: "Ibuprofen 400mg",
        dosage: "1 tablet",
        frequency: "Three times daily",
        duration: "14 days",
        date: "2024-01-08",
        status: "Completed",
      },
      {
        id: "7",
        patientName: "Patricia Garcia",
        patientId: "7",
        medication: "Sumatriptan 50mg",
        dosage: "1 tablet",
        frequency: "As needed",
        duration: "30 days",
        date: "2024-01-05",
        status: "Active",
        notes: "Take at onset of migraine",
      },
    ],
    [],
  );

  const stats = [
    {
      title: "Total Patients",
      value: "1,247",
      change: "+12%",
      changeType: "positive",
      icon: Users,
    },
    {
      title: "Today&apos;s Appointments",
      value: "18",
      change: "3 upcoming",
      changeType: "neutral",
      icon: CalendarIcon,
    },
    {
      title: "Pending Prescriptions",
      value: "7",
      change: "Requires action",
      changeType: "warning",
      icon: Pill,
    },
    {
      title: "Monthly Revenue",
      value: "$45,600",
      change: "+8%",
      changeType: "positive",
      icon: DollarSign,
    },
  ];

  // Use useMemo to avoid impure function calls during render
  const appointments: Appointment[] = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    return [
      {
        id: "1",
        patientName: "Sarah Johnson",
        time: "9:00 AM",
        type: "Consultation",
        date: today,
        color: "bg-neutral-200 text-neutral-800",
      },
      {
        id: "2",
        patientName: "Michael Chen",
        time: "10:30 AM",
        type: "Follow-up",
        date: today,
        color: "bg-neutral-200 text-neutral-800",
      },
      {
        id: "3",
        patientName: "Emily Davis",
        time: "11:15 AM",
        type: "Check-up",
        date: today,
        color: "bg-neutral-200 text-neutral-800",
      },
      {
        id: "4",
        patientName: "Robert Wilson",
        time: "2:00 PM",
        type: "Consultation",
        date: today,
        color: "bg-neutral-200 text-neutral-800",
      },
      {
        id: "5",
        patientName: "Lisa Anderson",
        time: "3:30 PM",
        type: "Video Call",
        date: today,
        color: "bg-neutral-200 text-neutral-800",
      },
      {
        id: "6",
        patientName: "James Brown",
        time: "9:30 AM",
        type: "Consultation",
        date: tomorrow,
        color: "bg-neutral-200 text-neutral-800",
      },
      {
        id: "7",
        patientName: "Patricia Garcia",
        time: "11:00 AM",
        type: "Follow-up",
        date: tomorrow,
        color: "bg-neutral-200 text-neutral-800",
      },
      {
        id: "8",
        patientName: "David Martinez",
        time: "10:00 AM",
        type: "Check-up",
        date: dayAfter,
        color: "bg-neutral-200 text-neutral-800",
      },
      {
        id: "9",
        patientName: "Jennifer Lee",
        time: "2:30 PM",
        type: "Video Call",
        date: dayAfter,
        color: "bg-neutral-200 text-neutral-800",
      },
      {
        id: "10",
        patientName: "William Taylor",
        time: "4:00 PM",
        type: "Consultation",
        date: dayAfter,
        color: "bg-neutral-200 text-neutral-800",
      },
    ];
  }, []);

  const appointmentData = [
    { name: "Mon", appointments: 12 },
    { name: "Tue", appointments: 19 },
    { name: "Wed", appointments: 15 },
    { name: "Thu", appointments: 22 },
    { name: "Fri", appointments: 18 },
    { name: "Sat", appointments: 8 },
    { name: "Sun", appointments: 5 },
  ];

  const patientAgeData = [
    { name: "0-18", value: 15 },
    { name: "19-35", value: 35 },
    { name: "36-50", value: 28 },
    { name: "51-65", value: 18 },
    { name: "65+", value: 4 },
  ];

  const revenueData = [
    { name: "Jan", revenue: 42000, patients: 180 },
    { name: "Feb", revenue: 38000, patients: 165 },
    { name: "Mar", revenue: 45000, patients: 195 },
    { name: "Apr", revenue: 41000, patients: 175 },
    { name: "May", revenue: 48000, patients: 210 },
    { name: "Jun", revenue: 45600, patients: 200 },
  ];

  const consultationTypeData = [
    { name: "In-Person", value: 45 },
    { name: "Video Call", value: 35 },
    { name: "Phone", value: 20 },
  ];

  const COLORS = ["#171717", "#404040", "#737373", "#a3a3a3", "#d4d4d4"];
  const CONSULTATION_COLORS = ["#171717", "#525252", "#a3a3a3"];

  const sidebarItems = [
    { icon: Home, label: "Overview", id: "overview" },
    { icon: CalendarIcon, label: "Calendar", id: "calendar" },
    { icon: Users, label: "Patients", id: "patients" },
    { icon: Video, label: "Consultations", id: "consultations" },
    { icon: Pill, label: "Prescriptions", id: "prescriptions" },
    { icon: BarChart3, label: "Analytics", id: "analytics" },
  ];

  const upcomingAppointments = useMemo(() => {
    return appointments
      .filter((apt) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const aptDate = new Date(apt.date);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate.getTime() === today.getTime();
      })
      .slice(0, 4);
  }, [appointments]);

  // Filter patients based on search and filter
  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const matchesSearch =
        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.condition.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter =
        patientFilter === "all" ||
        patient.status.toLowerCase() === patientFilter;
      return matchesSearch && matchesFilter;
    });
  }, [patients, searchQuery, patientFilter]);

  // Handle sending chat message
  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      const newMessage: ChatMessage = {
        id: String(chatMessages.length + 1),
        sender: "doctor",
        content: chatMessage,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        type: "text",
      };
      setChatMessages([...chatMessages, newMessage]);
      setChatMessage("");
    }
  };

  // Handle patient selection for consultation
  const handleStartConsultation = (
    patient: Patient,
    mode: "chat" | "video",
  ) => {
    setSelectedPatient(patient);
    setConsultationMode(mode);
    if (mode === "video") {
      setIsVideoCallActive(true);
    }
  };

  // Handle ending video call
  const handleEndCall = () => {
    setIsVideoCallActive(false);
    setConsultationMode(null);
    setIsMuted(false);
    setIsVideoOff(false);
  };

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
          <span className="text-xl font-semibold text-neutral-900">
            Arogyam
          </span>
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
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
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
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* Header */}
            <motion.header
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-between items-center mb-8"
            >
              <div>
                <h1 className="text-4xl font-neue-bold text-neutral-900">
                  Good Morning, Dr. Smith
                </h1>
                <p className="text-neutral-600 font-poppins mt-1">
                  Here&apos;s what&apos;s happening with your practice today.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search patients..."
                    className="pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 bg-white font-poppins focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none w-64 text-neutral-900"
                  />
                </div>
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-neutral-900 rounded-full text-white text-xs flex items-center justify-center">
                    3
                  </span>
                </Button>
                <div className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                  DS
                </div>
              </div>
            </motion.header>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      className="text-neutral-600 font-poppins text-sm"
                      dangerouslySetInnerHTML={{ __html: stat.title }}
                    />
                    <div className="p-3 rounded-xl bg-neutral-900">
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-neue-bold text-neutral-900 mb-2">
                    {stat.value}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-poppins",
                      stat.changeType === "positive" && "text-neutral-900",
                      stat.changeType === "warning" && "text-neutral-600",
                      stat.changeType === "neutral" && "text-neutral-500",
                    )}
                  >
                    {stat.change}
                  </p>
                </motion.div>
              ))}
            </div>

            {/* Charts and Appointments */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Weekly Appointments Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="lg:col-span-2 bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-neue-bold text-neutral-900">
                    Weekly Appointments
                  </h3>
                  <div className="flex items-center gap-2 text-neutral-900">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-poppins">+15% this week</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={appointmentData}>
                    <defs>
                      <linearGradient
                        id="colorAppointments"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#171717"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#171717"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e7eb"
                      opacity={0.5}
                    />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="appointments"
                      stroke="#171717"
                      strokeWidth={3}
                      fill="url(#colorAppointments)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Upcoming Appointments */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-neue-bold text-neutral-900">
                    Upcoming
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-neutral-900 hover:text-neutral-900"
                  >
                    View All <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="space-y-4">
                  {upcomingAppointments.map((apt, idx) => (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + idx * 0.1 }}
                      className="flex items-center gap-4 p-3 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold text-sm">
                        {apt.patientName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-neue-bold text-neutral-900 truncate">
                          {apt.patientName}
                        </p>
                        <p className="text-xs text-neutral-500 font-poppins">
                          {apt.type}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-neutral-700">
                        <Clock className="w-3 h-3" />
                        <span className="text-sm font-poppins">{apt.time}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Patient Age Distribution */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
              >
                <h3 className="text-xl font-neue-bold text-neutral-900 mb-6">
                  Patient Demographics
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={patientAgeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {patientAgeData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        border: "none",
                        borderRadius: "12px",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {patientAgeData.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[idx] }}
                      />
                      <span className="text-sm text-neutral-600 font-poppins">
                        {entry.name}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
              >
                <h3 className="text-xl font-neue-bold text-neutral-900 mb-6">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      icon: Plus,
                      label: "New Appointment",
                      action: () => setActiveTab("calendar"),
                    },
                    {
                      icon: User,
                      label: "Add Patient",
                      action: () => setActiveTab("patients"),
                    },
                    {
                      icon: Video,
                      label: "Start Consultation",
                      action: () => setActiveTab("consultations"),
                    },
                    {
                      icon: FileText,
                      label: "Write Prescription",
                      action: () => setActiveTab("prescriptions"),
                    },
                  ].map((action, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={action.action}
                      className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-300 transition-all"
                    >
                      <div className="p-3 rounded-xl bg-neutral-900">
                        <action.icon className="w-6 h-6 text-white" />
                      </div>
                      <span className="font-poppins text-neutral-700 text-sm">
                        {action.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          </>
        )}

        {/* Calendar Tab */}
        {activeTab === "calendar" && (
          <>
            {/* Header */}
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
                  Manage your schedule and view upcoming appointments
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search appointments..."
                    className="pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 bg-white font-poppins focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none w-64 text-neutral-900"
                  />
                </div>
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-neutral-900 rounded-full text-white text-xs flex items-center justify-center">
                    3
                  </span>
                </Button>
                <div className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                  DS
                </div>
              </div>
            </motion.header>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 xl:grid-cols-3 gap-6"
            >
              <div className="xl:col-span-2">
                <Calendar
                  appointments={appointments}
                  onDateSelect={() => {}}
                  onAppointmentClick={(apt) => console.log("Clicked:", apt)}
                />
              </div>

              <div className="space-y-6">
                <Card className="bg-white border-neutral-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5 text-neutral-700" />
                      Quick Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full mb-4">
                      <Plus className="w-4 h-4 mr-2" />
                      New Appointment
                    </Button>
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-200">
                        <p className="font-poppins text-sm text-neutral-600">
                          Today&apos;s Schedule
                        </p>
                        <p className="font-semibold text-2xl text-neutral-900">
                          5 Appointments
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-neutral-100 border border-neutral-200">
                        <p className="font-poppins text-sm text-neutral-600">
                          This Week
                        </p>
                        <p className="font-semibold text-2xl text-neutral-900">
                          23 Appointments
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border-neutral-200">
                  <CardHeader>
                    <CardTitle>Appointment Types</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      {
                        type: "Consultation",
                        count: 45,
                        color: "bg-neutral-200 text-neutral-800",
                      },
                      {
                        type: "Follow-up",
                        count: 32,
                        color: "bg-neutral-200 text-neutral-800",
                      },
                      {
                        type: "Check-up",
                        count: 28,
                        color: "bg-neutral-200 text-neutral-800",
                      },
                      {
                        type: "Video Call",
                        count: 18,
                        color: "bg-neutral-200 text-neutral-800",
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-neutral-50"
                      >
                        <span
                          className={cn(
                            "px-2 py-1 rounded-lg text-sm font-poppins",
                            item.color,
                          )}
                        >
                          {item.type}
                        </span>
                        <span className="font-neue-bold text-neutral-900">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </>
        )}

        {/* Patients Tab */}
        {activeTab === "patients" && (
          <>
            {/* Header */}
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
                  Manage and view all your patients
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search patients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 bg-white font-poppins focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none w-64 text-neutral-900"
                  />
                </div>
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-neutral-900 rounded-full text-white text-xs flex items-center justify-center">
                    3
                  </span>
                </Button>
                <div className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                  DS
                </div>
              </div>
            </motion.header>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Filters and Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-neue-bold text-neutral-900">
                    Patient Directory
                  </h2>
                  <p className="text-neutral-600 font-poppins">
                    Manage and view all your patients
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search patients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 bg-white font-poppins focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none w-64 text-neutral-900"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-white/80 rounded-xl border border-neutral-200 p-1">
                    {["all", "active", "inactive", "critical"].map((filter) => (
                      <button
                        key={filter}
                        onClick={() =>
                          setPatientFilter(filter as typeof patientFilter)
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-lg font-poppins text-sm transition-all capitalize",
                          patientFilter === filter
                            ? "bg-neutral-900 text-white"
                            : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                        )}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                  <Button className="bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Patient
                  </Button>
                </div>
              </div>

              {/* Patient Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: "Total Patients",
                    value: patients.length,
                    icon: Users,
                  },
                  {
                    label: "Active",
                    value: patients.filter((p) => p.status === "Active").length,
                    icon: CheckCircle,
                  },
                  {
                    label: "Inactive",
                    value: patients.filter((p) => p.status === "Inactive")
                      .length,
                    icon: AlertCircle,
                  },
                  {
                    label: "Critical",
                    value: patients.filter((p) => p.status === "Critical")
                      .length,
                    icon: XCircle,
                  },
                ].map((stat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white rounded-xl p-4 border border-white/30 shadow-lg flex items-center gap-4"
                  >
                    <div className="p-3 rounded-xl bg-neutral-900">
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-neue-bold text-neutral-900">
                        {stat.value}
                      </p>
                      <p className="text-sm text-neutral-600 font-poppins">
                        {stat.label}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Patient List */}
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-100">
                      <tr>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Patient
                        </th>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Contact
                        </th>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Details
                        </th>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Condition
                        </th>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Status
                        </th>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.map((patient, idx) => (
                        <motion.tr
                          key={patient.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                                {patient.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-neue-bold text-neutral-900">
                                  {patient.name}
                                </p>
                                <p className="text-xs text-neutral-500 font-poppins">
                                  ID: {patient.id}
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
                              <div className="flex items-center gap-2 text-sm text-neutral-600">
                                <Phone className="w-3 h-3" />
                                {patient.phone}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="space-y-1 text-sm text-neutral-600 font-poppins">
                              <p>
                                Age: {patient.age} | {patient.gender}
                              </p>
                              <p>Blood: {patient.bloodType}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-neutral-900 font-poppins">
                              {patient.condition}
                            </span>
                            <p className="text-xs text-neutral-500">
                              Last visit: {patient.lastVisit}
                            </p>
                          </td>
                          <td className="p-4">
                            <span
                              className={cn(
                                "px-3 py-1 rounded-full text-xs font-poppins",
                                patient.status === "Active" &&
                                  "bg-neutral-200 text-neutral-800",
                                patient.status === "Inactive" &&
                                  "bg-neutral-300 text-neutral-800",
                                patient.status === "Critical" &&
                                  "bg-neutral-800 text-white",
                              )}
                            >
                              {patient.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                                onClick={() =>
                                  handleStartConsultation(patient, "chat")
                                }
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                                onClick={() =>
                                  handleStartConsultation(patient, "video")
                                }
                              >
                                <Video className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-600 hover:bg-neutral-50"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-600 hover:bg-neutral-50"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* Consultations Tab */}
        {activeTab === "consultations" && (
          <>
            {/* Header */}
            <motion.header
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-between items-center mb-8"
            >
              <div>
                <h1 className="text-4xl font-neue-bold text-neutral-900 flex items-center gap-3">
                  <Video className="w-10 h-10 text-neutral-700" />
                  Consultations
                </h1>
                <p className="text-neutral-600 font-poppins mt-1">
                  Chat and video consultations with your patients
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-neutral-900 rounded-full text-white text-xs flex items-center justify-center">
                    3
                  </span>
                </Button>
                <div className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                  DS
                </div>
              </div>
            </motion.header>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-6 h-[calc(100vh-160px)]"
            >
              {/* Patient List for Consultations */}
              <div
                className={cn(
                  "bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden transition-all duration-300 flex flex-col",
                  consultationMode ? "w-1/3" : "w-full",
                )}
              >
                <div className="p-4 border-b border-neutral-100 bg-neutral-100">
                  <h3 className="font-neue-bold text-lg text-neutral-900">
                    Available Patients
                  </h3>
                  <p className="text-sm text-neutral-600 font-poppins">
                    Select a patient to start consultation
                  </p>
                </div>
                <div className="p-4">
                  <div className="relative mb-4">
                    <Search className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search patients..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-poppins focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {patients.map((patient, idx) => (
                      <motion.div
                        key={patient.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={cn(
                          "p-3 rounded-xl border border-neutral-200 hover:bg-neutral-100 hover:border-neutral-300 transition-all cursor-pointer bg-white",
                          selectedPatient?.id === patient.id &&
                            "bg-neutral-100 border-neutral-300",
                        )}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                              {patient.name.charAt(0)}
                            </div>
                            <span
                              className={cn(
                                "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white",
                                patient.status === "Active" && "bg-neutral-900",
                                patient.status === "Inactive" &&
                                  "bg-neutral-400",
                                patient.status === "Critical" &&
                                  "bg-neutral-600",
                              )}
                            />
                          </div>
                          <div className="flex-1 w-full text-center">
                            <p className="font-neue-bold text-neutral-900 text-sm truncate">
                              {patient.name}
                            </p>
                            <p className="text-xs text-neutral-500 font-poppins truncate">
                              {patient.condition}
                            </p>
                          </div>
                          <div className="flex gap-2 w-full justify-center">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() =>
                                handleStartConsultation(patient, "chat")
                              }
                              className="p-1.5 rounded-lg bg-neutral-200 text-neutral-800 hover:bg-neutral-300 hover:text-neutral-900 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() =>
                                handleStartConsultation(patient, "video")
                              }
                              className="p-1.5 rounded-lg bg-neutral-200 text-neutral-800 hover:bg-neutral-300 transition-colors"
                            >
                              <Video className="w-3.5 h-3.5" />
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat Interface - Mobile-like UI */}
              <AnimatePresence>
                {consultationMode === "chat" && selectedPatient && (
                  <motion.div
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 100, opacity: 0 }}
                    className="flex-1 translate-y-[-50px] flex justify-center items-center"
                  >
                    <div className="w-[400px] h-[750px] bg-neutral-900 rounded-[3rem] p-2 shadow-2xl relative">
                      {/* Camera Icon on top of mobile frame */}
                      <div className="absolute top-4 right-12 z-30">
                        <button
                          onClick={() => setConsultationMode("video")}
                          className="p-2 rounded-full bg-neutral-800/90 hover:bg-neutral-700 transition-colors shadow-lg border border-neutral-700"
                        >
                          <Video className="w-4 h-4 text-white" />
                        </button>
                      </div>
                      <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden flex flex-col">
                        {/* Phone Notch */}
                        <div className="relative">
                          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-22 h-6 bg-neutral-900 rounded-full z-10" />
                        </div>
                        {/* Chat Header */}
                        <div className="bg-neutral-900 px-6 pt-8 pb-4">
                          <div className="flex items-center justify-between mt-2">
                            <button
                              onClick={() => {
                                setConsultationMode(null);
                                setSelectedPatient(null);
                              }}
                              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                            >
                              <ChevronLeft className="w-5 h-5 text-white" />
                            </button>
                            <div className="text-center">
                              <p className="text-white font-neue-bold">
                                {selectedPatient.name}
                              </p>
                              <p className="text-white/70 text-xs font-poppins">
                                Online
                              </p>
                            </div>
                            <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                              <Phone className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        </div>

                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50">
                          {chatMessages.map((msg) => (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                "flex",
                                msg.sender === "doctor"
                                  ? "justify-end"
                                  : "justify-start",
                              )}
                            >
                              <div
                                className={cn(
                                  "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
                                  msg.sender === "doctor"
                                    ? "bg-neutral-900 text-white rounded-br-md"
                                    : "bg-white text-neutral-900 rounded-bl-md",
                                )}
                              >
                                <p className="text-sm font-poppins">
                                  {msg.content}
                                </p>
                                <p
                                  className={cn(
                                    "text-xs mt-1",
                                    msg.sender === "doctor"
                                      ? "text-white/70"
                                      : "text-neutral-400",
                                  )}
                                >
                                  {msg.timestamp}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Chat Input */}
                        <div className="p-4 bg-white border-t border-neutral-100">
                          <div className="flex items-center gap-2">
                            <button className="p-2 rounded-full hover:bg-neutral-100 transition-colors">
                              <Paperclip className="w-5 h-5 text-neutral-500" />
                            </button>
                            <input
                              type="text"
                              placeholder="Type a message..."
                              value={chatMessage}
                              onChange={(e) => setChatMessage(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && handleSendMessage()
                              }
                              className="flex-1 px-4 py-2.5 rounded-full border border-neutral-200 bg-neutral-50 font-poppins text-sm focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none"
                            />
                            <button className="p-2 rounded-full hover:bg-neutral-100 transition-colors">
                              <Smile className="w-5 h-5 text-neutral-500" />
                            </button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={handleSendMessage}
                              className="p-2.5 rounded-full bg-neutral-900 text-white shadow-lg"
                            >
                              <Send className="w-5 h-5" />
                            </motion.button>
                          </div>
                        </div>

                        {/* Home Indicator */}
                        <div className="h-8 bg-white flex items-center justify-center">
                          <div className="w-32 h-1 bg-neutral-300 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Video Call Interface */}
                {consultationMode === "video" && selectedPatient && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="flex-1 bg-neutral-900 rounded-2xl overflow-hidden relative"
                  >
                    {/* Main Video (Patient) */}
                    <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-32 h-32 rounded-full bg-neutral-700 flex items-center justify-center text-white text-5xl font-neue-bold mx-auto mb-4">
                          {selectedPatient.name.charAt(0)}
                        </div>
                        <p className="text-white text-xl font-neue-bold">
                          {selectedPatient.name}
                        </p>
                        <p className="text-neutral-400 font-poppins">
                          {isVideoCallActive ? "Connected" : "Connecting..."}
                        </p>
                      </div>
                    </div>

                    {/* Self View (Doctor) */}
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute top-6 right-6 w-48 h-36 rounded-xl bg-neutral-700 shadow-2xl flex items-center justify-center overflow-hidden"
                    >
                      {isVideoOff ? (
                        <div className="text-center">
                          <VideoOff className="w-8 h-8 text-white/60 mx-auto" />
                          <p className="text-white/60 text-xs mt-2 font-poppins">
                            Camera Off
                          </p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-neue-bold">
                            DS
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* Patient Info Bar */}
                    <div className="absolute top-6 left-6 bg-black/40 backdrop-blur-md rounded-xl p-4 flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-neutral-400" />
                        <div>
                          <p className="text-white font-neue-bold text-sm">
                            {selectedPatient.name}
                          </p>
                          <p className="text-neutral-400 text-xs font-poppins">
                            {selectedPatient.condition}
                          </p>
                        </div>
                      </div>
                      <div className="w-px h-8 bg-neutral-600" />
                      <div className="text-center">
                        <p className="text-white text-xs font-poppins">
                          Blood Type
                        </p>
                        <p className="text-white font-neue-bold">
                          {selectedPatient.bloodType}
                        </p>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsMuted(!isMuted)}
                        className={cn(
                          "p-4 rounded-full transition-colors",
                          isMuted
                            ? "bg-red-500 text-white"
                            : "bg-white/20 text-white hover:bg-white/30",
                        )}
                      >
                        {isMuted ? (
                          <MicOff className="w-6 h-6" />
                        ) : (
                          <Mic className="w-6 h-6" />
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsVideoOff(!isVideoOff)}
                        className={cn(
                          "p-4 rounded-full transition-colors",
                          isVideoOff
                            ? "bg-red-500 text-white"
                            : "bg-white/20 text-white hover:bg-white/30",
                        )}
                      >
                        {isVideoOff ? (
                          <VideoOff className="w-6 h-6" />
                        ) : (
                          <VideoIcon className="w-6 h-6" />
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-4 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                      >
                        <Monitor className="w-6 h-6" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setConsultationMode("chat")}
                        className="p-4 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                      >
                        <MessageCircle className="w-6 h-6" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={handleEndCall}
                        className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                      >
                        <PhoneOff className="w-6 h-6" />
                      </motion.button>
                    </div>

                    {/* Call Duration */}
                    <div className="absolute bottom-8 right-8 bg-black/40 backdrop-blur-md rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-white font-poppins text-sm">
                          05:32
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}

        {/* Prescriptions Tab */}
        {activeTab === "prescriptions" && (
          <>
            {/* Header */}
            <motion.header
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-between items-center mb-8"
            >
              <div>
                <h1 className="text-4xl font-neue-bold text-neutral-900 flex items-center gap-3">
                  <Pill className="w-10 h-10 text-neutral-700" />
                  Prescriptions
                </h1>
                <p className="text-neutral-600 font-poppins mt-1">
                  Manage patient prescriptions and medications
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search prescriptions..."
                    className="pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 bg-white font-poppins focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none w-64 text-neutral-900"
                  />
                </div>
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-neutral-900 rounded-full text-white text-xs flex items-center justify-center">
                    3
                  </span>
                </Button>
                <div className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                  DS
                </div>
              </div>
            </motion.header>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Actions */}
              <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <Button variant="outline" className="gap-2">
                    <Filter className="w-4 h-4" />
                    Filter
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                  <Button className="bg-neutral-900 text-white hover:bg-neutral-800 gap-2">
                    <Plus className="w-4 h-4" />
                    New Prescription
                  </Button>
                </div>
              </div>

              {/* Prescription Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  {
                    label: "Active Prescriptions",
                    value: prescriptions.filter((p) => p.status === "Active")
                      .length,
                    icon: FileText,
                    color: "bg-neutral-900",
                  },
                  {
                    label: "Completed",
                    value: prescriptions.filter((p) => p.status === "Completed")
                      .length,
                    icon: CheckCircle,
                    color: "bg-neutral-700",
                  },
                  {
                    label: "Pending Refills",
                    value: 3,
                    icon: AlertCircle,
                    color: "bg-neutral-500",
                  },
                ].map((stat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white rounded-xl p-5 border border-white/30 shadow-lg flex items-center gap-4"
                  >
                    <div className={cn("p-3 rounded-xl", stat.color)}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-neue-bold text-neutral-900">
                        {stat.value}
                      </p>
                      <p className="text-sm text-neutral-600 font-poppins">
                        {stat.label}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Prescriptions List */}
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-100">
                      <tr>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Patient
                        </th>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Medication
                        </th>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Dosage
                        </th>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Frequency
                        </th>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Duration
                        </th>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Status
                        </th>
                        <th className="text-left p-4 font-neue-bold text-neutral-900">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {prescriptions.map((prescription, idx) => (
                        <motion.tr
                          key={prescription.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                                {prescription.patientName.charAt(0)}
                              </div>
                              <div>
                                <p className="font-neue-bold text-neutral-900">
                                  {prescription.patientName}
                                </p>
                                <p className="text-xs text-neutral-500 font-poppins">
                                  {prescription.date}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Pill className="w-4 h-4 text-neutral-700" />
                              <span className="font-poppins text-neutral-900">
                                {prescription.medication}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 font-poppins text-neutral-600">
                            {prescription.dosage}
                          </td>
                          <td className="p-4 font-poppins text-neutral-600">
                            {prescription.frequency}
                          </td>
                          <td className="p-4 font-poppins text-neutral-600">
                            {prescription.duration}
                          </td>
                          <td className="p-4">
                            <span
                              className={cn(
                                "px-3 py-1 rounded-full text-xs font-poppins",
                                prescription.status === "Active" &&
                                  "bg-neutral-200 text-neutral-800",
                                prescription.status === "Completed" &&
                                  "bg-neutral-300 text-neutral-700",
                                prescription.status === "Cancelled" &&
                                  "bg-neutral-800 text-white",
                              )}
                            >
                              {prescription.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-600 hover:bg-neutral-50"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-neutral-600 hover:bg-neutral-50"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <>
            {/* Header */}
            <motion.header
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-between items-center mb-8"
            >
              <div>
                <h1 className="text-4xl font-neue-bold text-neutral-900 flex items-center gap-3">
                  <BarChart3 className="w-10 h-10 text-neutral-700" />
                  Analytics Dashboard
                </h1>
                <p className="text-neutral-600 font-poppins mt-1">
                  Track your practice performance and insights
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-neutral-900 rounded-full text-white text-xs flex items-center justify-center">
                    3
                  </span>
                </Button>
                <div className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold">
                  DS
                </div>
              </div>
            </motion.header>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Filters */}
              <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <select className="px-4 py-2.5 rounded-xl border border-neutral-200 bg-white font-poppins focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none">
                    <option>Last 6 Months</option>
                    <option>Last 3 Months</option>
                    <option>Last Month</option>
                    <option>This Year</option>
                  </select>
                  <Button variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    Export Report
                  </Button>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: "Total Revenue",
                    value: "$265,200",
                    change: "+12.5%",
                    icon: DollarSign,
                    color: "bg-neutral-900",
                  },
                  {
                    label: "Total Patients",
                    value: "1,247",
                    change: "+8.2%",
                    icon: Users,
                    color: "bg-neutral-800",
                  },
                  {
                    label: "Consultations",
                    value: "892",
                    change: "+15.3%",
                    icon: Video,
                    color: "bg-neutral-700",
                  },
                  {
                    label: "Satisfaction",
                    value: "4.8/5",
                    change: "+0.3",
                    icon: Heart,
                    color: "bg-neutral-600",
                  },
                ].map((metric, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white rounded-xl p-5 border border-white/30 shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn("p-2.5 rounded-lg", metric.color)}>
                        <metric.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-neutral-900 text-sm font-poppins flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {metric.change}
                      </span>
                    </div>
                    <p className="text-2xl font-neue-bold text-neutral-900">
                      {metric.value}
                    </p>
                    <p className="text-sm text-neutral-600 font-poppins">
                      {metric.label}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Revenue & Patients Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
                >
                  <h3 className="text-xl font-neue-bold text-neutral-900 mb-6">
                    Revenue & Patient Trends
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e5e7eb"
                        opacity={0.5}
                      />
                      <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                      <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#6b7280"
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          border: "none",
                          borderRadius: "12px",
                          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenue"
                        stroke="#171717"
                        strokeWidth={3}
                        dot={{ fill: "#171717" }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="patients"
                        stroke="#a3a3a3"
                        strokeWidth={3}
                        dot={{ fill: "#a3a3a3" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-neutral-900" />
                      <span className="text-sm text-neutral-600 font-poppins">
                        Revenue ($)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-neutral-400" />
                      <span className="text-sm text-neutral-600 font-poppins">
                        Patients
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Consultation Types */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
                >
                  <h3 className="text-xl font-neue-bold text-neutral-900 mb-6">
                    Consultation Types
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={consultationTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {consultationTypeData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              CONSULTATION_COLORS[
                                index % CONSULTATION_COLORS.length
                              ]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.95)",
                          border: "none",
                          borderRadius: "12px",
                          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-4">
                    {consultationTypeData.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: CONSULTATION_COLORS[idx] }}
                        />
                        <span className="text-sm text-neutral-600 font-poppins">
                          {item.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* Bottom Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Patient Demographics */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
                >
                  <h3 className="text-xl font-neue-bold text-neutral-900 mb-6">
                    Age Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={patientAgeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {patientAgeData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-4">
                    {patientAgeData.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: COLORS[idx] }}
                        />
                        <span className="text-xs text-neutral-600 font-poppins">
                          {entry.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Recent Activity */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="lg:col-span-2 bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm"
                >
                  <h3 className="text-xl font-neue-bold text-neutral-900 mb-6">
                    Recent Activity
                  </h3>
                  <div className="space-y-4">
                    {[
                      {
                        action: "New patient registered",
                        patient: "John Smith",
                        time: "5 min ago",
                        icon: Users,
                        color: "bg-neutral-200 text-neutral-700",
                      },
                      {
                        action: "Video consultation completed",
                        patient: "Sarah Johnson",
                        time: "15 min ago",
                        icon: Video,
                        color: "bg-neutral-200 text-neutral-700",
                      },
                      {
                        action: "Prescription issued",
                        patient: "Michael Chen",
                        time: "30 min ago",
                        icon: FileText,
                        color: "bg-neutral-200 text-neutral-700",
                      },
                      {
                        action: "Appointment scheduled",
                        patient: "Emily Davis",
                        time: "1 hour ago",
                        icon: CalendarIcon,
                        color: "bg-neutral-200 text-neutral-700",
                      },
                      {
                        action: "Lab results uploaded",
                        patient: "Robert Wilson",
                        time: "2 hours ago",
                        icon: FileText,
                        color: "bg-neutral-200 text-neutral-700",
                      },
                    ].map((activity, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + idx * 0.1 }}
                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-neutral-50 transition-colors"
                      >
                        <div className={cn("p-2.5 rounded-lg", activity.color)}>
                          <activity.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-poppins text-neutral-900">
                            {activity.action}
                          </p>
                          <p className="text-sm text-neutral-500 font-poppins">
                            {activity.patient}
                          </p>
                        </div>
                        <span className="text-xs text-neutral-400 font-poppins">
                          {activity.time}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}

        {/* ── Settings / Profile tab ── */}
        {activeTab === "settings" && (
          <SettingsPanel />
        )}
      </main>
    </div>
  );
}

// ── Standalone settings panel (loads + saves doctor profile) ──
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

      // Keep local auth storage in sync
      const user = loadAuthUser();
      if (user) {
        saveAuthUser({ ...user, doctorProfile: { ...user.doctorProfile, ...doctor } });
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save. Please try again.");
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

  const inputCls = "w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 placeholder:text-neutral-400 font-poppins";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
      <h1 className="text-3xl font-neue-bold text-neutral-900 mb-2">Profile & Settings</h1>
      <p className="text-neutral-500 font-poppins mb-8">Update your professional details and consultation fee.</p>

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
        {/* Personal */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
          <h2 className="text-lg font-neue-bold text-neutral-900">Personal information</h2>

          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">Full name</label>
            <input type="text" name="fullName" value={form.fullName} onChange={handleChange} className={inputCls} placeholder="Dr. John Smith" />
          </div>

          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">Bio (optional)</label>
            <textarea name="bio" value={form.bio} onChange={handleChange} rows={3} className={inputCls + " resize-none"} placeholder="Brief professional summary visible to patients…" />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">Years of experience</label>
              <input type="number" name="experienceYears" value={form.experienceYears} onChange={handleChange} min="0" max="60" className={inputCls} placeholder="5" />
            </div>
          </div>
        </div>

        {/* Clinic */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
          <h2 className="text-lg font-neue-bold text-neutral-900">Clinic / Practice</h2>

          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">Clinic name</label>
            <input type="text" name="clinicName" value={form.clinicName} onChange={handleChange} className={inputCls} placeholder="Apollo Clinic, City Hospital, etc." />
          </div>

          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">Address</label>
            <input type="text" name="clinicAddress" value={form.clinicAddress} onChange={handleChange} className={inputCls} placeholder="123 Main St" />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">City</label>
              <input type="text" name="city" value={form.city} onChange={handleChange} className={inputCls} placeholder="Mumbai" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">Country</label>
              <input type="text" name="country" value={form.country} onChange={handleChange} className={inputCls} placeholder="India" />
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5">
          <h2 className="text-lg font-neue-bold text-neutral-900">Billing & Payments</h2>
          <p className="text-sm text-neutral-500 font-poppins -mt-2">
            Patients pay their second and subsequent appointments via PayPal. Set your fee and PayPal email here.
          </p>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">Consultation fee (USD)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-poppins text-sm">$</span>
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
          </div>

          <div>
            <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">PayPal email (for receiving payments)</label>
            <input type="email" name="paypalEmail" value={form.paypalEmail} onChange={handleChange} className={inputCls} placeholder="doctor@paypal.com" />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-neutral-900 text-white font-semibold font-poppins hover:bg-neutral-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : "Save changes"}
        </button>
      </form>
    </motion.div>
  );
}
