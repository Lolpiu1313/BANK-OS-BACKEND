import type { ReactNode } from "react";
import {
  Ban, CircleAlert, CircleCheck, CircleDashed, CircleDot, CircleQuestionMark, CircleX, Clock, FileSearch, LoaderCircle,
  Search, ShieldAlert, Sparkles, X, type LucideIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------------------------
// Status vocabulary. Every status is shown as colour + icon + plain-language label (WCAG 1.4.1:
// colour is never the only cue). The raw code stays available in the tooltip for traceability.
// ---------------------------------------------------------------------------------------------

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

const toneClass: Record<Tone, string> = {
  success: "bg-teal-50 text-teal-800 ring-teal-600/25",
  warning: "bg-amber-50 text-amber-900 ring-amber-600/30",
  danger: "bg-red-50 text-red-800 ring-red-600/25",
  info: "bg-sky-50 text-sky-800 ring-sky-600/25",
  neutral: "bg-slate-100 text-slate-700 ring-slate-500/20",
  accent: "bg-violet-50 text-violet-800 ring-violet-600/25",
};

interface StatusDef { label: string; tone: Tone; icon: LucideIcon; hint: string }

const STATUS: Record<string, StatusDef> = {
  // Case (policy) status
  REVIEW_REQUIRED: { label: "Needs review", tone: "warning", icon: CircleAlert, hint: "A policy rule requires a human decision." },
  AUTO_MATCHED: { label: "Auto-matched", tone: "success", icon: CircleCheck, hint: "Within policy; no human decision needed." },
  OPEN: { label: "Open", tone: "neutral", icon: CircleDashed, hint: "Not evaluated by the policy engine yet." },
  // AI investigation
  COMPLETED: { label: "AI investigated", tone: "success", icon: Sparkles, hint: "Model investigation with verified evidence citations." },
  OFFLINE_FALLBACK: { label: "Offline summary", tone: "accent", icon: FileSearch, hint: "Deterministic summary, no model call (offline mode)." },
  NOT_RUN: { label: "Not investigated", tone: "neutral", icon: CircleDashed, hint: "Beyond the per-batch investigation budget; can be run on demand." },
  FAILED: { label: "Failed", tone: "danger", icon: CircleX, hint: "The step failed; the case is escalated to review." },
  REJECTED: { label: "Rejected", tone: "danger", icon: Ban, hint: "Output failed verification; the case is escalated to review." },
  // Human review
  PENDING: { label: "Awaiting review", tone: "warning", icon: Clock, hint: "No reviewer decision yet." },
  NOT_REQUIRED: { label: "No review needed", tone: "neutral", icon: CircleDot, hint: "Resolved by policy." },
  INVESTIGATING: { label: "Investigating", tone: "info", icon: Search, hint: "A reviewer is looking into it." },
  APPROVED: { label: "Approved", tone: "success", icon: CircleCheck, hint: "Reviewer approved the proposed disposition." },
  ESCALATED: { label: "Escalated", tone: "danger", icon: ShieldAlert, hint: "Reviewer escalated the case." },
  // Batch
  UPLOADED: { label: "Uploaded", tone: "neutral", icon: CircleDot, hint: "Files stored, not processed yet." },
  PARSING: { label: "Reading files", tone: "info", icon: LoaderCircle, hint: "" },
  RECONCILING: { label: "Reconciling", tone: "info", icon: LoaderCircle, hint: "" },
  APPLYING_POLICY: { label: "Applying policy", tone: "info", icon: LoaderCircle, hint: "" },
  READY_FOR_REVIEW: { label: "Ready for review", tone: "success", icon: CircleCheck, hint: "Processing finished." },
  // Agent executions
  SUCCEEDED: { label: "Succeeded", tone: "success", icon: CircleCheck, hint: "" },
  SKIPPED: { label: "Skipped", tone: "warning", icon: CircleAlert, hint: "Handled: routed to manual review." },
  // Invoice extraction
  VERIFIED: { label: "Verified", tone: "success", icon: CircleCheck, hint: "Every extracted field was found on the page." },
  UNREADABLE: { label: "Unreadable", tone: "warning", icon: CircleAlert, hint: "No text layer (scan); manual review required." },
};

/** Reviewer decision "REJECTED" means "finding rejected", not an error. */
const REVIEW_OVERRIDES: Record<string, StatusDef> = {
  REJECTED: { label: "Finding rejected", tone: "neutral", icon: Ban, hint: "Reviewer judged the finding not to be a problem." },
};

export function statusDef(value: string, kind?: "review"): StatusDef {
  return (kind === "review" && REVIEW_OVERRIDES[value]) || STATUS[value]
    || { label: label(value), tone: "neutral", icon: CircleQuestionMark, hint: "" };
}

export function StatusTag({ value, kind, size = "md" }: { value: string | null | undefined; kind?: "review"; size?: "sm" | "md" }) {
  if (!value) return <span className="text-slate-500">—</span>;
  const d = statusDef(value, kind);
  const Icon = d.icon;
  const spin = Icon === LoaderCircle;
  return (
    <span
      title={`${d.hint ? `${d.hint} ` : ""}(${value})`}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${toneClass[d.tone]} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-[13px]"
      }`}
    >
      <Icon aria-hidden className={`${size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0 ${spin ? "animate-spin" : ""}`} />
      {d.label}
    </span>
  );
}

/** Plain status text with a small icon, for secondary statuses (keeps the number of tags per row low). */
export function StatusText({ value, kind }: { value: string | null | undefined; kind?: "review" }) {
  if (!value) return <span className="text-slate-500">—</span>;
  const d = statusDef(value, kind);
  const Icon = d.icon;
  const color = { success: "text-teal-700", warning: "text-amber-700", danger: "text-red-700", info: "text-sky-700", neutral: "text-slate-500", accent: "text-violet-700" }[d.tone];
  return (
    <span title={`${d.hint ? `${d.hint} ` : ""}(${value})`} className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] text-slate-600">
      <Icon aria-hidden className={`h-3.5 w-3.5 ${color}`} />
      {d.label}
    </span>
  );
}

/** Neutral label chip (case types, rule IDs, versions). */
export function Chip({ children, title, mono }: { children: ReactNode; title?: string; mono?: boolean }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ${mono ? "mono" : ""}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------------------------

export function Card({ title, description, actions, children, className = "" }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

/** Buttons are at least 32px tall (WCAG 2.5.8 asks for 24px). */
export function Button({ variant = "secondary", size = "md", className = "", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-navy-900 text-white shadow-sm hover:bg-navy-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none",
    secondary: "bg-white text-slate-800 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400 disabled:shadow-none",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-300",
    danger: "bg-red-700 text-white shadow-sm hover:bg-red-800 disabled:bg-slate-300",
  }[variant];
  const sizes = { sm: "h-8 px-2.5 text-[13px]", md: "h-9 px-3.5 text-sm", lg: "h-11 px-5 text-[15px]" }[size];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${sizes} ${styles} ${className}`}
    />
  );
}

