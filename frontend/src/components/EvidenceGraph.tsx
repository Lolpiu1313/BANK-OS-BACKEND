import { useMemo } from "react";
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { CaseDetail } from "../api/types";
import { EmptyState } from "./ui";

const kindStyle: Record<string, { bg: string; border: string; tag: string }> = {
  case: { bg: "#111a2e", border: "#111a2e", tag: "Case" },
  payment: { bg: "#eef2ff", border: "#6366f1", tag: "Payment" },
  settlement: { bg: "#f0fdfa", border: "#14b8a6", tag: "Settlement" },
  invoice: { bg: "#fffbeb", border: "#f59e0b", tag: "Invoice" },
  rule: { bg: "#f8fafc", border: "#94a3b8", tag: "Policy rule" },
};

/** Sources on the left, the case in the middle, the policy rules that decided it on the right. */
export function EvidenceGraph({ detail }: { detail: CaseDetail }) {
  const { nodes, edges } = useMemo(() => {
    const g = detail.graph ?? { nodes: [], edges: [] };
    const columns = { left: [] as string[], mid: [] as string[], right: [] as string[] };
    g.nodes.forEach((n) => (n.kind === "case" ? columns.mid : n.kind === "rule" ? columns.right : columns.left).push(n.id));

    const pos = new Map<string, { x: number; y: number }>();
    const place = (ids: string[], x: number) =>
      ids.forEach((id, i) => pos.set(id, { x, y: (i - (ids.length - 1) / 2) * 100 }));
    place(columns.left, 0);
    place(columns.mid, 320);
    place(columns.right, 640);

    const nodes: Node[] = g.nodes.map((n) => {
      const s = kindStyle[n.kind] ?? kindStyle.rule;
      const dark = n.kind === "case";
      return {
        id: n.id,
        position: pos.get(n.id)!,
        data: {
          label: (
            <div className="text-left">
              <div className={`text-xs font-medium ${dark ? "text-slate-300" : "text-slate-600"}`}>{s.tag}</div>
              <div className="mono text-[13px] font-semibold">{n.label}</div>
              {n.detail && <div className={`text-xs ${dark ? "text-slate-300" : "text-slate-600"}`}>{n.detail}</div>}
            </div>
          ),
        },
        sourcePosition: "right" as never,
        targetPosition: "left" as never,
        style: {
          background: s.bg, borderColor: s.border, color: dark ? "white" : "#1e293b",
          borderWidth: 1.5, borderRadius: 10, width: 230, padding: 10,
        },
      };
    });
    const edges: Edge[] = g.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label ?? undefined,
      labelStyle: { fontSize: 12, fill: "#475569" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      style: { stroke: "#94a3b8" },
    }));
    return { nodes, edges };
  }, [detail]);

  if (!nodes.length) return <EmptyState title="No relationships to show">This case has no linked records.</EmptyState>;
  return (
    <>
    <p className="mb-3 text-[13px] text-slate-600">How the records are connected: where the money came from on the left, the problem in the middle, the rule that decided it on the right.</p>
    <div className="h-[420px] rounded-xl border border-slate-200" aria-label="Evidence relationship graph">
      <ReactFlow nodes={nodes} edges={edges} fitView nodesConnectable={false} proOptions={{ hideAttribution: true }}>
        <Background gap={16} color="#e2e8f0" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
    </>
  );
}
