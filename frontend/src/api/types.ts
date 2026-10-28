// Mirrors the backend DTOs in backend/src/main/java/com/bankos/dto. BigDecimal arrives as a JSON number.

export type BatchStatus =
  | "UPLOADED" | "PARSING" | "RECONCILING" | "INVESTIGATING"
  | "APPLYING_POLICY" | "READY_FOR_REVIEW" | "FAILED";

export type CaseStatus = "OPEN" | "AUTO_MATCHED" | "REVIEW_REQUIRED";

export type CaseType =
  | "MISSING_SETTLEMENT" | "DUPLICATE_SETTLEMENT" | "DUPLICATE_PAYMENT" | "EXPORT_DUPLICATE"
  | "AMOUNT_MISMATCH" | "CURRENCY_MISMATCH" | "REFERENCE_MISMATCH" | "UNEXPECTED_SETTLEMENT"
  | "AMBIGUOUS_MATCH" | "MISSING_INVOICE" | "INVOICE_MISMATCH";

export type InvestigationStatus = "NOT_RUN" | "COMPLETED" | "OFFLINE_FALLBACK" | "FAILED" | "REJECTED";

export type ReviewStatus = "NOT_REQUIRED" | "PENDING" | "INVESTIGATING" | "APPROVED" | "REJECTED" | "ESCALATED";

export type ReviewDecision = "APPROVE" | "REJECT" | "ESCALATE" | "INVESTIGATING";

export interface Batch {
  id: string;
  status: BatchStatus;
  createdAt: string;
  processedAt: string | null;
  durationMs: number | null;
  policyVersion: number | null;
  paymentsFile: string | null;
  settlementsFile: string | null;
  totals: {
    payments: number;
    settlements: number;
    invoices: number;
    matchedPayments: number;
    quarantinedRows: number;
    cases: number;
  };
  casesByStatus: Record<string, number>;
  error: string | null;
}

export interface BatchEvent {
  kind: "AGENT" | "AUDIT";
  timestamp: string;
  caseId: string | null;
  agent: string | null;
  tool: string | null;
  state: string | null;
  durationMs: number | null;
  actor: string | null;
  action: string | null;
  detail: string | null;
  error: string | null;
}

export interface CaseSummary {
  id: string;
  batchId: string;
  type: CaseType;
  subjectId: string;
  paymentId: string | null;
  amount: number | null;
  difference: number | null;
  currency: string | null;
  status: CaseStatus;
  policyVersion: number | null;
  investigationStatus: InvestigationStatus;
  reviewStatus: ReviewStatus;
  description: string;
}

export interface EvidenceItem {
  id: string;
  source: string;
  row: number | null;
  page: number | null;
  field: string | null;
  recordId: string | null;
  value: string | null;
}

export interface TraceItem {
  id: number;
  agent: string;
  tool: string | null;
  state: string;
  durationMs: number;
  startedAt: string;
  detail: string | null;
  error: string | null;
}

export interface AuditItem {
  id: number;
  action: string;
  actor: string;
  details: string | null;
  createdAt: string;
}

export interface GraphNode { id: string; kind: string; label: string; detail: string | null }
export interface GraphEdge { id: string; source: string; target: string; label: string | null }

export interface CaseDetail {
  id: string;
  batchId: string;
  type: CaseType;
  subjectId: string;
  paymentId: string | null;
  settlementIds: string[];
  reference: string | null;
  invoiceNumber: string | null;
  amount: number | null;
  actualAmount: number | null;
  difference: number | null;
  currency: string | null;
  description: string;
  status: CaseStatus;
  policyVersion: number | null;
  appliedRules: string[];
  decisionReason: string | null;
  evidence: EvidenceItem[];
  investigation: {
    status: InvestigationStatus;
    summary: string | null;
    possibleCause: string | null;
    evidenceIds: string[];
    requiresHumanReview: boolean | null;
    error: string | null;
    investigatedAt: string | null;
  } | null;
  review: { status: ReviewStatus; reviewedBy: string | null; reviewedAt: string | null } | null;
  agentTrace: TraceItem[];
  auditTrail: AuditItem[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
}

export interface Policy {
  version: number;
  currency: string;
  amountTolerance: number;
  requireInvoice: boolean;
  duplicatePaymentAllowed: boolean;
  missingSettlement: CaseStatus;
  ambiguousReference: CaseStatus;
  unexpectedSettlement: CaseStatus;
  referenceMismatch: CaseStatus;
  exportDuplicate: CaseStatus;
  basedOn: number | null;
  description: string | null;
  createdAt: string;
}

export interface ReplayRequest {
  batchId?: string;
  baseVersion?: number;
  amountTolerance?: number;
  requireInvoice?: boolean;
  duplicatePaymentAllowed?: boolean;
  missingSettlement?: CaseStatus;
  ambiguousReference?: CaseStatus;
  unexpectedSettlement?: CaseStatus;
  referenceMismatch?: CaseStatus;
  exportDuplicate?: CaseStatus;
  description?: string;
}

export interface ReplayResult {
  baseVersion: Policy | null;
  newVersion: Policy;
  batchId: string | null;
  evaluatedCases: number;
  changedCases: number;
  changes: {
    caseId: string;
    type: CaseType;
    subjectId: string;
    difference: number | null;
    currency: string | null;
    beforeVersion: number | null;
    beforeStatus: CaseStatus;
    beforeRules: string[];
    afterStatus: CaseStatus;
    afterRules: string[];
    afterReason: string;
  }[];
  simulationOnly: boolean;
}

export interface Metrics {
  batchId: string;
  batchStatus: string;
  processingTimeMs: number | null;
  payments: number;
  settlements: number;
  invoices: number;
  matchedPayments: number;
  totalCases: number;
  casesByType: Record<string, number>;
  casesByStatus: Record<string, number>;
  autoMatchedCases: number;
  reviewRequiredCases: number;
  investigationsByStatus: Record<string, number>;
  toolInvocations: number;
  failedExecutions: number;
  reviewActions: number;
  evaluation: {
    available: boolean;
    note: string | null;
    expectedAnomalies: number;
    detectedAnomalies: number;
    truePositives: number;
    precision: number;
    recall: number;
    statusAccuracy: number;
    missed: string[];
    unexpected: string[];
  } | null;
}

export interface ApiError {
  error: string;
  message: string;
  details: string[];
  timestamp: string;
}

export interface SystemInfo {
  aiMode: "LIVE" | "OFFLINE";
  chatModel: string | null;
  aiTimeoutSeconds: number;
  maxToolCallsPerInvestigation: number;
  maxInvestigationsPerBatch: number;
  asyncProcessing: boolean;
  maxInvoicesPerBatch: number;
  maxFileSizeBytes: number;
  maxRequestSizeBytes: number;
  investigatorTools: { name: string; description: string }[];
}

export type InvoiceStatus = "VERIFIED" | "REJECTED" | "UNREADABLE" | "FAILED";

export interface InvoiceInfo {
  sourceFile: string;
  sourcePage: number | null;
  number: string | null;
  supplier: string | null;
  amount: number | null;
  currency: string | null;
  paymentReference: string | null;
  status: InvoiceStatus;
  extractionMethod: string | null;
  verificationNotes: string | null;
}