export function IconButton({ label: text, children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={text}
      title={text}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 ${className}`}
    >
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <LoaderCircle aria-hidden className={`h-4 w-4 animate-spin ${className}`} />;
}

/** Error with a plain-language title, the cause, and (when possible) a way out (NN/g heuristic 9). */
export function Alert({ title, message, onClose, tone = "danger" }: { title: string; message?: ReactNode; onClose?: () => void; tone?: "danger" | "warning" | "info" }) {
  const styles = {
    danger: "border-red-200 bg-red-50 text-red-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  }[tone];
  const Icon = tone === "danger" ? CircleX : tone === "warning" ? CircleAlert : CircleQuestionMark;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${styles}`}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {message && <div className="mt-0.5 opacity-90">{message}</div>}
      </div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" className="-m-1 rounded p-1 opacity-70 hover:opacity-100">
          <X aria-hidden className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Empty state: what is going on, why, and a direct path forward (NN/g empty-state guidelines). */
export function EmptyState({ icon: Icon = CircleDashed, title, children, action }: {
  icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon aria-hidden className="h-5 w-5" />
      </span>
      <p className="mt-3 font-medium text-slate-900">{title}</p>
      {children && <div className="mt-1 max-w-sm text-[13px] text-slate-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded bg-slate-200/80 ${className}`} />;
}

// ---------------------------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------------------------

export const fmtMoney = (amount: number | null | undefined, currency?: string | null) =>
  amount == null
    ? "—"
    : `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;

export const fmtSigned = (amount: number | null | undefined, currency?: string | null) =>
  amount == null || amount === 0 ? "—" : `${amount > 0 ? "+" : "−"}${fmtMoney(Math.abs(amount), currency)}`;

export const fmtTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtMs = (ms: number | null | undefined) =>
  ms == null ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

/** SNAKE_CASE code → "Sentence case" label. */
export const label = (s: string) => s.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
