import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet, FileText, Gavel, Lightbulb, RotateCcw, Sparkles, X } from "lucide-react";
import { api, errorMessage } from "../api/client";
import type { CaseDetail, ReviewDecision } from "../api/types";
import { auditText, categoryOf, explainCase, sourceName, toolText, typeInfo } from "../friendly";
import { EvidenceGraph } from "./EvidenceGraph";
import { PdfViewer } from "./PdfViewer";
import { Alert, Button, EmptyState, IconButton, Skeleton, Spinner, StatusTag, StatusText, fmtDateTime, fmtMoney, fmtSigned, fmtTime } from "./ui";

type Tab = "summary" | "proof" | "links" | "ai" | "history";

export function CaseDrawer({ caseId, onClose, onChanged }: { caseId: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [error, setError] = useState<string | null>(null);
  const [investigating, setInvestigating] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api.getCase(caseId).then(setDetail).catch((e) => setError(errorMessage(e)));
  }, [caseId]);

  useEffect(() => {
    setDetail(null);
    setError(null);
    setTab("summary");
    load();
  }, [load]);

  // Dialog behaviour: focus moves into the panel, Escape closes, focus returns to where it was.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const reinvestigate = async () => {
    setInvestigating(true);
    setError(null);
    try {
      setDetail(await api.investigate(caseId));
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setInvestigating(false);
    }
  };

  const cat = detail ? categoryOf(detail.type) : null;
  const CatIcon = cat?.icon;
  const tabs: [Tab, string, number?][] = [
    ["summary", "Summary"],
    ["proof", "Proof", detail?.evidence.length],
    ["links", "Connections"],
    ["ai", "AI steps", detail?.agentTrace.length],
    ["history", "History", detail?.auditTrail.length],
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-title"
        tabIndex={-1}
        className="flex h-full w-full max-w-3xl flex-col bg-slate-50 shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={`border-b border-slate-200 px-6 pt-5 ${cat ? cat.color.soft : "bg-white"}`}>
          <div className="flex items-start gap-4">
            {cat && CatIcon ? (
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${cat.color.accent}`}>
                <CatIcon aria-hidden className="h-6 w-6" />
              </span>
            ) : <Skeleton className="h-11 w-11 rounded-xl" />}
            <div className="min-w-0 flex-1">
              {detail && cat ? (
                <>
                  <p className={`text-[13px] font-medium ${cat.color.text}`}>{cat.title}</p>
                  <h2 id="case-title" className="text-xl font-semibold text-slate-900">{typeInfo(detail.type).title}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusTag value={detail.status} />
                    {detail.review && detail.review.status !== "NOT_REQUIRED" && <StatusText value={detail.review.status} kind="review" />}
                    <span className="text-[13px] text-slate-600">Payment {detail.subjectId}</span>
                  </div>
                </>
              ) : (
                <h2 id="case-title"><Skeleton className="h-6 w-56" /></h2>
              )}
            </div>
            <Button size="sm" onClick={reinvestigate} disabled={investigating || !detail} title="Ask the AI assistant to look at this case again">
              {investigating ? <Spinner /> : <RotateCcw aria-hidden className="h-4 w-4" />} Ask AI again
            </Button>
            <IconButton label="Close (Esc)" onClick={onClose}><X aria-hidden className="h-5 w-5" /></IconButton>
          </div>
          <nav role="tablist" aria-label="Case sections" className="mt-4 flex gap-1 overflow-x-auto">
            {tabs.map(([id, text, count]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`-mb-px whitespace-nowrap rounded-t-lg border-b-2 px-3 pb-2.5 pt-1.5 text-sm ${
                  tab === id ? "border-slate-900 bg-slate-50 font-medium text-slate-900" : "border-transparent text-slate-700 hover:text-slate-900"
                }`}
              >
                {text}
                {count != null && <span className="tabular ml-1.5 rounded-full bg-white/80 px-1.5 text-xs text-slate-700">{count}</span>}
              </button>
            ))}
          </nav>
        </header>

        <div role="tabpanel" className="flex-1 overflow-auto px-6 py-5">
          {error && <div className="mb-4"><Alert title="Something went wrong with this case" message={error} onClose={() => setError(null)} /></div>}
          {!detail ? (
            !error && <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
          ) : (
            <>
              {tab === "summary" && <Summary detail={detail} onShowProof={() => setTab("proof")} />}
              {tab === "proof" && <Proof detail={detail} />}
              {tab === "links" && <EvidenceGraph detail={detail} />}
              {tab === "ai" && <AiSteps detail={detail} />}
              {tab === "history" && <History detail={detail} />}
            </>
          )}
        </div>

        {detail && <ReviewBar detail={detail} onReviewed={() => { load(); onChanged(); }} />}
      </div>
    </div>
  );
}

function Panel({ icon: Icon, title, tone, children }: {
  icon: typeof Gavel; title: string; tone: string; children: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl p-5 ring-1 ${tone}`}>
      <h3 className="flex items-center gap-2 font-semibold text-slate-900">
        <Icon aria-hidden className="h-5 w-5" /> {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Money({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${strong ? "bg-white shadow-sm ring-1 ring-slate-200" : "bg-white/70"}`}>
      <p className="text-[13px] text-slate-600">{k}</p>
      <p className="tabular mt-0.5 text-lg font-semibold text-slate-900">{v}</p>
    </div>
  );
}

function Summary({ detail, onShowProof }: { detail: CaseDetail; onShowProof: () => void }) {
  const cat = categoryOf(detail.type);
  const inv = detail.investigation;
  const review = detail.status === "REVIEW_REQUIRED";
  const showMoney = detail.amount != null;
  return (
    <div className="space-y-4">
      <Panel icon={cat.icon} title="What happened" tone={`${cat.color.soft} ${cat.color.ring}`}>
        <p className="text-[15px] leading-relaxed text-slate-800">{explainCase(detail)}</p>
        <p className="mt-1 text-[13px] text-slate-600">{typeInfo(detail.type).what}</p>
        {showMoney && (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Money k="Requested" v={fmtMoney(detail.amount, detail.currency)} />
            <Money k="Actually settled" v={fmtMoney(detail.actualAmount, detail.currency)} />
            <Money k="Difference" v={fmtSigned(detail.difference, detail.currency)} strong={!!detail.difference} />
          </div>
        )}
        <p className="mt-3 text-[13px] text-slate-600">
          Involves payment <b className="font-medium text-slate-800">{detail.paymentId ?? "—"}</b>
          {detail.settlementIds.length > 0 && <>, settlement{detail.settlementIds.length > 1 ? "s" : ""} <b className="font-medium text-slate-800">{detail.settlementIds.join(" and ")}</b></>}
          {detail.invoiceNumber && <>, invoice <b className="font-medium text-slate-800">{detail.invoiceNumber}</b></>}.{" "}
          <button onClick={onShowProof} className="rounded font-medium text-teal-800 hover:underline">See the proof</button>
        </p>
      </Panel>

      <Panel icon={Gavel} title={review ? "Why you need to decide" : "Why it was settled automatically"}
             tone={review ? "bg-amber-50 ring-amber-200" : "bg-teal-50 ring-teal-200"}>
        <p className="text-[15px] leading-relaxed text-slate-800">{detail.decisionReason ?? "No rule was applied yet."}</p>
        <p className="mt-1 text-[13px] text-slate-600">Decided by the bank's rules, not by the AI.</p>
      </Panel>

      <Panel icon={Lightbulb} title="What the AI assistant thinks" tone="bg-violet-50 ring-violet-200">
        {!inv ? (
          <p className="text-slate-700">The assistant has not looked at this case yet. Use “Ask AI again”.</p>
        ) : inv.status === "FAILED" || inv.status === "REJECTED" ? (
          <p className="text-slate-800">The assistant could not give a reliable answer, so this case was sent to a person to be safe.</p>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-slate-800">{inv.possibleCause ?? "No likely cause given."}</p>
            <p className="mt-1 text-[13px] text-slate-600">
              {inv.requiresHumanReview ? "It recommends that a person decides. " : ""}
              It checked {inv.evidenceIds.length} piece{inv.evidenceIds.length === 1 ? "" : "s"} of proof.
              {inv.status === "OFFLINE_FALLBACK" && " (Offline mode: written by fixed rules, without an AI model.)"}
            </p>
          </>
        )}
      </Panel>

      <details className="group rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-slate-700">
          <ChevronDown aria-hidden className="h-4 w-4 transition-transform group-open:rotate-180" /> Technical details
        </summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-[160px_1fr]">
          <dt className="text-slate-600">Case ID</dt><dd className="mono text-slate-900">{detail.id}</dd>
          <dt className="text-slate-600">Type code</dt><dd className="mono text-slate-900">{detail.type}</dd>
          <dt className="text-slate-600">Policy</dt><dd className="text-slate-900">version {detail.policyVersion} · <span className="mono">{detail.appliedRules.join(", ")}</span></dd>
          <dt className="text-slate-600">Reference</dt><dd className="mono text-slate-900">{detail.reference ?? "—"}</dd>
          <dt className="text-slate-600">Engine finding</dt><dd className="text-slate-900">{detail.description}</dd>
          {inv && <><dt className="text-slate-600">AI status</dt><dd className="text-slate-900"><StatusText value={inv.status} /> {fmtDateTime(inv.investigatedAt)}</dd></>}
          {inv?.summary && <><dt className="text-slate-600">AI summary</dt><dd className="text-slate-900">{inv.summary}</dd></>}
          {inv && inv.evidenceIds.length > 0 && <><dt className="text-slate-600">Cited evidence</dt><dd className="mono text-slate-900">{inv.evidenceIds.join(", ")}</dd></>}
          {inv?.error && <><dt className="text-slate-600">AI error</dt><dd className="text-red-700">{inv.error}</dd></>}
        </dl>
      </details>
    </div>
  );
}

const DECISIONS: { value: ReviewDecision; text: string; help: string; variant: "primary" | "secondary" | "danger" }[] = [
  { value: "APPROVE", text: "Approve", help: "I agree with this finding and its handling.", variant: "primary" },
  { value: "ESCALATE", text: "Escalate", help: "This needs someone more senior.", variant: "danger" },
  { value: "INVESTIGATING", text: "Still checking", help: "I'm looking into it.", variant: "secondary" },
  { value: "REJECT", text: "Not a problem", help: "The finding is wrong; nothing to fix.", variant: "secondary" },
];

/** Always-visible decision bar. Decisions cannot be undone, so each one is confirmed first. */
function ReviewBar({ detail, onReviewed }: { detail: CaseDetail; onReviewed: () => void }) {
  const [actor, setActor] = useState(() => {
    try { return localStorage.getItem("bankos.actor") ?? ""; } catch { return ""; }
  });
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<(typeof DECISIONS)[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { setPending(null); setDone(null); setError(null); }, [detail.id]);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      try { localStorage.setItem("bankos.actor", actor.trim()); } catch { /* storage unavailable */ }
      await api.review(detail.id, actor.trim(), pending.value, note.trim());
      setDone(`Saved: “${pending.text}”.`);
      setNote("");
      setPending(null);
      onReviewed();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-4">
      {pending ? (
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-300" role="alertdialog" aria-labelledby="confirm-title">
          <p id="confirm-title" className="font-semibold text-slate-900">“{pending.text}” for payment {detail.subjectId}?</p>
          <p className="mt-1 text-[13px] text-slate-600">
            Saved under the name <b>{actor.trim()}</b> in the case history, permanently. No money is moved.
            {note.trim() && <> Note: “{note.trim()}”</>}
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant={pending.variant === "danger" ? "danger" : "primary"} onClick={confirm} disabled={busy} autoFocus>
              {busy && <Spinner />} Yes, save it
            </Button>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>Go back</Button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="font-semibold text-slate-900">Your decision</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-[200px_1fr]">
            <label className="block">
              <span className="sr-only">Your name</span>
              <input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Your name" autoComplete="name"
                     className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-500" />
            </label>
            <label className="block">
              <span className="sr-only">Note (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, optional: what did you check?"
                     className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-500" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {DECISIONS.map((d) => (
              <Button key={d.value} variant={d.variant} size="sm" title={d.help} disabled={!actor.trim()}
                      onClick={() => { setDone(null); setPending(d); }}>
                {d.text}
              </Button>
            ))}
            <span className="text-[13px] text-slate-600" aria-live="polite">
              {!actor.trim() ? "Type your name first." : done ?? (detail.review?.reviewedBy
                ? `Last decision by ${detail.review.reviewedBy}, ${fmtDateTime(detail.review.reviewedAt)}.` : "")}
            </span>
          </div>
        </>
      )}
      {error && <div className="mt-3"><Alert title="Your decision was not saved" message={error} onClose={() => setError(null)} /></div>}
    </footer>
  );
}

function Proof({ detail }: { detail: CaseDetail }) {
  const cited = new Set(detail.investigation?.evidenceIds ?? []);
  const [pdf, setPdf] = useState<{ file: string; page: number | null } | null>(null);
  if (!detail.evidence.length) return <EmptyState title="No proof attached">This case has no linked records.</EmptyState>;
  return (
    <>
      {pdf && <PdfViewer batchId={detail.batchId} file={pdf.file} page={pdf.page} onClose={() => setPdf(null)} />}
      <p className="mb-3 text-[13px] text-slate-600">The original records behind this case, and exactly where to find them.</p>
      <ul className="space-y-3">
        {detail.evidence.map((e) => {
          const isPdf = e.source.toLowerCase().endsWith(".pdf");
          const Icon = isPdf ? FileText : FileSpreadsheet;
          return (
            <li key={e.id} title={e.id}
                className={`flex items-start gap-3 rounded-2xl p-4 ring-1 ${isPdf ? "bg-fuchsia-50 ring-fuchsia-200" : "bg-white ring-slate-200"}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${isPdf ? "bg-fuchsia-600" : "bg-slate-600"}`}>
                <Icon aria-hidden className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {sourceName(e.source)}
                  <span className="ml-2 font-normal text-slate-600">{e.row != null ? `line ${e.row}` : e.page != null ? `page ${e.page}` : ""}</span>
                </p>
                <p className="mt-1 break-words text-[13px] text-slate-800">{e.value?.split(" | ").join(" · ")}</p>
                {cited.has(e.id) && (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                    <Sparkles aria-hidden className="h-3 w-3" /> Used by the AI assistant
                  </p>
                )}
              </div>
              {isPdf && <Button size="sm" onClick={() => setPdf({ file: e.source, page: e.page })}>View invoice</Button>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function AiSteps({ detail }: { detail: CaseDetail }) {
  if (!detail.agentTrace.length) return <EmptyState title="The AI assistant hasn't worked on this case">Use “Ask AI again” to start it.</EmptyState>;
  // Tool calls in the order they ran; the conclusion (no tool) comes last.
  const steps = [...detail.agentTrace].sort((a, b) => Number(!a.tool) - Number(!b.tool) || a.startedAt.localeCompare(b.startedAt));
  return (
    <>
      <p className="mb-4 text-[13px] text-slate-600">What the AI assistant did, step by step. It can only read; it cannot change anything.</p>
      <ol className="space-y-3">
        {steps.map((t, i) => (
          <li key={t.id} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
              t.state === "SUCCEEDED" ? "bg-violet-600" : t.state === "FAILED" ? "bg-red-600" : "bg-amber-500"
            }`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 font-medium text-slate-900">
                {toolText(t.tool)} <StatusText value={t.state} />
              </p>
              <details className="group mt-1">
                <summary className="cursor-pointer list-none text-[13px] text-slate-600 hover:text-slate-900">
                  <ChevronDown aria-hidden className="mr-1 inline h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                  Technical details · {fmtTime(t.startedAt)} · {t.durationMs} ms
                </summary>
                <p className="mt-1 text-[13px] text-slate-700">
                  <span className="mono">{t.agent}{t.tool ? ` → ${t.tool}()` : ""}</span>{t.detail ? `: ${t.detail}` : ""}
                </p>
              </details>
              {t.error && <p className="mt-1 text-[13px] text-red-700">{t.error}</p>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function History({ detail }: { detail: CaseDetail }) {
  if (!detail.auditTrail.length) return <EmptyState title="No history yet" />;
  return (
    <>
      <p className="mb-4 text-[13px] text-slate-600">Everything that happened to this case. Entries can never be changed or deleted.</p>
      <ol className="relative ml-3 space-y-4 border-l-2 border-slate-200 pl-6">
        {[...detail.auditTrail].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((a) => (
          <li key={a.id} className="relative">
            <span className={`absolute -left-[33px] top-0.5 h-4 w-4 rounded-full ring-4 ring-slate-50 ${
              a.action.startsWith("REVIEW") ? "bg-teal-600" : a.action.startsWith("INVESTIGATION") ? "bg-violet-500" : "bg-slate-400"
            }`} />
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-slate-900">{auditText(a.action)}</span>
              <span className="text-[13px] text-slate-600">{a.actor} · {fmtDateTime(a.createdAt)}</span>
            </p>
            {a.details && <p className="mt-0.5 text-[13px] text-slate-700">{a.action === "POLICY_DECISION" ? a.details.replace(/^.*\]:\s*/, "") : a.details}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}
