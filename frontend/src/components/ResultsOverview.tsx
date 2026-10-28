import { CircleCheck, Gauge } from "lucide-react";
import type { Batch, CaseSummary, Metrics } from "../api/types";
import { CATEGORIES, categoryOf, type CategoryId } from "../friendly";
import { Skeleton, fmtMs } from "./ui";

/**
 * Top of the results page: one plain sentence, a colour bar of what happened to every payment, and
 * the five problem categories as coloured cards (each one filters the list below).
 */
export function ResultsOverview({ batch, cases, metrics, loading, category, onCategory }: {
  batch: Batch; cases: CaseSummary[]; metrics: Metrics | null; loading: boolean;
  category: CategoryId | null; onCategory: (c: CategoryId | null) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading results">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      </div>
    );
  }

  const t = batch.totals;
  const review = cases.filter((c) => c.status === "REVIEW_REQUIRED").length;
  const auto = cases.filter((c) => c.status === "AUTO_MATCHED").length;
  const clean = t.matchedPayments;
  const total = Math.max(1, clean + review + auto);
  const ev = metrics?.evaluation;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[13px] font-medium text-slate-500">Result of this check</p>
        <h2 className="mt-1 text-xl font-semibold leading-snug text-slate-900">
          We checked <span className="tabular">{t.payments}</span> payments.{" "}
          <span className="text-teal-700">{clean} are fine</span>
          {review > 0 && <>, <span className="text-amber-700">{review} need your decision</span></>}
          {auto > 0 && <> and <span className="text-sky-700">{auto} small issues were settled automatically</span></>}.
        </h2>

        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img"
             aria-label={`${clean} fine, ${review} need a decision, ${auto} settled automatically`}>
          <span className="bg-teal-500" style={{ width: `${(clean / total) * 100}%` }} />
          <span className="bg-amber-400" style={{ width: `${(review / total) * 100}%` }} />
          <span className="bg-sky-400" style={{ width: `${(auto / total) * 100}%` }} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-600">
          <Legend color="bg-teal-500" text={`Fine · ${clean}`} />
          <Legend color="bg-amber-400" text={`Needs your decision · ${review}`} />
          <Legend color="bg-sky-400" text={`Settled automatically · ${auto}`} />
          <li className="ml-auto flex items-center gap-1.5">
            <Gauge aria-hidden className="h-4 w-4 text-slate-500" />
            {ev?.available
              ? <>Found <b className="tabular font-semibold text-slate-900">{ev.truePositives} of {ev.expectedAnomalies}</b> planted problems,{" "}
                  {ev.detectedAnomalies - ev.truePositives === 0 ? "no false alarms" : `${ev.detectedAnomalies - ev.truePositives} false alarms`} · {fmtMs(batch.durationMs)}</>
              : <>Checked in {fmtMs(batch.durationMs)}</>}
          </li>
        </ul>
      </section>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-slate-900">Problems by kind</h2>
          {category && (
            <button onClick={() => onCategory(null)} className="rounded text-[13px] font-medium text-teal-800 hover:underline">Show all kinds</button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {CATEGORIES.map((cat) => {
            const items = cases.filter((c) => categoryOf(c.type).id === cat.id);
            const open = items.filter((c) => c.status === "REVIEW_REQUIRED").length;
            const selected = category === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => onCategory(selected ? null : cat.id)}
                aria-pressed={selected}
                disabled={items.length === 0}
                className={`group relative overflow-hidden rounded-2xl p-4 text-left ring-1 transition disabled:cursor-default disabled:opacity-60 ${cat.color.soft} ${
                  selected ? `ring-2 ${cat.color.ringStrong} shadow-md` : `${cat.color.ring} hover:shadow-md`
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-white ${cat.color.accent}`}>
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <span className={`mt-3 block font-semibold ${cat.color.text}`}>{cat.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-slate-600">{cat.blurb}</span>
                <span className="mt-3 flex items-baseline gap-2">
                  <span className={`tabular text-2xl font-semibold ${cat.color.text}`}>{items.length}</span>
                  <span className="text-[13px] text-slate-600">
                    {items.length === 0 ? "none found" : open ? `${open} need you` : (
                      <span className="inline-flex items-center gap-1"><CircleCheck aria-hidden className="h-3.5 w-3.5 text-teal-700" />all settled</span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${color}`} /> {text}
    </li>
  );
}
