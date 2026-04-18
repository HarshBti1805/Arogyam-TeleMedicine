"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { rehabPlans, rehabAlerts, RehabPlan, RehabAlert, RehabSession } from "@/lib/rehab-api";

export default function RehabPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [plan, setPlan] = useState<RehabPlan | null>(null);
  const [alerts, setAlerts] = useState<RehabAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackingId, setAckingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([rehabPlans.get(id)])
      .then(([{ plan: p }]) => {
        setPlan(p);
        // Fetch alerts for this plan's doctor
        if (p.doctorId) {
          rehabAlerts
            .list(p.doctorId)
            .then(({ alerts: a }) =>
              setAlerts(a.filter((al) => al.planId === id))
            )
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleAck = async (alertId: string) => {
    setAckingId(alertId);
    try {
      await rehabAlerts.acknowledge(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } finally {
      setAckingId(null);
    }
  };

  // Build chart data from sessions
  const chartData = (plan?.sessions ?? [])
    .filter((s) => s.status === "COMPLETED" && s.overallScore !== null)
    .map((s, idx) => ({
      session: idx + 1,
      score: s.overallScore,
      date: new Date(s.completedAt ?? s.startedAt).toLocaleDateString(),
    }));

  const completedCount = (plan?.sessions ?? []).filter(
    (s) => s.status === "COMPLETED"
  ).length;
  const totalExercises = plan?.exercises.length ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading plan…</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Plan not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 text-sm text-blue-600 hover:underline"
        >
          ← Back
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{plan.title}</h1>
            {plan.description && (
              <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
            )}
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(plan.status)}`}
          >
            {plan.status}
          </span>
        </div>

        {/* Alerts panel */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between rounded-lg px-4 py-3 border ${alertColor(alert.severity)}`}
              >
                <div>
                  <span className="text-xs font-semibold uppercase">{alert.severity}</span>
                  <p className="text-sm mt-0.5">{alert.reason}</p>
                </div>
                <button
                  onClick={() => handleAck(alert.id)}
                  disabled={ackingId === alert.id}
                  className="ml-4 text-xs underline opacity-70 hover:opacity-100 disabled:opacity-40"
                >
                  {ackingId === alert.id ? "…" : "Dismiss"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Score trend chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-800 mb-4">Score Trend</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="session"
                  label={{ value: "Session", position: "insideBottom", offset: -2 }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(1)}`, "Score"]}
                  labelFormatter={(l) => `Session ${l}`}
                />
                <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 2" label="60" />
                <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="4 2" label="40" />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#3b82f6" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Exercises" value={totalExercises} />
          <StatCard label="Sessions Done" value={completedCount} />
          <StatCard
            label="Avg Score"
            value={
              chartData.length
                ? `${(chartData.reduce((s, d) => s + (d.score ?? 0), 0) / chartData.length).toFixed(1)}`
                : "—"
            }
          />
        </div>

        {/* Exercise list */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Exercises</h2>
          {plan.exercises.length === 0 ? (
            <p className="text-sm text-gray-500">No exercises in this plan.</p>
          ) : (
            <div className="space-y-3">
              {plan.exercises.map((ex, idx) => (
                <div key={ex.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-800">
                        {idx + 1}. {ex.name}
                      </p>
                      {ex.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{ex.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Tag>{ex.targetJoint.replace(/_/g, " ")}</Tag>
                    <Tag>
                      {ex.targetAngleMin}°–{ex.targetAngleMax}°
                    </Tag>
                    <Tag>
                      {ex.reps}r × {ex.sets}s
                    </Tag>
                    <Tag>hold {ex.holdDurationSec}s</Tag>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Session history */}
        {(plan.sessions ?? []).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
            <h2 className="font-semibold text-gray-800 mb-4">Session History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-700">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {(plan.sessions ?? []).map((s) => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="py-2 pr-4">
                        {new Date(s.startedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4">{s.status}</td>
                      <td className="py-2">
                        {s.overallScore !== null ? `${s.overallScore.toFixed(1)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600">{children}</span>
  );
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    PAUSED: "bg-amber-100 text-amber-700",
    COMPLETED: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

function alertColor(severity: string) {
  const map: Record<string, string> = {
    HIGH: "bg-red-50 border-red-200 text-red-800",
    MEDIUM: "bg-amber-50 border-amber-200 text-amber-800",
    LOW: "bg-blue-50 border-blue-200 text-blue-800",
  };
  return map[severity] ?? "bg-gray-50 border-gray-200 text-gray-800";
}
