"use client";

import { Suspense } from "react";
import RehabCreateInner from "./RehabCreateInner";

export default function RehabCreatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading…</div>}>
      <RehabCreateInner />
    </Suspense>
  );
}
