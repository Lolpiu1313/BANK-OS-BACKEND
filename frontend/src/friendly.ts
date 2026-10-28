// Plain-language layer: turns backend codes into words an operations analyst uses.
// Technical identifiers stay available in "Technical details" sections, never on the first read.
import { Banknote, Copy, FileExclamationPoint, Hourglass, Unlink, type LucideIcon } from "lucide-react";
import type { CaseDetail, CaseSummary, CaseType } from "./api/types";
import { fmtMoney, fmtSigned, label } from "./components/ui";

export type CategoryId = "money" | "unconfirmed" | "invoice" | "linking" | "cleanup";

export interface Category {
  id: CategoryId;
  title: string;
  blurb: string;
  icon: LucideIcon;
  /** Tailwind classes for the category colour (tinted surface, strong accent, text, ring). */
  color: { soft: string; accent: string; text: string; ring: string; ringStrong: string; bar: string };
}

export const CATEGORIES: Category[] = [
  {
    id: "money", title: "Money mismatch", blurb: "Paid twice, or a different amount or currency",
    icon: Banknote,
    color: { soft: "bg-indigo-50", accent: "bg-indigo-600", text: "text-indigo-900", ring: "ring-indigo-200", ringStrong: "ring-indigo-500", bar: "border-l-indigo-500" },
  },
  {
    id: "unconfirmed", title: "Not confirmed", blurb: "No proof the payment was actually completed",
    icon: Hourglass,
    color: { soft: "bg-orange-50", accent: "bg-orange-500", text: "text-orange-900", ring: "ring-orange-200", ringStrong: "ring-orange-500", bar: "border-l-orange-500" },
  },
  {
    id: "invoice", title: "Invoice problem", blurb: "Invoice missing, unreadable or contradicting the payment",
    icon: FileExclamationPoint,
    color: { soft: "bg-fuchsia-50", accent: "bg-fuchsia-600", text: "text-fuchsia-900", ring: "ring-fuchsia-200", ringStrong: "ring-fuchsia-500", bar: "border-l-fuchsia-500" },
  },
  {
    id: "linking", title: "Can't link records", blurb: "A settlement that fits no payment, or more than one",
    icon: Unlink,
    color: { soft: "bg-sky-50", accent: "bg-sky-600", text: "text-sky-900", ring: "ring-sky-200", ringStrong: "ring-sky-500", bar: "border-l-sky-500" },
  },
  {
    id: "cleanup", title: "Data clean-up", blurb: "Duplicate rows in an export; no extra money moved",
    icon: Copy,
    color: { soft: "bg-slate-100", accent: "bg-slate-500", text: "text-slate-800", ring: "ring-slate-200", ringStrong: "ring-slate-500", bar: "border-l-slate-400" },
  },
];

interface TypeInfo { title: string; category: CategoryId; what: string }

export const TYPES: Record<CaseType, TypeInfo> = {
  DUPLICATE_SETTLEMENT: { title: "Paid twice", category: "money", what: "Two separate settlements confirm the same payment." },
  DUPLICATE_PAYMENT: { title: "Payment listed twice", category: "money", what: "The same payment instruction appears twice in the register." },
  AMOUNT_MISMATCH: { title: "Different amount", category: "money", what: "The settled amount differs from the amount requested." },
  CURRENCY_MISMATCH: { title: "Different currency", category: "money", what: "The settlement is in another currency than the payment." },
  MISSING_SETTLEMENT: { title: "Payment not confirmed", category: "unconfirmed", what: "There is no completed settlement for this payment (only pending, reversed or nothing)." },
  MISSING_INVOICE: { title: "Invoice missing", category: "invoice", what: "The supporting invoice is missing, unreadable or could not be verified." },
  INVOICE_MISMATCH: { title: "Invoice doesn't match", category: "invoice", what: "The invoice shows a different amount or reference than the payment." },
  AMBIGUOUS_MATCH: { title: "Can't tell which payment", category: "linking", what: "This settlement fits more than one payment, so it was not matched automatically." },
  UNEXPECTED_SETTLEMENT: { title: "Unknown settlement", category: "linking", what: "Money was settled without a matching payment instruction." },
  REFERENCE_MISMATCH: { title: "Reference doesn't match", category: "linking", what: "The settlement carries a different reference than the payment." },
  EXPORT_DUPLICATE: { title: "Duplicate export row", category: "cleanup", what: "The same settlement row was exported twice. It is not a second payment." },
};

export const typeInfo = (t: CaseType): TypeInfo => TYPES[t] ?? { title: label(t), category: "cleanup", what: "" };
export const categoryOf = (t: CaseType): Category => CATEGORIES.find((c) => c.id === typeInfo(t).category)!;

/** One plain sentence about this specific case, using its own numbers. */
export function explainCase(c: CaseSummary | CaseDetail): string {
  const amt = fmtMoney(c.amount, c.currency);
  const d = "actualAmount" in c ? c : null;
  switch (c.type) {
    case "DUPLICATE_SETTLEMENT":
      return d
        ? `Payment ${c.subjectId} of ${amt} was settled ${d.settlementIds.length === 2 ? "twice" : `${d.settlementIds.length} times`}, so ${fmtMoney(d.actualAmount, c.currency)} went out in total.`
        : `Payment ${c.subjectId} of ${amt} was settled more than once.`;
    case "AMOUNT_MISMATCH":
      return `${amt} was requested, but the settlement differs by ${fmtSigned(c.difference, c.currency)}.`;
    case "CURRENCY_MISMATCH":
      return `${amt} was requested, but it was settled in another currency.`;
    case "MISSING_SETTLEMENT":
      return `Nothing confirms that the ${amt} payment ${c.subjectId} was completed.`;
    case "INVOICE_MISMATCH":
      return c.difference
        ? `The invoice amount is off by ${fmtSigned(c.difference, c.currency)} compared with the ${amt} payment.`
        : `The invoice refers to a different payment reference than ${c.subjectId}.`;
    case "MISSING_INVOICE":
      return `Payment ${c.subjectId} of ${amt} needs an invoice we could not find or read.`;
    case "DUPLICATE_PAYMENT":
      return `Payment ${c.subjectId} of ${amt} appears twice in the payment register.`;
    default:
      return typeInfo(c.type).what;
  }
}

export const sourceName = (source: string) =>
  source === "payments.csv" ? "Payment register" : source === "settlements.csv" ? "Settlement export"
  : source.toLowerCase().endsWith(".pdf") ? `Invoice ${source.replace(/\.pdf$/i, "")}` : source;

export const toolText = (tool: string | null) =>
  tool === "getCaseEvidence" ? "Collected the evidence for this case"
  : tool === "getCasePolicy" ? "Looked up the rule that applies"
  : tool ? `Used ${tool}` : "Wrote its conclusion";

const AUDIT: Record<string, string> = {
  CASE_CREATED: "Case opened by the matching engine",
  POLICY_DECISION: "Rule applied",
  INVESTIGATION_COMPLETED: "AI assistant finished its investigation",
  INVESTIGATION_OFFLINE_FALLBACK: "AI assistant wrote an offline summary",
  INVESTIGATION_FAILED: "AI investigation failed",
  INVESTIGATION_REJECTED: "AI answer rejected by the checks",
  REVIEW_APPROVE: "Approved by a reviewer",
  REVIEW_ESCALATE: "Escalated by a reviewer",
  REVIEW_REJECT: "Finding rejected by a reviewer",
  REVIEW_INVESTIGATING: "Reviewer is looking into it",
};
export const auditText = (action: string) => AUDIT[action] ?? label(action);
