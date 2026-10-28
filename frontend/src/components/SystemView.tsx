import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Brain, ChevronDown, FileText, Gauge, ShieldCheck, Timer } from "lucide-react";
import { api } from "../api/client";
import type { BatchEvent, CaseDetail, CaseSummary, InvoiceInfo, Metrics, SystemInfo } from "../api/types";
import { EventsFeed } from "./EventsFeed";
import { PdfViewer } from "./PdfViewer";
import { Button, Skeleton, StatusTag, fmtMoney, fmtMs } from "./ui";

const INVESTIGATOR = "InvestigationAgent";

const SAFETY_RULES: [string, string][] = [
  ["The AI never makes the decision", "Only the bank's written rules decide. The AI explains and suggests."],
  ["Every claim must have proof", "If the AI points to a record that doesn't exist, its answer is thrown away."],
  ["The AI can only read", "It can look up records for one case at a time and cannot change anything."],
  ["When in doubt, a person decides", "No connection, too slow or a strange answer: the case goes to you."],
  ["Documents can't give orders", "Text inside a PDF is treated as data. Hidden instructions are ignored."],
  ["No money ever moves", "Your decisions are only written down. The system cannot make payments."],
];

const STAGE_NAMES: Record<string, string> = {
  PARSING: "Reading the files",
  RECONCILING: "Matching the records",
  INVESTIGATING: "AI assistant investigating",
  APPLYING_POLICY: "Applying the rules",
};

