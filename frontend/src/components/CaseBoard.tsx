import { useMemo, useState } from "react";
import { ArrowRight, Search, SearchX, X } from "lucide-react";
import type { CaseSummary } from "../api/types";
import { CATEGORIES, categoryOf, explainCase, typeInfo, type CategoryId } from "../friendly";
import { Button, EmptyState, Skeleton, StatusTag, fmtMoney } from "./ui";

export type Queue = "decide" | "auto" | "all";

const QUEUES: { id: Queue; text: string }[] = [
  { id: "decide", text: "Needs your decision" },
  { id: "auto", text: "Settled automatically" },
  { id: "all", text: "Everything" },
];

/** Cases as cards, grouped into coloured sections by kind of problem. */
export function CaseBoard({ cases, loading, queue, onQueue, category, onCategory, onOpen }: {
  cases: CaseSummary[]; loading: boolean; queue: Queue; onQueue: (q: Queue) => void;
  category: CategoryId | null; onCategory: (c: CategoryId | null) => void; onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const inQueue = (c: CaseSummary) => queue === "all" || (queue === "decide" ? c.status === "REVIEW_REQUIRED" : c.status === "AUTO_MATCHED");
  const counts = useMemo(() => ({
    decide: cases.filter((c) => c.status === "REVIEW_REQUIRED").length,
    auto: cases.filter((c) => c.status === "AUTO_MATCHED").length,
    all: cases.length,
  }), [cases]);

  const visible = cases.filter((c) => {
    const q = query.trim().toLowerCase();
    return inQueue(c) && (!category || categoryOf(c.type).id === category)
      && (!q || `${c.subjectId} ${typeInfo(c.type).title} ${c.description}`.toLowerCase().includes(q));
  });
  const groups = CATEGORIES.map((cat) => ({ cat, items: visible.filter((c) => categoryOf(c.type).id === cat.id) })).filter((g) => g.items.length);
  const filtered = !!category || !!query || queue !== "decide";

  return (
    <section aria-labelledby="queue-title" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
        <h2 id="queue-title" className="mr-2 text-[15px] font-semibold text-slate-900">Cases</h2>
        <div role="radiogroup" aria-label="Which cases" className="flex rounded-xl bg-slate-100 p-1">
          {QUEUES.map((q) => (
            <button
              key={q.id}
              role="radio"
              aria-checked={queue === q.id}
              onClick={() => onQueue(q.id)}
              className={`h-8 rounded-lg px-3 text-[13px] transition-colors ${
                queue === q.id ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {q.text} <span className="tabular ml-1 text-slate-600">{counts[q.id]}</span>
            </button>
          ))}
        </div>
        {category && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 py-1 pl-3 pr-1.5 text-[13px] text-white">
            {CATEGORIES.find((c) => c.id === category)!.title}
            <button onClick={() => onCategory(null)} aria-label="Remove kind filter" className="rounded-full p-0.5 hover:bg-white/20">
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        <div className="relative ml-auto w-full sm:w-60">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <label htmlFor="case-search" className="sr-only">Search cases</label>
          <input id="case-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a payment or problem"
                 className="h-9 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-[13px] placeholder:text-slate-500" />
        </div>
      </header>

      <div className="space-y-6 p-6">
        {loading && cases.length === 0 ? (
          <div className="grid gap-3 md:grid-cols-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        ) : groups.length === 0 ? (
          queue === "decide" && !category && !query && cases.length > 0 ? (
            <EmptyState title="Nothing waits for your decision">Every remaining difference was settled automatically by the rules.</EmptyState>
          ) : (
            <EmptyState icon={SearchX} title="No cases here"
                        action={filtered && <Button size="sm" onClick={() => { onCategory(null); setQuery(""); onQueue("all"); }}>Show all cases</Button>}>
              {cases.length === 0 ? "Every payment matched its settlement and invoice." : "Nothing matches this view."}
            </EmptyState>
          )
        ) : (
          groups.map(({ cat, items }) => {
            const Icon = cat.icon;
            return (
              <section key={cat.id} aria-labelledby={`grp-${cat.id}`} className={`rounded-2xl p-4 ${cat.color.soft}`}>
                <h3 id={`grp-${cat.id}`} className={`flex items-center gap-2 font-semibold ${cat.color.text}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${cat.color.accent}`}><Icon aria-hidden className="h-4 w-4" /></span>
                  {cat.title}
                  <span className="tabular text-[13px] font-normal text-slate-600">· {items.length}</span>
                </h3>
                <ul className="mt-3 grid gap-3 md:grid-cols-2">
                  {items.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => onOpen(c.id)}
                        className={`group flex h-full w-full flex-col rounded-xl border border-l-4 border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${cat.color.bar}`}
                      >
                        <span className="flex w-full items-start gap-3">
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold text-slate-900">{typeInfo(c.type).title}</span>
                            <span className="text-[13px] text-slate-500">{c.subjectId}</span>
                          </span>
                          <span className="tabular shrink-0 text-right font-semibold text-slate-900">{fmtMoney(c.amount, c.currency)}</span>
                        </span>
                        <span className="mt-2 block text-[13px] leading-relaxed text-slate-700">{explainCase(c)}</span>
                        <span className="mt-3 flex w-full items-center justify-between gap-2">
                          <StatusTag value={c.reviewStatus === "PENDING" || c.reviewStatus === "NOT_REQUIRED" ? c.status : c.reviewStatus}
                                     kind={c.reviewStatus === "PENDING" || c.reviewStatus === "NOT_REQUIRED" ? undefined : "review"} size="sm" />
                          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-600 group-hover:text-slate-900">
                            Open <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </section>
  );
}
