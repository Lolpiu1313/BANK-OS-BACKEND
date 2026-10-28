import type {
  ApiError, Batch, BatchEvent, CaseDetail, CaseStatus, CaseSummary, CaseType,
  InvoiceInfo, Metrics, Policy, ReplayRequest, ReplayResult, ReviewDecision, SystemInfo,
} from "./types";

export class ApiRequestError extends Error {
  constructor(public status: number, public body: ApiError | null) {
    super(body ? `${body.error}: ${body.message}` : `HTTP ${status}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let body: ApiError | null = null;
    try { body = await res.json(); } catch { /* non-JSON error */ }
    throw new ApiRequestError(res.status, body);
  }
  return res.json();
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  health: () => request<{ status: string }>("/actuator/health"),
  system: () => request<SystemInfo>("/api/system"),

  listBatches: () => request<Batch[]>("/api/batches"),
  getBatch: (id: string) => request<Batch>(`/api/batches/${id}`),
  batchEvents: (id: string) => request<BatchEvent[]>(`/api/batches/${id}/events`),
  uploadBatch: (payments: File, settlements: File, invoices: File[]) => {
    const form = new FormData();
    form.append("payments", payments);
    form.append("settlements", settlements);
    invoices.forEach((f) => form.append("invoices", f));
    return request<Batch>("/api/batches", { method: "POST", body: form });
  },
  batchInvoices: (id: string) => request<InvoiceInfo[]>(`/api/batches/${id}/invoices`),
  processBatch: (id: string, policyVersion?: number) =>
    request<Batch>(`/api/batches/${id}/process${policyVersion ? `?policyVersion=${policyVersion}` : ""}`, { method: "POST" }),

  listCases: (filter: { batchId?: string; status?: CaseStatus; type?: CaseType }) => {
    const q = new URLSearchParams();
    Object.entries(filter).forEach(([k, v]) => v && q.set(k, v));
    return request<CaseSummary[]>(`/api/cases?${q}`);
  },
  getCase: (id: string) => request<CaseDetail>(`/api/cases/${encodeURIComponent(id)}`),
  investigate: (id: string) => request<CaseDetail>(`/api/cases/${encodeURIComponent(id)}/investigate`, { method: "POST" }),
  review: (id: string, actor: string, decision: ReviewDecision, note: string) =>
    request(`/api/cases/${encodeURIComponent(id)}/review`, json({ actor, decision, note })),

  listPolicies: () => request<Policy[]>("/api/policies"),
  replay: (req: ReplayRequest) => request<ReplayResult>("/api/policies/replay", json(req)),

  metrics: (batchId: string) => request<Metrics>(`/api/metrics?batchId=${batchId}`),
};

/** URL of an uploaded invoice PDF, opened at a given page by the browser's PDF viewer. */
export const invoicePdfUrl = (batchId: string, file: string, page?: number | null) =>
  `/api/batches/${batchId}/invoices/${encodeURIComponent(file)}${page ? `#page=${page}` : ""}`;

export const errorMessage = (e: unknown): string =>
  e instanceof ApiRequestError
    ? [e.message, ...(e.body?.details ?? [])].join(" · ")
    : e instanceof Error ? e.message : String(e);
