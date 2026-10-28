# BANK//OS frontend

React 19 + Vite 6 + Tailwind 4 + React Flow dashboard for the backend REST API (see the root
[`README.md`](../README.md)). Requires Node.js 20+.

```bash
# terminal 1
cd backend && ./mvnw spring-boot:run      # http://localhost:8080

# terminal 2
cd frontend
npm install
npm run dev                                # http://localhost:5173
```

The dev server proxies `/api` and `/actuator` to `localhost:8080`, so no CORS setup is needed.
`npm run build` type-checks and writes `dist/`. If the backend is down the header says
*Backend offline* and the page reconnects on its own when it comes back.

## Screens

1. **Start screen**: three coloured boxes only — *Payments* (CSV), *Settlements* (CSV) and
   *Invoices* (PDFs, optional). Click *Choose file* or drag & drop; each box checks the file type
   and size and lets you replace or remove the file. *Check my payments* uploads and starts the check.
2. **Results** tab:
   - one plain sentence ("We checked 201 payments. 181 are fine, 16 need your decision…") with a
     colour bar, and the detection quality when the reference dataset is used;
   - **Problems by kind**: five coloured categories — *Money mismatch* (indigo), *Not confirmed*
     (orange), *Invoice problem* (fuchsia), *Can't link records* (sky), *Data clean-up* (slate).
     Clicking one filters the cases;
   - **Cases** as cards grouped by category, each with a plain title ("Paid twice"), the amount and
     one sentence explaining that specific case. Views: *Needs your decision*, *Settled
     automatically*, *Everything*, plus search.
3. **Case window** (opens from a card):
   - *Summary*: what happened (requested / actually settled / difference), why you need to decide
     (decided by the rules, not the AI), what the AI assistant thinks, and collapsed *Technical
     details* (case ID, rule codes, policy version, raw AI summary, cited evidence IDs);
   - *Proof*: the original records with their line or page; *View invoice* opens the PDF at the cited page;
   - *Connections*: React Flow graph of payment, settlements, invoice, case and rule;
   - *AI steps*: each tool call in order, with technical details collapsed;
   - *History*: the append-only audit trail;
   - *Your decision*: Approve / Escalate / Still checking / Not a problem. Every decision is
     confirmed before it is saved (it cannot be undone) and never moves money.
4. **What if the rules changed?**: change the accepted difference (e.g. 10 → 5 EUR) or who decides each
   kind of problem and see which cases would be decided differently. Simulation only.
5. **Behind the scenes** tab: what the AI assistant did (look-ups per case vs the limit of 4), safety
   limits (from `GET /api/system`), how long each stage took, *How accurate was it* (planted problems
   found, false alarms, cases with proof, made-up citations, risky cases sent to a person, escalation
   rate), every invoice with its extraction status, the safety rules and the full activity log (collapsed).

*New upload* (or the logo) returns to the start screen.

## Design standards

The UI follows published guidance rather than taste:

- **WCAG 2.2 AA**: text contrast ≥ 4.5:1, targets ≥ 24px (buttons are 32px+), visible keyboard focus,
  dialogs with focus handling and Escape, status never shown by colour alone (colour + icon + label).
  Checked with axe-core on every screen (0 violations).
- **Nielsen's heuristics**: visible system status (stage progress with elapsed time, skeletons instead
  of misleading zeros, a retry instead of an endless spinner), the user's language instead of internal
  codes (codes are kept under *Technical details* and in tooltips), error prevention (decisions are
  confirmed; files are checked per box) and errors that say what happened and how to recover.
- **IBM Carbon** status indicators: colour + icon + label, few indicators per item, empty states with a
  way forward.
- **Stephen Few** (dashboards): the number that needs action is the most prominent and every figure
  carries its context ("16 of 20").

## Layout

```
src/
  api/         types.ts (mirrors the backend DTOs), client.ts (fetch wrapper)
  friendly.ts  plain-language layer: problem categories, case titles and explanations, source/tool/audit names
  components/  UploadPanel, Pipeline, ResultsOverview, CaseBoard, CaseDrawer, EvidenceGraph, PdfViewer,
               ReplayModal, SystemView, EventsFeed, ui (status tags, buttons, alerts, formatters)
  App.tsx      start screen, tabs, data loading and polling
```
