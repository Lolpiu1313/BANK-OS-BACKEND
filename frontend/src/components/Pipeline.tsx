import { useEffect, useState } from "react";
import { Check, CircleX } from "lucide-react";
import type { BatchStatus } from "../api/types";
import { Spinner } from "./ui";

const STAGES: { status: BatchStatus; label: string; doing: string }[] = [
  { status: "UPLOADED", label: "Upload", doing: "Files received" },
  { status: "PARSING", label: "Read files", doing: "Reading the CSV rows and extracting the invoice PDFs…" },
  { status: "RECONCILING", label: "Match", doing: "Matching payments with settlements and invoices…" },
  { status: "INVESTIGATING", label: "Investigate", doing: "The AI investigator is collecting evidence for each exception…" },
  { status: "APPLYING_POLICY", label: "Apply policy", doing: "Applying the versioned policy rules…" },
  { status: "READY_FOR_REVIEW", label: "Ready", doing: "Done" },
];

/** Progress of the batch pipeline, with what is happening now and the elapsed time. */
export function Pipeline({ status, error, startedAt }: { status: BatchStatus; error?: string | null; startedAt: string }) {
  const failed = status === "FAILED";
  const current = STAGES.findIndex((s) => s.status === status);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (failed || status === "READY_FOR_REVIEW") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [failed, status]);
  const elapsed = Math.max(0, (now - new Date(startedAt).getTime()) / 1000);

  return (
    <div aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={`flex items-center gap-2 font-medium ${failed ? "text-red-800" : "text-slate-900"}`}>
          {failed ? <CircleX aria-hidden className="h-4 w-4" /> : <Spinner className="text-teal-700" />}
          {failed ? "Processing failed" : STAGES[current]?.doing ?? "Working…"}
        </p>
        {!failed && <span className="tabular text-[13px] text-slate-500">{elapsed.toFixed(1)} s elapsed</span>}
      </div>
      {failed && error && <p className="mt-1 text-sm text-red-700">{error}. Cases created before the failure are kept.</p>}
      <ol className="mt-3 grid grid-cols-6 gap-1.5" aria-label="Processing stages">
        {STAGES.map((s, i) => {
          const done = !failed && i < current;
          const active = !failed && i === current;
          return (
            <li key={s.status} aria-current={active ? "step" : undefined}>
              <span className={`block h-1.5 rounded-full ${failed ? "bg-red-300" : done ? "bg-teal-600" : active ? "animate-pulse bg-teal-400" : "bg-slate-200"}`} />
              <span className={`mt-1.5 flex items-center gap-1 text-xs ${active ? "font-medium text-slate-900" : done ? "text-slate-600" : "text-slate-500"}`}>
                {done && <Check aria-hidden className="h-3 w-3 text-teal-700" />}
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
