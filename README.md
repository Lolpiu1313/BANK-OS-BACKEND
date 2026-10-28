# BANK//OS — AI Banking Exception Investigator

Reconciles outbound payments against settlement records and invoice PDFs, investigates every
discrepancy with a tool-using AI agent, applies **versioned, deterministic** policy rules, and
records human review in an append-only audit log. A Spring Boot modular monolith (`backend/`) with
a React dashboard (`frontend/`).

> Synthetic data only. Fictional suppliers, references, amounts and policies.
> The system never moves money and the LLM never decides a case status.

## Stack

| Technology | Use |
|---|---|
| Java 21 (runs on newer JDKs) | Language, records for agent DTOs |
| Spring Boot 4.1.2 | REST, DI, JPA, validation, actuator |
| Spring AI 2.0.2 (OpenAI) | ChatClient, typed responses, `@Tool` methods |
| PDFBox 3.0.8 | Text extraction from invoice PDFs |
| Apache Commons CSV 1.14.1 | Payment / settlement CSV parsing |
| H2 (file mode) | Local persistence, no DB server |
| JUnit 5 / Spring Boot Test | Unit and integration tests |
| React 19 + Vite 6 + Tailwind 4 | Dashboard (`frontend/`) |
| React Flow (`@xyflow/react`) | Evidence relationship graph |

## Quick start

Requirements: Java 21+ and Node.js 20+. No Maven install needed; the wrapper downloads it.
No API key is needed: the default `offline` profile runs end-to-end without any model calls.

```bash
# terminal 1: backend
cd backend
./mvnw clean test                 # 43 tests
./mvnw spring-boot:run            # http://localhost:8080
curl http://localhost:8080/actuator/health    # {"status":"UP"}

# terminal 2: frontend
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

Open http://localhost:5173, add `synthetic-data/payments.csv`, `synthetic-data/settlements.csv`
and all PDFs from `synthetic-data/invoices/`, then press **Check my payments**. See
[`frontend/README.md`](frontend/README.md) for what each screen shows.

### Windows

Install a JDK 21+ (for example Eclipse Temurin) and Node.js 20 LTS, and check that `java -version`
works in a new terminal (or set `JAVA_HOME`). Then, in PowerShell:

```powershell
# window 1: backend
cd backend
.\mvnw.cmd clean test
.\mvnw.cmd spring-boot:run

