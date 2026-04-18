"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { rehabPlans, SuggestedExercise, RehabExercise } from "@/lib/rehab-api";
import { loadAuthUser } from "@/lib/auth-storage";

const TARGET_JOINTS = [
  "knee_left",
  "knee_right",
  "elbow_left",
  "elbow_right",
  "shoulder_abduction_left",
  "shoulder_abduction_right",
  "hip_flexion_left",
  "hip_flexion_right",
];

interface ExerciseForm {
  name: string;
  description: string;
  targetJoint: string;
  targetAngleMin: number;
  targetAngleMax: number;
  holdDurationSec: number;
  reps: number;
  sets: number;
  videoDemoUrl: string;
  order: number;
}

function blankExercise(order = 0): ExerciseForm {
  return {
    name: "",
    description: "",
    targetJoint: "knee_left",
    targetAngleMin: 90,
    targetAngleMax: 140,
    holdDurationSec: 3,
    reps: 10,
    sets: 3,
    videoDemoUrl: "",
    order,
  };
}

export default function RehabCreateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const appointmentId = searchParams.get("appointmentId") ?? undefined;
  const analysisId = searchParams.get("analysisId") ?? undefined;
  const prefillRaw = searchParams.get("exercises");

  const [patientId, setPatientId] = useState("");
  // doctorId pre-filled from URL param (passed by dashboard) or auth storage
  const [doctorId, setDoctorId] = useState(searchParams.get("doctorId") ?? "");
  const [title, setTitle] = useState("Rehab Plan");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState<ExerciseForm[]>([blankExercise(0)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill doctorId from auth if not passed via URL
  useEffect(() => {
    if (!doctorId) {
      const user = loadAuthUser();
      const dId = user?.doctorProfile?.id;
      if (dId) setDoctorId(dId);
    }
  }, []);

  // Pre-fill from AI analysis suggestions passed via query param
  useEffect(() => {
    if (prefillRaw) {
      try {
        const suggested: SuggestedExercise[] = JSON.parse(prefillRaw);
        setExercises(
          suggested.map((ex, idx) => ({
            name: ex.name,
            description: ex.description,
            targetJoint: ex.targetJoint,
            targetAngleMin: ex.targetAngleMin,
            targetAngleMax: ex.targetAngleMax,
            holdDurationSec: ex.holdDurationSec,
            reps: ex.reps,
            sets: ex.sets,
            videoDemoUrl: "",
            order: idx,
          }))
        );
      } catch {}
    }
  }, [prefillRaw]);

  const updateExercise = <K extends keyof ExerciseForm>(
    idx: number,
    key: K,
    value: ExerciseForm[K]
  ) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === idx ? { ...ex, [key]: value } : ex))
    );
  };

  const addExercise = () =>
    setExercises((prev) => [...prev, blankExercise(prev.length)]);

  const removeExercise = (idx: number) =>
    setExercises((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId.trim() || !doctorId.trim()) {
      setError("Patient ID and Doctor ID are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { plan } = await rehabPlans.create({
        patientId: patientId.trim(),
        doctorId: doctorId.trim(),
        appointmentId,
        aiAnalysisId: analysisId,
        title,
        description,
        exercises: exercises.map((ex) => ({
          ...ex,
          videoDemoUrl: ex.videoDemoUrl || undefined,
        })),
      });
      router.push(`/rehab/plans/${plan.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="mb-6 text-sm text-blue-600 hover:underline">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Rehab Plan</h1>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan metadata */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">Plan Details</h2>
            <Field label="Patient ID *">
              <input
                type="text"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className={inputCls}
                placeholder="patient-profile-uuid"
                required
              />
            </Field>
            <Field label="Doctor ID *">
              <input
                type="text"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className={inputCls}
                placeholder="doctor-profile-uuid"
                required
              />
            </Field>
            <Field label="Title *">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${inputCls} h-20 resize-none`}
              />
            </Field>
          </div>

          {/* Exercises */}
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800">Exercises</h2>
            {exercises.map((ex, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-700">Exercise {idx + 1}</h3>
                  {exercises.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExercise(idx)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Name *">
                    <input
                      type="text"
                      value={ex.name}
                      onChange={(e) => updateExercise(idx, "name", e.target.value)}
                      className={inputCls}
                      required
                    />
                  </Field>
                  <Field label="Target Joint">
                    <select
                      value={ex.targetJoint}
                      onChange={(e) => updateExercise(idx, "targetJoint", e.target.value)}
                      className={inputCls}
                    >
                      {TARGET_JOINTS.map((j) => (
                        <option key={j} value={j}>
                          {j.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={`Angle Min: ${ex.targetAngleMin}°`}>
                    <input
                      type="range"
                      min={0}
                      max={180}
                      value={ex.targetAngleMin}
                      onChange={(e) =>
                        updateExercise(idx, "targetAngleMin", Number(e.target.value))
                      }
                      className="w-full"
                    />
                  </Field>
                  <Field label={`Angle Max: ${ex.targetAngleMax}°`}>
                    <input
                      type="range"
                      min={0}
                      max={180}
                      value={ex.targetAngleMax}
                      onChange={(e) =>
                        updateExercise(idx, "targetAngleMax", Number(e.target.value))
                      }
                      className="w-full"
                    />
                  </Field>
                  <Field label="Reps">
                    <input
                      type="number"
                      min={1}
                      value={ex.reps}
                      onChange={(e) => updateExercise(idx, "reps", Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Sets">
                    <input
                      type="number"
                      min={1}
                      value={ex.sets}
                      onChange={(e) => updateExercise(idx, "sets", Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Hold Duration (sec)">
                    <input
                      type="number"
                      min={1}
                      value={ex.holdDurationSec}
                      onChange={(e) =>
                        updateExercise(idx, "holdDurationSec", Number(e.target.value))
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      type="text"
                      value={ex.description}
                      onChange={(e) => updateExercise(idx, "description", e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addExercise}
              className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              + Add Exercise
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Creating…" : "Create Rehab Plan"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}
