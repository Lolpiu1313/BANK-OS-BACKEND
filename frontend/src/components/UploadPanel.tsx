import { useRef, useState } from "react";
import { ArrowRight, Check, FileSpreadsheet, FileText, Upload, X, type LucideIcon } from "lucide-react";
import { api, errorMessage } from "../api/client";
import type { Batch } from "../api/types";
import { Alert, Button, Spinner } from "./ui";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** Start screen: the three inputs. Uploading also starts the analysis. */
export function UploadPanel({ onCreated }: { onCreated: (batch: Batch) => void }) {
  const [payments, setPayments] = useState<File | null>(null);
  const [settlements, setSettlements] = useState<File | null>(null);
  const [invoices, setInvoices] = useState<File[]>([]);
  const [phase, setPhase] = useState<"idle" | "uploading" | "starting">("idle");
  const [error, setError] = useState<string | null>(null);

  const ready = !!payments && !!settlements;
  const busy = phase !== "idle";

  const submit = async () => {
    if (!payments || !settlements) return;
    setError(null);
    try {
      setPhase("uploading");
      const uploaded = await api.uploadBatch(payments, settlements, invoices);
      setPhase("starting");
      onCreated(await api.processBatch(uploaded.id));
    } catch (e) {
      setError(errorMessage(e));
      setPhase("idle");
    }
  };

  const fileCount = (payments ? 1 : 0) + (settlements ? 1 : 0) + invoices.length;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Check your payments</h1>
        <p className="mx-auto mt-2 max-w-xl text-[15px] text-slate-600">
          Add three things below. We compare them, find anything that doesn't add up, and show you only the
          cases that need your decision.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FileInput
          icon={FileSpreadsheet}
          title="Payments"
          description="The payments you asked the bank to make."
          format="A spreadsheet file (.csv), e.g. payments.csv"
          tint={TINTS.indigo}
          accept=".csv"
          files={payments ? [payments] : []}
          onChange={(f) => setPayments(f[0] ?? null)}
          required
          disabled={busy}
        />
        <FileInput
          icon={FileSpreadsheet}
          title="Settlements"
          description="What the bank actually paid out."
          format="A spreadsheet file (.csv), e.g. settlements.csv"
          tint={TINTS.sky}
          accept=".csv"
          files={settlements ? [settlements] : []}
          onChange={(f) => setSettlements(f[0] ?? null)}
          required
          disabled={busy}
        />
        <FileInput
          icon={FileText}
          title="Invoices"
          description="The bills that justify each payment."
          format="PDF files, select several at once"
          tint={TINTS.fuchsia}
          accept=".pdf"
          multiple
          files={invoices}
          onChange={setInvoices}
          disabled={busy}
        />
      </div>

      {error && (
        <div className="mt-5">
          <Alert title="The files could not be uploaded" message={error} onClose={() => setError(null)} />
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-2">
        <Button variant="primary" size="lg" disabled={!ready || busy} onClick={submit} className="min-w-56">
          {busy ? <Spinner /> : <Upload aria-hidden className="h-4 w-4" />}
          {phase === "uploading" ? `Uploading ${fileCount} files…` : phase === "starting" ? "Starting the check…" : "Check my payments"}
        </Button>
        <p className="text-[13px] text-slate-500" aria-live="polite">
          {!ready ? "Add the payments and settlements to continue." : invoices.length === 0
            ? "Invoices are optional, but payments that need one will come back to you."
            : `${fileCount} files ready. The check takes a few seconds.`}
        </p>
      </div>

      <ol className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[13px] text-slate-500">
        {["Add your files", "We compare everything and the AI investigates", "You decide on what's left"].map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">{i + 1}</span>
              {s}
            </span>
            {i < 2 && <ArrowRight aria-hidden className="h-4 w-4 text-slate-300" />}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-center text-[13px] text-slate-500">
        Need test files? Use the <span className="font-medium">synthetic-data</span> folder in the project.
      </p>
    </div>
  );
}

const TINTS = {
  indigo: { card: "bg-indigo-50 ring-indigo-200", icon: "bg-indigo-600", zone: "border-indigo-200 bg-white/70" },
  sky: { card: "bg-sky-50 ring-sky-200", icon: "bg-sky-600", zone: "border-sky-200 bg-white/70" },
  fuchsia: { card: "bg-fuchsia-50 ring-fuchsia-200", icon: "bg-fuchsia-600", zone: "border-fuchsia-200 bg-white/70" },
};
type Tint = (typeof TINTS)[keyof typeof TINTS];

function FileInput({ icon: Icon, title, description, format, accept, multiple, files, onChange, required, disabled, tint }: {
  icon: LucideIcon; title: string; description: string; format: string; accept: string; multiple?: boolean;
  files: File[]; onChange: (files: File[]) => void; required?: boolean; disabled?: boolean; tint: Tint;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const id = `file-${title.toLowerCase()}`;

  const pick = (list: FileList | null) => {
    const all = Array.from(list ?? []);
    if (!all.length) return;
    const wrongType = all.filter((f) => !f.name.toLowerCase().endsWith(accept));
    const tooBig = all.filter((f) => f.size > MAX_FILE_BYTES);
    const good = all.filter((f) => !wrongType.includes(f) && !tooBig.includes(f));
    setProblem(
      wrongType.length ? `${wrongType.map((f) => f.name).join(", ")} ${wrongType.length > 1 ? "are not" : "is not"} a ${accept.slice(1).toUpperCase()} file.`
      : tooBig.length ? `${tooBig.map((f) => f.name).join(", ")} is larger than 10 MB.`
      : null,
    );
    if (good.length) onChange(multiple ? good : good.slice(0, 1));
  };

  const has = files.length > 0;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) pick(e.dataTransfer.files); }}
      className={`flex flex-col rounded-2xl p-5 ring-1 transition ${tint.card} ${
        problem ? "ring-2 ring-red-400" : over ? "ring-2 ring-teal-500" : has ? "ring-2 ring-teal-500" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${has ? "bg-teal-600" : tint.icon}`}>
          {has ? <Check aria-hidden className="h-6 w-6" /> : <Icon aria-hidden className="h-6 w-6" />}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="font-semibold text-slate-900">
            {title} {required ? <span className="sr-only">(required)</span> : <span className="text-[13px] font-normal text-slate-700">· optional</span>}
          </h2>
          <p className="text-[13px] text-slate-600">{description}</p>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-slate-600">{format}</p>

      <div className={`mt-4 flex min-h-28 flex-1 flex-col justify-center rounded-lg border-2 border-dashed p-3 ${
        over ? "border-teal-500 bg-teal-50/50" : tint.zone
      }`}>
        {has ? (
          <ul className="space-y-1.5" aria-labelledby={id}>
            {files.slice(0, 4).map((f) => (
              <li key={f.name} className="flex items-center gap-2 text-[13px]">
                <FileText aria-hidden className="h-4 w-4 shrink-0 text-teal-700" />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={f.name}>{f.name}</span>
                <span className="tabular shrink-0 text-xs text-slate-500">{fmtSize(f.size)}</span>
              </li>
            ))}
            {files.length > 4 && <li className="text-xs text-slate-500">and {files.length - 4} more</li>}
          </ul>
        ) : (
          <p className="text-center text-[13px] text-slate-500">Drag {multiple ? "files" : "the file"} here or</p>
        )}
        <div className="mt-2 flex items-center justify-center gap-2">
          <Button size="sm" disabled={disabled} onClick={() => input.current?.click()} aria-describedby={id}>
            {has ? "Replace" : multiple ? "Choose files" : "Choose file"}
          </Button>
          {has && (
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => { onChange([]); setProblem(null); }}>
              <X aria-hidden className="h-4 w-4" /> Remove
            </Button>
          )}
        </div>
      </div>
      {problem && <p role="alert" className="mt-2 text-[13px] text-red-700">{problem}</p>}

      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(e) => { pick(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}
