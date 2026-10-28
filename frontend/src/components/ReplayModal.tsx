import { useEffect, useRef, useState } from "react";
import { ArrowRight, FlaskConical, X } from "lucide-react";
import { api, errorMessage } from "../api/client";
import type { CaseStatus, Policy, ReplayRequest, ReplayResult } from "../api/types";
import { typeInfo } from "../friendly";
import { Alert, Button, Chip, EmptyState, IconButton, Spinner, StatusTag, fmtSigned } from "./ui";

const STATUS_FIELDS: { key: "missingSettlement" | "ambiguousReference" | "unexpectedSettlement" | "referenceMismatch" | "exportDuplicate"; text: string }[] = [
  { key: "missingSettlement", text: "Missing settlement" },
  { key: "ambiguousReference", text: "Ambiguous match" },
  { key: "unexpectedSettlement", text: "Unexpected settlement" },
  { key: "referenceMismatch", text: "Reference mismatch" },
  { key: "exportDuplicate", text: "Duplicate export row" },
];
const STATUSES: CaseStatus[] = ["REVIEW_REQUIRED", "AUTO_MATCHED"];

/** What-if simulation: proposed rules become a new policy version; stored decisions are never overwritten. */
export function ReplayModal({ batchId, policy, onClose, onDone }: {
  batchId: string; policy: Policy | null; onClose: () => void; onDone: () => void;
}) {
  const base = {
    amountTolerance: policy?.amountTolerance ?? 10,
    requireInvoice: policy?.requireInvoice ?? true,
    duplicatePaymentAllowed: policy?.duplicatePaymentAllowed ?? false,
    ...Object.fromEntries(STATUS_FIELDS.map((f) => [f.key, policy?.[f.key] ?? "REVIEW_REQUIRED"])),
  } as Required<Pick<ReplayRequest, "amountTolerance" | "requireInvoice" | "duplicatePaymentAllowed">> & Record<string, unknown>;
  const [form, setForm] = useState<ReplayRequest>({ ...base, batchId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReplayResult | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [onClose]);

  const set = <K extends keyof ReplayRequest>(k: K, v: ReplayRequest[K]) => setForm((f) => ({ ...f, [k]: v }));
  const changed = (k: string) => (form as Record<string, unknown>)[k] !== base[k];
  const anyChange = Object.keys(base).some(changed);
  const fieldClass = (k: string) => (changed(k) ? "border-teal-500 bg-teal-50/40 ring-1 ring-teal-500/30" : "border-slate-300 bg-white");

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.replay({ ...form, description: `UI replay: ${Object.keys(base).filter(changed).join(", ")}` }));
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="replay-title"
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-6 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
            <FlaskConical aria-hidden className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 id="replay-title" className="text-lg font-semibold text-slate-900">What if the rules changed?</h2>
            <p className="text-[13px] text-slate-600">
              Change a rule and see which cases would be decided differently. Nothing is changed for real:
              it's only a simulation.
            </p>
          </div>
          <IconButton label="Close (Esc)" onClick={onClose}><X aria-hidden className="h-5 w-5" /></IconButton>
        </header>

        <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-[320px_1fr]">
          <form
            className="space-y-4 border-b border-slate-200 p-6 md:border-b-0 md:border-r"
            onSubmit={(e) => { e.preventDefault(); run(); }}
          >
            <p className="text-[13px] text-slate-600">Start from today's rules. What you change is highlighted.</p>
            <label className="block">
              <span className="text-sm font-medium text-slate-800">Accept small differences up to ({policy?.currency ?? "EUR"})</span>
              <span className="block text-[13px] text-slate-600">Smaller differences are settled automatically. Today: {base.amountTolerance}.</span>
              <input
                type="number" min={0} step={0.5} inputMode="decimal"
                value={form.amountTolerance ?? ""}
                onChange={(e) => set("amountTolerance", e.target.value === "" ? undefined : Number(e.target.value))}
                className={`tabular mt-1.5 h-9 w-full rounded-lg border px-2.5 text-sm ${fieldClass("amountTolerance")}`}
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-800">Rules</legend>
              <Check label="An invoice is required" checked={!!form.requireInvoice} highlight={changed("requireInvoice")} onChange={(v) => set("requireInvoice", v)} />
              <Check label="Duplicate payments are allowed" checked={!!form.duplicatePaymentAllowed} highlight={changed("duplicatePaymentAllowed")} onChange={(v) => set("duplicatePaymentAllowed", v)} />
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-800">Who decides each kind of problem</legend>
              {STATUS_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-3 text-[13px] text-slate-700">
                  {f.text}
                  <select
                    value={form[f.key] as string}
                    onChange={(e) => set(f.key, e.target.value as CaseStatus)}
                    className={`h-8 rounded-lg border px-2 text-[13px] ${fieldClass(f.key)}`}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s === "REVIEW_REQUIRED" ? "A person" : "Automatic"}</option>)}
                  </select>
                </label>
              ))}
            </fieldset>
            <Button type="submit" variant="primary" className="w-full" disabled={busy || !anyChange}>
              {busy && <Spinner />} Show me what changes
            </Button>
            {!anyChange && <p className="text-center text-[13px] text-slate-500">Change at least one rule first. Try 5 instead of 10.</p>}
            {error && <Alert title="The simulation could not run" message={error} onClose={() => setError(null)} />}
          </form>

          <div className="min-h-0 overflow-auto p-6" aria-live="polite">
            {!result ? (
              <EmptyState icon={FlaskConical} title="Nothing simulated yet">
                Change a rule on the left. The cases that would be decided differently appear here.
              </EmptyState>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <p className="text-[15px] text-slate-900">
                    <b className="tabular">{result.changedCases}</b> of {result.evaluatedCases} cases would be decided differently
                  </p>
                  <Chip title={`Saved as policy version ${result.newVersion.version} for the audit trail`}>Simulation saved</Chip>
                  {result.simulationOnly && <Chip>Nothing changed for real</Chip>}
                </div>
                {result.changes.length === 0 ? (
                  <EmptyState title="No case would change">With these rules every case is decided the same way as today.</EmptyState>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {result.changes.map((c) => (
                      <li key={c.caseId} className="p-4">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <span className="mono font-semibold text-slate-900">{c.subjectId}</span>
                          <span className="text-[13px] text-slate-600">
                            {typeInfo(c.type).title}{c.difference != null && ` · difference ${fmtSigned(c.difference, c.currency)}`}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusTag value={c.beforeStatus} size="sm" />
                          <ArrowRight aria-label="becomes" className="h-4 w-4 text-slate-400" />
                          <StatusTag value={c.afterStatus} size="sm" />
                        </div>
                        <p className="mt-2 text-[13px] text-slate-700">{c.afterReason}</p>

                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Check({ label: text, checked, highlight, onChange }: { label: string; checked: boolean; highlight: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-slate-700 ${highlight ? "bg-teal-50 ring-1 ring-teal-500/30" : "hover:bg-slate-50"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-teal-700" />
      {text}
    </label>
  );
}
