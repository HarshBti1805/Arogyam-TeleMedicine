"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Video, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Appointment {
  id: string;
  patientName: string;
  time: string;
  type: string;
  date: Date;
  color?: string;
}

interface CalendarProps {
  appointments: Appointment[];
  onDateSelect?: (date: Date) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
}

/** Sort a list of appointments by their time string ("09:00 AM", "2:30 PM" …) */
function sortByTime(apts: Appointment[]): Appointment[] {
  return [...apts].sort((a, b) => {
    // Parse "hh:mm AM/PM" into a comparable number
    const toMinutes = (t: string) => {
      const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return 0;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const period = match[3].toUpperCase();
      if (period === "PM" && h !== 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };
    return toMinutes(a.time) - toMinutes(b.time);
  });
}

export function Calendar({
  appointments,
  onDateSelect,
  onAppointmentClick,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Deduplicate by ID once — avoids duplicates from parent re-renders
  const uniqueAppointments = useMemo(() => {
    const seen = new Set<string>();
    return appointments.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [appointments]);

  const getAppointmentsForDate = (date: Date) =>
    sortByTime(uniqueAppointments.filter((apt) => isSameDay(apt.date, date)));

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-neutral-900 p-6">
        <div className="flex items-center justify-between">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </motion.button>
          <h2 className="text-2xl font-neue-bold text-white">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </motion.button>
        </div>
      </div>

      {/* Week day labels */}
      <div className="grid grid-cols-7 bg-neutral-100">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-3 text-center text-sm font-neue-bold text-neutral-900"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayApts = getAppointmentsForDate(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isDayToday = isToday(day);

          return (
            <motion.div
              key={idx}
              whileHover={{ scale: 0.98 }}
              onClick={() => handleDateClick(day)}
              className={cn(
                "min-h-[100px] border-b border-r border-neutral-100 p-2 cursor-pointer transition-all duration-200",
                !isCurrentMonth && "bg-neutral-50/50",
                isSelected && "bg-neutral-100 ring-2 ring-inset ring-neutral-400",
                isDayToday && !isSelected && "bg-blue-50/40"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-sm font-poppins",
                    isDayToday && "bg-neutral-900 text-white font-bold",
                    !isDayToday && !isCurrentMonth && "text-neutral-400",
                    !isDayToday && isCurrentMonth && "text-neutral-700"
                  )}
                >
                  {format(day, "d")}
                </span>
                {dayApts.length > 0 && (
                  <span className="text-xs bg-neutral-900 text-white w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {dayApts.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {dayApts.slice(0, 2).map((apt) => (
                  <motion.div
                    key={apt.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick?.(apt);
                    }}
                    className="text-xs p-1.5 rounded-lg truncate cursor-pointer bg-neutral-200 text-neutral-800 hover:bg-neutral-300 transition-all"
                  >
                    <span className="font-semibold">{apt.time}</span>{" "}
                    <span className="opacity-80">{apt.patientName}</span>
                  </motion.div>
                ))}
                {dayApts.length > 2 && (
                  <div className="text-xs text-neutral-500 font-medium pl-1">
                    +{dayApts.length - 2} more
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Selected date agenda */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-neutral-100 overflow-hidden"
          >
            <div className="p-6 bg-neutral-50">
              <h3 className="font-neue-bold text-lg text-neutral-900 mb-4">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </h3>

              {getAppointmentsForDate(selectedDate).length === 0 ? (
                <p className="text-neutral-400 font-poppins text-sm text-center py-6">
                  No appointments scheduled for this day.
                </p>
              ) : (
                <div className="relative pl-6 space-y-0">
                  {/* Vertical timeline line */}
                  <div className="absolute left-2 top-2 bottom-2 w-px bg-neutral-300" />

                  {getAppointmentsForDate(selectedDate).map((apt, idx) => (
                    <motion.div
                      key={apt.id}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.06 }}
                      onClick={() => onAppointmentClick?.(apt)}
                      className="relative flex items-start gap-4 py-3 cursor-pointer group"
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-4 top-4 w-2.5 h-2.5 rounded-full bg-neutral-900 ring-2 ring-neutral-50 shrink-0" />

                      <div className="flex-1 bg-white rounded-xl shadow-sm border border-neutral-200 p-4 group-hover:border-neutral-400 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-neutral-900 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                              {apt.patientName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-neue-bold text-neutral-900">
                                {apt.patientName}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {apt.type === "Video Call" || apt.type === "ONLINE" ? (
                                  <Video className="w-3 h-3 text-blue-500" />
                                ) : (
                                  <MapPin className="w-3 h-3 text-green-600" />
                                )}
                                <span className="text-xs text-neutral-500 font-poppins">
                                  {apt.type}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-neutral-700 shrink-0">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-sm font-semibold font-poppins">
                              {apt.time}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
