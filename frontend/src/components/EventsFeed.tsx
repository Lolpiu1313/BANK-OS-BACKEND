import { useState } from "react";
import type { BatchEvent } from "../api/types";
import { Card, EmptyState, StatusText, fmtTime, label } from "./ui";

/** Batch timeline: agent stages, tool calls and audit events, newest first. */
export function EventsFeed({ events, onSelectCase }: { events: BatchEvent[]; onSelectCase: (id: string) => void }) {
  const [onlyTools, setOnlyTools] = useState(false);
  const shown = [...events]
    .filter((e) => !onlyTools || (e.kind === "AGENT" && e.tool))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <Card
      title="Activity log"
      description={`${events.length} events, newest first`}
      actions={
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
          <input type="checkbox" checked={onlyTools} onChange={(e) => setOnlyTools(e.target.checked)} className="h-4 w-4 accent-teal-700" />
          Tool calls only
        </label>
      }
      className="flex min-h-0 flex-col"
    >
      {shown.length === 0 ? (
        <EmptyState title="No activity yet">Events appear here while the batch is processed.</EmptyState>
      ) : (
        <ol className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto">
          {shown.map((e, i) => (
            <li key={i} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="tabular text-xs text-slate-500">{fmtTime(e.timestamp)}</span>
                {e.kind === "AGENT" ? (
                  <>
                    <span className="text-[13px] font-medium text-slate-900">
                      {e.tool ? (e.agent === "AgentOrchestrator" ? `Stage: ${label(e.tool)}` : <span className="mono">{e.tool}()</span>) : e.agent}
                    </span>
                    {e.tool && e.agent !== "AgentOrchestrator" && <span className="text-xs text-slate-500">{e.agent}</span>}
                    <span className="ml-auto"><StatusText value={e.state} /></span>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] font-medium text-slate-900">{label(e.action ?? "")}</span>
                    <span className="ml-auto text-xs text-slate-500">by {e.actor}</span>
                  </>
                )}
              </div>
              {e.detail && <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-600" title={e.detail}>{e.detail}</p>}
              {e.error && <p className="mt-0.5 text-[13px] text-red-700">{e.error}</p>}
              {(e.caseId || e.durationMs != null) && (
                <p className="mt-1 flex gap-3 text-xs text-slate-500">
                  {e.caseId && (
                    <button className="mono rounded text-teal-800 hover:underline" onClick={() => onSelectCase(e.caseId!)}>{e.caseId}</button>
                  )}
                  {e.durationMs != null && <span className="tabular">{e.durationMs} ms</span>}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
