# ETTE PO Hub

A complete, working implementation of the **ette hotel kitchen purchase-order system** — the full purchasing cycle from *identifying a need* through *vendor invoice paid*, with tiered approvals, three-way matching, exception tracking, and a full audit trail.

> **Process design credit:** The purchasing process implemented here — the 11-step cycle, the CAD approval matrix, the three-way match rules, exception handling and weekly success measures — was designed by **Yehong Hu** in the *ette Hotel Kitchen Purchasing Purchase Order (PO) SOP* (October 2026), originally delivered as a written procedure, flowchart, and an Excel tracker (PO Form / PO Register / Receiving Log / Invoice Exceptions). This web app is that design, implemented as software: every rule in the SOP is enforced by the system rather than left to habit. Notably, it removes the Excel tracker's known limitation — a PO form that could not save itself into the register — by linking requests, POs, receiving, invoices and payments in one database.

![CI](https://github.com/yehonghu/ette-po-hub/actions/workflows/ci.yml/badge.svg)

## The 11-step cycle, as software

| SOP step | In the app |
|---|---|
| 1. Identify the need | Purchase requests, with par-level flags on the Vendors & Items page |
| 2. Routine or emergency? | Emergency requests are rejected by the server unless authorizer, time and reason are documented |
| 3. Prepare purchase request | Request form (items, quantities, supplier, cost, reason); a draft PO is generated automatically |
| 4. Get approval | Approval engine routes by CAD total (incl. freight/fees/tax): ≤ $500 Kitchen Manager · $500.01–$2,000 Executive Chef · > $2,000 GM; creators cannot approve above their own authority |
| 5. Create PO & send order | Single numbering sequence `ETT-PO-0001…`; **sending is blocked server-side before approval**; split-PO warnings when same-day orders to one vendor cross a tier |
| 6. Receive & inspect | Per-line accepted/rejected quantities, quality, temperature, expiry; partial stays partial; shortfalls and rejections auto-open exceptions |
| 7. Capture supplier invoice | Invoice capture against a PO; duplicate vendor + invoice number is blocked |
| 8. Three-way match | PO ↔ receiving record ↔ invoice compared line-by-line; failures highlight variances, open an exception, and freeze payment |
| 9. Independent invoice approval | The PO approver and the invoice capturer are both blocked from approving the invoice (separation of duties, enforced in the API) |
| 10. Finance payment approval | Payment approver must differ from the invoice approver |
| 11. Pay & close PO | Payment date + reference recorded; a PO can only close when delivery, invoice and payment reconcile and no exceptions remain open |

Plus: an Exceptions center (short delivery, damaged, substitutes, price variance, no-PO, duplicates…), a Dashboard with the SOP Chapter 13 success measures, a live **Process Map** of the 11-step cycle, a weekly review pack (open POs, credits pending, vendor fill rates), a complete audit log, and Cmd+K search.

## Design

Calm, modern admin UI: neutral surfaces and generous whitespace; the pastel step colors from the original flowchart are used sparingly for stage/status only. Purposeful motion throughout — route transitions, an animated PO stepper, animated dashboard counters, animated bars, skeleton loading states — all fully gated by `prefers-reduced-motion`. Glassy sidebar/topbar, dark mode, command palette (⌘K), print-friendly PO view, and a Process Map page as the visual centerpiece. Fully responsive, with a large-touch-target receiving screen for the dock.

## Tech stack

- **Client:** React 19 + Vite + TypeScript + Tailwind CSS v4 + React Router
- **Server:** Node.js + Express 5, SQLite via the built-in `node:sqlite` (no native builds), JWT auth + role-based access control, bcrypt password hashing
- **Tests/CI:** a scripted full-cycle API smoke test (37 assertions) run in GitHub Actions on every push

## Run it locally

Requirements: Node.js 24+.

```bash
# 1. Install
npm run install:all

# 2. Build the client
npm run build

# 3. Start (API + built client on one port)
npm start
# → http://localhost:4000   (first start seeds demo data automatically)
```

For development with hot reload, run the API (`npm run dev:server`, port 4000) and the Vite client (`npm run dev:client`, port 5173, proxies `/api`) separately.

### Demo accounts

All demo accounts use the password **`demo1234`** (demo only — change before any real use). One per SOP role:

| Email | Role |
|---|---|
| `requester@ette.local` | Kitchen Requester (Sam Carter) |
| `manager@ette.local` | Kitchen Manager (Maria Lopez) |
| `chef@ette.local` | Executive Chef (Daniel Kim) |
| `gm@ette.local` | General Manager (Grace Thompson) |
| `receiver@ette.local` | Receiver (Alex Roy) |
| `finance@ette.local` | Finance / AP (Priya Patel) |
| `payer@ette.local` | Payment Approver (Olivia Chen) |
| `admin@ette.local` | Admin (Adam Wright) |

Seed data includes his original demo PO (Costco — smoked salmon + milk) as `ETT-PO-0001` in a fully closed state, plus POs at other stages (awaiting GM approval, in transit, partially received with an open short-delivery exception, and an invoice ready to match) so the dashboard and process map are alive on first login.

### Try the full cycle

1. Sign in as the **Requester**, create a request (e.g. Costco, milk + salmon ≈ $400), open the PO and **Submit**.
2. Try **Send** before approval — it's blocked. Sign in as the **Kitchen Manager** and approve, then send.
3. As the **Receiver**, record the delivery. As **Finance**, capture the matching invoice and run the **three-way match**.
4. As the **GM**, approve the invoice (the manager who approved the PO can't), as the **Payment Approver** approve payment, as **Finance** record the payment, then close the PO.

Run the automated version of exactly this walkthrough any time:

```bash
npm start &          # in one terminal
npm run smoke        # 37 assertions, happy path + exception path
```

## Boundaries (from the SOP itself)

- No live Toast/MarginEdge integration in v1: MarginEdge's PO workflow was not enabled at ette, and MarginEdge Bill Pay supports US bank accounts / USD only — so v1 runs the SOP's controlled process as a standalone system with clean integration points for later.
- No real payments are executed and no real emails are sent to vendors; sending is recorded as "marked sent + confirmation note".
- All amounts are CAD.

## Project layout

```
client/            React + TypeScript client (pages per workflow area)
server/src/        Express API (app.js), SQLite schema + seed (db.js)
scripts/smoke.mjs  Full-cycle API smoke test (also run in CI)
.github/workflows/ CI: install, build, boot API, smoke test
```