# window 2: frontend
cd frontend
npm install
npm run dev
```

- Live AI: `$env:SPRING_PROFILES_ACTIVE="live"; $env:OPENAI_API_KEY="sk-..."; .\mvnw.cmd spring-boot:run`
- Clean start: stop the backend first (Windows locks the H2 files), then `Remove-Item -Recurse -Force backend\data`.
- Regenerate the dataset:
  `.\mvnw.cmd -q compile spring-boot:run "-Dstart-class=com.bankos.datagen.SyntheticDataGenerator" "-Dspring-boot.run.arguments=../synthetic-data 2401"`
- The curl walkthrough below is written for bash; on Windows use the dashboard or Git Bash.
- `.gitattributes` keeps `synthetic-data/` byte-identical on checkout, so precision/recall also work
  on Windows clones (Git's default CRLF conversion would otherwise change the file hash).

### Profiles and environment variables

| Variable | Default | Meaning |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `offline` | `offline` = no model calls; deterministic, labelled fallbacks (`OFFLINE_PARSER`, `OFFLINE_FALLBACK`). `live` = real OpenAI calls. |
| `OPENAI_API_KEY` | – | Required for `live`. Never commit it. |
| `OPENAI_MODEL` | `gpt-5-mini` | Chat model used in `live`. |

```bash
SPRING_PROFILES_ACTIVE=live OPENAI_API_KEY=sk-... ./mvnw spring-boot:run
```

If the model is unreachable in `live` (no key, outage, timeout), extraction falls back to the
deterministic parser (`FALLBACK_PARSER`), investigations are marked `FAILED`, and every affected
case is escalated to `REVIEW_REQUIRED` (`RULE_AI_UNAVAILABLE`). Reconciliation findings are kept.

Other settings live under `bankos.*` in `backend/src/main/resources/application.yml`
(AI timeout, max tool calls per investigation, async processing, storage and data paths, CORS).
Delete `backend/data/` for a clean start (H2 database + uploaded files).

## Synthetic dataset

`synthetic-data/` is generated deterministically (seed 2401):

| File | Content |
|---|---|
| `payments.csv` | 200 payments (+1 duplicated register row) |
| `settlements.csv` | 203 settlement rows, shuffled |
| `invoices/*.pdf` | 12 invoice PDFs (one is a scan without text, one contains a prompt-injection line) |

The scanned invoice (`INV-2090.pdf`) has no text layer: its extraction is logged as `SKIPPED`
(a handled recovery, not a failure) and the payment that needs it goes to human review.
| `policies.json` | Policy version 1 (tolerance EUR 10, invoice required, duplicates not allowed, ...) |
| `ground_truth.json` | 20 labelled anomalies with expected statuses; used only by `/api/metrics` |

Regenerate (same seed → same bytes for the CSVs):

```bash
cd backend
./mvnw -q compile spring-boot:run -Dstart-class=com.bankos.datagen.SyntheticDataGenerator \
       -Dspring-boot.run.arguments="../synthetic-data 2401"
```

## Demo walkthrough (dashboard)

1. Upload the three inputs from `synthetic-data/` and press **Check my payments**.
2. **Results**: 201 payments checked, 181 fine, 16 need a decision, 4 settled automatically;
   20 of 20 planted problems found with no false alarms.
3. Open **Paid twice · PAY-1042**: what happened, why a decision is needed (rule, not AI), the AI
   assistant's view, the proof (CSV lines, invoice page), the AI steps (`getCaseEvidence` →
   `getCasePolicy`) and the history.
4. Open **Invoice doesn't match · PAY-1042** → *Proof* → *View invoice*: the PDF opens at the cited page.
5. Record a decision (e.g. *Still checking*); it is confirmed first and appears in *History*.
6. **What if the rules changed?** → accept differences up to 5 instead of 10 → exactly PAY-1188 changes.
7. **Behind the scenes**: AI activity and limits, timings, accuracy metrics, invoice extraction status,
   safety rules and the full activity log.

## Demo walkthrough (curl)

```bash
D=../synthetic-data
curl -F payments=@$D/payments.csv -F settlements=@$D/settlements.csv \
     $(for f in $D/invoices/*.pdf; do printf -- '-F invoices=@%s ' "$f"; done) \
     http://localhost:8080/api/batches                          # -> {"id":"B001","status":"UPLOADED",...}

curl -X POST http://localhost:8080/api/batches/B001/process     # 202, runs in the background
curl http://localhost:8080/api/batches/B001                     # poll until READY_FOR_REVIEW
curl http://localhost:8080/api/batches/B001/events              # stage transitions + tool calls
curl "http://localhost:8080/api/cases?batchId=B001&status=REVIEW_REQUIRED"
curl http://localhost:8080/api/cases/CASE-B001-PAY-1042-DUP     # evidence, trace, audit, graph

curl -H 'Content-Type: application/json' \
     -d '{"actor":"analyst.maria","decision":"ESCALATE","note":"second settled entry"}' \
     http://localhost:8080/api/cases/CASE-B001-PAY-1042-DUP/review

curl -H 'Content-Type: application/json' -d '{"batchId":"B001","amountTolerance":5}' \
     http://localhost:8080/api/policies/replay                  # exactly PAY-1188 changes

curl "http://localhost:8080/api/metrics?batchId=B001"           # precision/recall vs ground truth
```

(The `$(for ...)` helper is for bash; in zsh build an array instead.)

## Architecture

```
React dashboard ──► REST controllers ──► AgentOrchestrator
                                          ├─ PARSING        CsvImportService, PdfService, DocumentExtractionAgent (AI + verification)
                                          ├─ RECONCILING    ReconciliationAgent (deterministic Java, BigDecimal)
                                          ├─ INVESTIGATING  InvestigationAgent ──tools──► InvestigationTools ──► EvidenceService (read-only)
                                          ├─ APPLYING_POLICY PolicyAgent (versioned rules, Java)
                                          └─ READY_FOR_REVIEW ──► human review (CaseService) ──► AuditService
H2: batches, payments, settlements, invoices, cases, evidence, policy_versions, agent_executions, audit_events
```

Workflow: `UPLOADED → PARSING → RECONCILING → INVESTIGATING → APPLYING_POLICY → READY_FOR_REVIEW`
(any stage may end in `FAILED`; persisted cases are kept). Every transition and every tool call is
stored and exposed via `/api/batches/{id}/events` and the case `agentTrace`.

| Component | Receives | Returns |
|---|---|---|
| DocumentExtractionAgent | PDF page text + page index | `InvoiceData` (verified against the text) |
| ReconciliationAgent | payments + settlements (+ invoices) | `List<Discrepancy>` |
| InvestigationAgent | case ID + evidence tools | `InvestigationResult` |
| PolicyAgent | `Discrepancy` + `PolicyVersion` | `PolicyDecision` |
| AgentOrchestrator | batch ID | batch execution / case states |
| PolicySimulationService | stored cases + proposed rules | before/after comparison |

Guard rails: money is `BigDecimal`, dates `LocalDate`; currencies are never compared as equal;
`PENDING`/`REVERSED` settlements never count as paid; repeated export rows are not double payments;
ambiguous candidates are never auto-selected; model output is untrusted (evidence IDs are verified,
the `getCaseEvidence` tool call is required, tools are scoped to the case and budgeted, calls have a
timeout); no JPA transaction is held across model calls; reprocessing a batch creates no duplicate
cases (content-derived case IDs); replay creates a new policy version and never overwrites decisions;
reviews are separate audit events.

## REST API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/batches` | Upload `payments` + `settlements` CSVs and `invoices` PDFs (multipart) |
| GET | `/api/batches` | List batches |
| POST | `/api/batches/{id}/process` | Start the pipeline (`?policyVersion=` optional) |
| GET | `/api/batches/{id}` | Status and totals |
| GET | `/api/batches/{id}/events` | Agent stage and tool execution events + audit events |
| GET | `/api/batches/{id}/invoices` | Extraction status of each uploaded invoice PDF |
| GET | `/api/batches/{id}/invoices/{file}` | The uploaded invoice PDF (inline, for the evidence viewer) |
| GET | `/api/cases?batchId=&status=&type=` | Case summaries |
| GET | `/api/cases/{id}` | Evidence-backed detail, investigation, agent trace, audit trail, graph |
| POST | `/api/cases/{id}/investigate` | Run or rerun the AI investigation |
| POST | `/api/cases/{id}/review` | `{"actor","decision":"APPROVE\|REJECT\|ESCALATE\|INVESTIGATING","note"}` |
| GET | `/api/policies`, `/api/policies/{version}` | Policy versions |
| POST | `/api/policies/replay` | Proposed rules → new version + changed cases (simulation only) |
| GET | `/api/system` | AI mode, agent limits (tool calls, timeout, investigations), upload limits, investigator tools |
| GET | `/api/metrics?batchId=` | Processing time, anomaly counts, tool usage, precision/recall |

Errors always use `{"error","message","details","timestamp"}`.

### CSV formats

`payments.csv`: `payment_id,reference,supplier,amount,currency,value_date,invoice_number`
(required: `payment_id, reference, amount, currency`)

`settlements.csv`: `settlement_id,payment_id,reference,amount,currency,status,settled_at`
(`status` ∈ `SETTLED|PENDING|REVERSED`; `payment_id` may be blank)

Amounts: decimal with at most 2 fraction digits; currency: ISO 4217; dates: `YYYY-MM-DD`.
Malformed rows are quarantined and audited, not guessed.

### Case types and policy outcomes (v1)

| Type | Detected when | v1 status |
|---|---|---|
| `DUPLICATE_SETTLEMENT` | >1 distinct SETTLED settlement for one payment | REVIEW_REQUIRED |
| `DUPLICATE_PAYMENT` | Same payment ID twice in the register | REVIEW_REQUIRED |
| `EXPORT_DUPLICATE` | Same settlement ID repeated (identical → data duplication) | AUTO_MATCHED (conflicting rows → REVIEW) |
| `MISSING_SETTLEMENT` | No SETTLED confirmation | REVIEW_REQUIRED |
| `AMOUNT_MISMATCH` | Amounts differ (same currency) | AUTO_MATCHED if ≤ EUR 10, else REVIEW |
| `CURRENCY_MISMATCH` | Currencies differ | REVIEW_REQUIRED |
| `REFERENCE_MISMATCH` | Normalized references differ | REVIEW_REQUIRED |
| `UNEXPECTED_SETTLEMENT` | Settlement without a known payment | REVIEW_REQUIRED |
| `AMBIGUOUS_MATCH` | Orphan settlement fits several payments | REVIEW_REQUIRED |
| `MISSING_INVOICE` | Declared invoice absent / unreadable / unverified | REVIEW_REQUIRED |
| `INVOICE_MISMATCH` | Invoice amount or payment reference contradicts the payment | REVIEW_REQUIRED |

Any case whose AI step failed or was rejected is escalated to `REVIEW_REQUIRED`.

## Tests

`./mvnw test` runs 43 tests:

- `ReconciliationAgentTest` — exact match, missing, pending/reversed, duplicate settlement, export
  duplicate, amount/currency/reference mismatch, unexpected, ambiguous, reference linking, invoice checks.
- `PolicyAgentTest` — tolerance table (EUR 4 / EUR 20), duplicates, missing invoice, AI unavailable, replay.
- `DocumentExtractionAgentTest` — real PDF with page provenance, unreadable scan, prompt injection,
  rejected hallucinated fields, live-without-model fallback.
- `InvestigationAgentTest` — invented evidence IDs rejected, missing tool call rejected, outage and
  timeout fail closed, tool scoping and budget.
- `BatchIntegrationTest` — HTTP end-to-end on the synthetic dataset: precision/recall 1.0 against
  ground truth, tool trace, idempotent reprocessing, audited review, versioned replay, validation errors, health,
  `/api/system`, invoice extraction status and PDF download, scanned invoice logged as `SKIPPED` (0 failed executions).
- `AiUnavailableIntegrationTest` — live mode without a model: all cases escalated, findings preserved.

## Known limitations

- Precision/recall are computed only when the uploaded payments file is byte-identical to the
  reference dataset (`ground_truth.json` stores its SHA-256); for any other upload they show as
  unavailable. Labels never leave the backend.
- In `offline` mode no model is called: document extraction uses a deterministic parser and
  investigations are rule-based summaries labelled `OFFLINE_FALLBACK`. A real LLM trace requires
  `live` mode with `OPENAI_API_KEY`.
- Scanned PDFs are not OCR'd; they are marked unreadable and routed to human review.
- Policy replay uses the amount tolerance and per-type statuses (e.g. 10 → 5 EUR); the blueprint's
  invoice-age rule (P07, 90 → 30 days) is not implemented.
- No confidence levels (HIGH/MEDIUM/LOW), no chaos button and no exported PDF case packet.
- No authentication or roles: the reviewer name is free text. Local H2 storage only.

## Repository layout

```
backend/                      Spring Boot app (pom.xml, mvnw)
  src/main/java/com/bankos/
    controller/  agent/  service/  dto/  model/  repository/  config/  datagen/
  src/main/resources/application*.yml
  src/test/java/com/bankos/
frontend/                     React dashboard (Vite dev server proxies /api to :8080)
  src/api/  src/components/  src/friendly.ts  src/App.tsx
synthetic-data/               payments.csv, settlements.csv, invoices/, policies.json, ground_truth.json
```
