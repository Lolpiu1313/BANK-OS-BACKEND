import { useCallback, useEffect, useState } from "react";
import { Brain, ClipboardList, FlaskConical, Upload } from "lucide-react";
import { api, errorMessage } from "./api/client";
import type { Batch, BatchEvent, CaseSummary, InvoiceInfo, Metrics, Policy, SystemInfo } from "./api/types";
import { CaseDrawer } from "./components/CaseDrawer";
import { CaseBoard, type Queue } from "./components/CaseBoard";
import { ResultsOverview } from "./components/ResultsOverview";
import { Pipeline } from "./components/Pipeline";
import { ReplayModal } from "./components/ReplayModal";
import { SystemView } from "./components/SystemView";
import { UploadPanel } from "./components/UploadPanel";
import type { CategoryId } from "./friendly";
import { Alert, Button, Card, fmtDateTime } from "./components/ui";

const RUNNING = new Set(["UPLOADED", "PARSING", "RECONCILING", "INVESTIGATING", "APPLYING_POLICY"]);

type Tab = "analysis" | "system";

export default function App() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [tab, setTab] = useState<Tab>("analysis");
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [casesLoaded, setCasesLoaded] = useState(false);
  const [events, setEvents] = useState<BatchEvent[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [invoices, setInvoices] = useState<InvoiceInfo[]>([]);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [systemFailed, setSystemFailed] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [queue, setQueue] = useState<Queue>("decide");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [showReplay, setShowReplay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const batchId = batch?.id ?? null;
  const running = batch ? RUNNING.has(batch.status) : false;

  const checkHealth = useCallback(() => {
    api.health().then(() => setHealthy(true)).catch(() => setHealthy(false));
  }, []);

  const loadBatchData = useCallback(async (id: string) => {
    try {
      const [b, c, e] = await Promise.all([api.getBatch(id), api.listCases({ batchId: id }), api.batchEvents(id)]);
      setBatch(b);
      setCases(c);
      setEvents(e);
      if (!RUNNING.has(b.status)) {
        setCasesLoaded(true);
        api.metrics(id).then(setMetrics).catch(() => setMetrics(null));
        api.batchInvoices(id).then(setInvoices).catch(() => setInvoices([]));
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => { checkHealth(); }, [checkHealth]);

  // Static backend info is (re)loaded whenever the backend is reachable and it is still missing,
  // so a page opened while the backend was restarting recovers on its own.
  const loadSystem = useCallback(() => {
    setSystemFailed(false);
    api.system().then(setSystem).catch(() => setSystemFailed(true));
    api.listPolicies().then(setPolicies).catch(() => {});
  }, []);

  useEffect(() => {
    if (healthy && !system) loadSystem();
  }, [healthy, system, tab, loadSystem]);

  // Poll while the pipeline runs in the background.
  useEffect(() => {
    if (!batchId || !running) return;
    const t = setInterval(() => loadBatchData(batchId), 1000);
    return () => clearInterval(t);
  }, [batchId, running, loadBatchData]);

  useEffect(() => {
    if (healthy !== false) return;
    const t = setInterval(checkHealth, 3000);
    return () => clearInterval(t);
  }, [healthy, checkHealth]);

  const startOver = () => {
    setBatch(null);
    setCases([]);
    setCasesLoaded(false);
    setEvents([]);
    setMetrics(null);
    setInvoices([]);
    setSelectedCase(null);
    setQueue("decide");
    setCategory(null);
    setTab("analysis");
  };

  const closeCase = useCallback(() => setSelectedCase(null), []);
  const closeReplay = useCallback(() => setShowReplay(false), []);

  const batchPolicy = policies.find((p) => p.version === batch?.policyVersion)
    ?? policies.reduce<Policy | null>((a, p) => (!a || p.version > a.version ? p : a), null);

  return (
    <div className="flex min-h-full flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow">
        Skip to content
      </a>
      <header className="bg-navy-950 text-white">
        <div className="flex h-14 items-center gap-4 px-6">
          <button onClick={startOver} className="flex items-baseline gap-2.5 rounded" aria-label="BANK//OS home: new upload">
            <span className="text-lg font-bold tracking-tight">BANK<span className="text-teal-400">//</span>OS</span>
            <span className="hidden text-[13px] text-slate-400 sm:inline">Payment exception investigator</span>
          </button>
          <div className="ml-auto flex items-center gap-4 text-[13px]">
            <span className="hidden text-slate-300 md:inline">
              Test data only · AI {system ? (system.aiMode === "LIVE" ? "live" : "offline") : "…"} · never moves money
            </span>
            <span className="flex items-center gap-2" role="status">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${healthy ? "bg-teal-400" : healthy === false ? "bg-red-500" : "bg-slate-500"}`} />
              {healthy ? "Connected" : healthy === false ? "Backend offline" : "Connecting…"}
            </span>
          </div>
        </div>
      </header>

      {healthy === false && (
        <div className="px-6 pt-4">
          <Alert
            title="The backend is not reachable"
            message={<>Start it with <span className="mono">cd backend && ./mvnw spring-boot:run</span>. This page retries every few seconds.</>}
          />
        </div>
      )}

      {!batch ? (
        <main id="main" className="flex flex-1 items-center justify-center px-6 py-12">
          <UploadPanel onCreated={(b) => { setBatch(b); loadBatchData(b.id); }} />
        </main>
      ) : (
        <>
          <div className="border-b border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 pt-4">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-slate-900">Upload {batch.id.replace(/^B0*/, "#")}</h1>
                <p className="mt-0.5 text-[13px] text-slate-600">
                  {batch.totals.payments || "…"} payments · {batch.totals.settlements || "…"} settlements · {batch.totals.invoices} invoices
                  {batch.processedAt && ` · checked ${fmtDateTime(batch.processedAt)}`}
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                <Button onClick={() => setShowReplay(true)} disabled={!cases.length || running}>
                  <FlaskConical aria-hidden className="h-4 w-4" /> What if the rules changed?
                </Button>
                <Button onClick={startOver}>
                  <Upload aria-hidden className="h-4 w-4" /> New upload
                </Button>
              </div>
            </div>
            <nav role="tablist" aria-label="Batch views" className="mt-3 flex gap-1 px-6">
              {([["analysis", "Results", ClipboardList], ["system", "Behind the scenes", Brain]] as const).map(([id, text, Icon]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm ${
                    tab === id ? "border-slate-900 font-semibold text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon aria-hidden className="h-4 w-4" /> {text}
                </button>
              ))}
            </nav>
          </div>

          <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 space-y-5 px-6 py-6">
            {error && <Alert title="Could not refresh the batch" message={error} onClose={() => setError(null)} />}
            {(running || batch.status === "FAILED") && (
              <Card><div className="px-5 py-4"><Pipeline status={batch.status} error={batch.error} startedAt={batch.createdAt} /></div></Card>
            )}
            {tab === "analysis" ? (
              <>
                <ResultsOverview batch={batch} cases={cases} metrics={metrics} loading={running}
                                 category={category} onCategory={(c) => { setCategory(c); if (c) setQueue("all"); }} />
                <CaseBoard
                  cases={cases}
                  loading={!casesLoaded}
                  queue={queue}
                  onQueue={setQueue}
                  category={category}
                  onCategory={setCategory}
                  onOpen={setSelectedCase}
                />
              </>
            ) : (
              <SystemView
                batchId={batch.id}
                system={system}
                systemFailed={systemFailed}
                onRetrySystem={loadSystem}
                metrics={metrics}
                events={events}
                invoices={invoices}
                cases={cases}
                onSelectCase={setSelectedCase}
              />
            )}
          </main>
        </>
      )}

      {selectedCase && <CaseDrawer caseId={selectedCase} onClose={closeCase} onChanged={() => batchId && loadBatchData(batchId)} />}
      {showReplay && batch && (
        <ReplayModal
          batchId={batch.id}
          policy={batchPolicy}
          onClose={closeReplay}
          onDone={() => api.listPolicies().then(setPolicies).catch(() => {})}
        />
      )}
    </div>
  );
}