/** "Behind the scenes": how the AI worked, its limits, accuracy, documents and safety rules. */
export function SystemView({ batchId, system, systemFailed, onRetrySystem, metrics, events, invoices, cases, onSelectCase }: {
  batchId: string; system: SystemInfo | null; systemFailed: boolean; onRetrySystem: () => void; metrics: Metrics | null;
  events: BatchEvent[]; invoices: InvoiceInfo[]; cases: CaseSummary[]; onSelectCase: (id: string) => void;
}) {
  // Never leave a placeholder spinning forever: say what failed and offer a retry.
  const systemPending = systemFailed ? (
    <div className="text-[14px] text-slate-800">
      <p>These settings could not be loaded. The server may have been restarting.</p>
      <Button size="sm" className="mt-3" onClick={onRetrySystem}>Try again</Button>
    </div>
  ) : <Skeleton className="h-20" />;
  const [pdf, setPdf] = useState<InvoiceInfo | null>(null);

  const stats = useMemo(() => {
    const toolCalls = events.filter((e) => e.kind === "AGENT" && e.agent === INVESTIGATOR && e.tool);
    const perCase = new Map<string, number>();
    toolCalls.forEach((e) => e.caseId && perCase.set(e.caseId, (perCase.get(e.caseId) ?? 0) + 1));
    const stages = events.filter((e) => e.kind === "AGENT" && e.agent === "AgentOrchestrator" && e.tool);
    const failures = events.filter((e) => e.kind === "AGENT" && e.state === "FAILED").length;
    return { calls: toolCalls.length, cases: perCase.size, max: Math.max(0, ...perCase.values()), stages, failures };
  }, [events]);

  const offline = system?.aiMode !== "LIVE";
  const verified = invoices.filter((i) => i.status === "VERIFIED").length;

  return (
    <div className="space-y-5">
      {pdf && <PdfViewer batchId={batchId} file={pdf.sourceFile} page={pdf.sourcePage} onClose={() => setPdf(null)} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <ColorCard icon={Brain} title="The AI assistant" tone="bg-violet-50 ring-violet-200" accent="bg-violet-600">
          {!system ? systemPending : (
            <>
              <p className="text-[15px] leading-relaxed text-slate-800">
                It looked at <b>{stats.cases}</b> cases and did <b>{stats.calls}</b> look-ups, at most <b>{stats.max}</b> per case
                (the limit is {system.maxToolCallsPerInvestigation}).
              </p>
              <p className="mt-2 text-[13px] text-slate-700">
                {offline
                  ? "Running offline: summaries are written by fixed rules, without an AI model, and are labelled that way."
                  : `Running live with the ${system.chatModel} model.`}
              </p>
              <p className="mt-2 text-[13px] text-slate-700">
                {stats.failures === 0 ? "No step failed." : `${stats.failures} step(s) failed; those cases went to a person.`}
              </p>
            </>
          )}
        </ColorCard>

        <ColorCard icon={ShieldCheck} title="Safety limits" tone="bg-sky-50 ring-sky-200" accent="bg-sky-600">
          {!system ? systemPending : (
            <ul className="space-y-1.5 text-[14px] text-slate-800">
              <li>At most <b>{system.maxToolCallsPerInvestigation} look-ups</b> per case</li>
              <li>At most <b>{system.aiTimeoutSeconds} seconds</b> per AI answer, then a person takes over</li>
              <li>At most <b>{system.maxInvestigationsPerBatch} cases</b> investigated automatically per upload</li>
              <li>Up to <b>{system.maxInvoicesPerBatch} invoices</b> and <b>{Math.round(system.maxFileSizeBytes / 1048576)} MB</b> per file</li>
            </ul>
          )}
        </ColorCard>

        <ColorCard icon={Timer} title="How long it took" tone="bg-teal-50 ring-teal-200" accent="bg-teal-600">
          {!metrics ? <Skeleton className="h-20" /> : (
            <ul className="space-y-1.5 text-[14px] text-slate-800">
              {stats.stages.map((s, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{STAGE_NAMES[s.tool!] ?? s.tool}</span><span className="tabular text-slate-700">{fmtMs(s.durationMs)}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3 border-t border-teal-200 pt-1.5 font-semibold">
                <span>Total</span><span className="tabular">{fmtMs(metrics.processingTimeMs)}</span>
              </li>
            </ul>
          )}
        </ColorCard>
      </div>

      <Accuracy metrics={metrics} cases={cases} />

      <section className="rounded-2xl bg-fuchsia-50 p-5 ring-1 ring-fuchsia-200">
        <SectionTitle icon={FileText} accent="bg-fuchsia-600" title="Invoices we read"
                      sub={`${verified} of ${invoices.length} could be read and checked against the page.`} />
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {invoices.map((inv) => (
            <li key={inv.sourceFile} className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-fuchsia-100">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-slate-900">{inv.number ?? inv.sourceFile.replace(/\.pdf$/i, "")}</span>
                <StatusTag value={inv.status} size="sm" />
              </div>
              <span className="mt-0.5 text-[13px] text-slate-600">{inv.supplier ?? "Supplier unknown"}</span>
              <span className="tabular mt-2 font-medium text-slate-900">{inv.amount != null ? fmtMoney(inv.amount, inv.currency) : "Amount not readable"}</span>
              {inv.status !== "VERIFIED" && <span className="mt-1 text-[13px] text-amber-800">{inv.verificationNotes}</span>}
              <Button size="sm" className="mt-3 self-start" onClick={() => setPdf(inv)}>View invoice</Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
        <SectionTitle icon={BadgeCheck} accent="bg-emerald-600" title="Safety rules" sub="What keeps the AI honest and the money safe." />
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SAFETY_RULES.map(([title, text]) => (
            <li key={title} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-emerald-100">
              <p className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck aria-hidden className="h-4 w-4 text-emerald-700" />{title}</p>
              <p className="mt-1 text-[13px] text-slate-700">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <details className="group rounded-2xl bg-white ring-1 ring-slate-200">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 font-semibold text-slate-900">
          <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" />
          Full activity log <span className="font-normal text-slate-600">· {events.length} entries, for auditors</span>
        </summary>
        <div className="flex h-[480px] flex-col border-t border-slate-100">
          <EventsFeed events={events} onSelectCase={onSelectCase} />
        </div>
      </details>
    </div>
  );
}

function SectionTitle({ icon: Icon, accent, title, sub }: { icon: typeof Brain; accent: string; title: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${accent}`}><Icon aria-hidden className="h-5 w-5" /></span>
      <div>
        <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
        {sub && <p className="text-[13px] text-slate-700">{sub}</p>}
      </div>
    </div>
  );
}

function ColorCard({ icon, title, tone, accent, children }: { icon: typeof Brain; title: string; tone: string; accent: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl p-5 ring-1 ${tone}`}>
      <SectionTitle icon={icon} accent={accent} title={title} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Must always end with a person (blueprint: missing document, ambiguous match, conflicts). */
const MUST_ESCALATE = new Set(["AMBIGUOUS_MATCH", "MISSING_INVOICE", "MISSING_SETTLEMENT", "DUPLICATE_SETTLEMENT", "INVOICE_MISMATCH"]);
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

/** Blueprint section 20 metrics, explained in plain words and measured on this batch only. */
function Accuracy({ metrics, cases }: { metrics: Metrics | null; cases: CaseSummary[] }) {
  const [details, setDetails] = useState<CaseDetail[] | null>(null);
  const key = cases.map((c) => `${c.id}:${c.status}:${c.investigationStatus}`).join(",");

  useEffect(() => {
    if (!cases.length) return;
    let live = true;
    Promise.all(cases.map((c) => api.getCase(c.id))).then((d) => live && setDetails(d)).catch(() => live && setDetails(null));
    return () => { live = false; };
  }, [key]);

  const q = useMemo(() => {
    if (!details) return null;
    const proven = details.filter((d) => d.evidence.length > 0 && d.appliedRules.length > 0).length;
    const invented = details.reduce((n, d) => {
      const ids = new Set(d.evidence.map((e) => e.id));
      return n + (d.investigation?.evidenceIds ?? []).filter((id) => !ids.has(id)).length;
    }, 0);
    const risky = details.filter((d) => MUST_ESCALATE.has(d.type));
    return { total: details.length, proven, invented, risky: risky.length, riskyOk: risky.filter((d) => d.status === "REVIEW_REQUIRED").length };
  }, [details]);

  const ev = metrics?.evaluation;
  const truth = !!ev?.available;
  const items: { k: string; v: string | null; hint: string }[] = [
    { k: "Planted problems found", v: truth ? `${ev!.truePositives} of ${ev!.expectedAnomalies}` : "—", hint: truth ? "Recall: nothing was missed" : "Needs the reference test files" },
    { k: "False alarms", v: truth ? String(ev!.detectedAnomalies - ev!.truePositives) : "—", hint: truth ? "Precision: every flag was real" : "Needs the reference test files" },
    { k: "Cases with proof", v: q && pct(q.proven, q.total), hint: "Each one points to the exact record and rule" },
    { k: "Made-up citations", v: q && String(q.invented), hint: "The AI referred to records that don't exist" },
    { k: "Risky cases sent to you", v: q && `${q.riskyOk} of ${q.risky}`, hint: "Missing, unclear or contradicting cases" },
    { k: "Sent to a person", v: metrics ? pct(metrics.reviewRequiredCases, metrics.totalCases) : null, hint: "Of all the cases found" },
  ];

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      <SectionTitle icon={Gauge} accent="bg-slate-700" title="How accurate was it" sub="Measured on this upload only. No estimates." />
      <dl className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {items.map(({ k, v, hint }) => (
          <div key={k} className="rounded-xl bg-slate-50 p-4">
            <dt className="text-[13px] font-medium text-slate-700">{k}</dt>
            <dd className="mt-1">
              {v == null ? <Skeleton className="h-7 w-14" /> : <span className="tabular text-2xl font-semibold text-slate-900">{v}</span>}
              <span className="mt-0.5 block text-[13px] leading-snug text-slate-600">{hint}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
