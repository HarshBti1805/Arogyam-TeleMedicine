"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rehabAlerts, RehabAlert } from "@/lib/rehab-api";

export default function RehabAlertsPage() {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<string>("");
  const [inputId, setInputId] = useState("");
  const [alerts, setAlerts] = useState<RehabAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async (dId: string) => {
    setLoading(true);
    setError(null);
    try {
      const { alerts: a } = await rehabAlerts.list(dId);
      setAlerts(a);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = () => {
    if (!inputId.trim()) return;
    setDoctorId(inputId.trim());
    fetchAlerts(inputId.trim());
  };

  const handleAck = async (id: string) => {
    setAckingId(id);
    try {
      await rehabAlerts.acknowledge(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAckingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="mb-6 text-sm text-blue-600 hover:underline">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Rehab Alerts</h1>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            placeholder="Doctor ID"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
          />
          <button
            onClick={handleLoad}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Load
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && <p className="text-gray-500 text-sm">Loading alerts…</p>}

        {!loading && doctorId && alerts.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No unacknowledged alerts.</p>
          </div>
        )}

        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-xl border p-5 ${severityBorder(alert.severity)}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-xs text-gray-400">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{alert.reason}</p>
                  {alert.plan && (
                    <button
                      onClick={() => router.push(`/rehab/plans/${alert.planId}`)}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      View Plan: {alert.plan.title}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleAck(alert.id)}
                  disabled={ackingId === alert.id}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-gray-600 whitespace-nowrap"
                >
                  {ackingId === alert.id ? "…" : "Acknowledge"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    HIGH: "bg-red-100 text-red-700",
    MEDIUM: "bg-amber-100 text-amber-700",
    LOW: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[severity] ?? "bg-gray-100 text-gray-700"}`}>
      {severity}
    </span>
  );
}

function severityBorder(severity: string) {
  const map: Record<string, string> = {
    HIGH: "border-red-200",
    MEDIUM: "border-amber-200",
    LOW: "border-blue-200",
  };
  return map[severity] ?? "border-gray-200";
}
