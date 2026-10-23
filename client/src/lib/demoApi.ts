/**
 * Demo-mode API layer (GitHub Pages build).
 *
 * A faithful in-browser port of the Express + SQLite API in server/src:
 * same routes, same validation and error messages, same SOP business rules
 * (CAD approval tiers, send-block, duplicate-invoice block, three-way match,
 * separation of duties, close-only-when-reconciled) and the same seed data
 * as server/src/db.js. State persists in localStorage; resetDemoData()
 * restores the pristine seed.
 *
 * Only used when the client is built with VITE_DEMO=1. The real deployment
 * talks to the Express server instead — nothing here runs in that build.
 */

const DB_KEY = 'ette-demo-db-v1';
export const DEMO_PASSWORD = 'demo1234';

const ROLE_LABELS: Record<string, string> = {
  requester: 'Kitchen Requester', kitchen_manager: 'Kitchen Manager', executive_chef: 'Executive Chef',
  gm: 'General Manager', receiver: 'Receiver', finance: 'Finance / AP', payment_approver: 'Payment Approver', admin: 'Admin',
};
const AUTHORITY: Record<string, number> = {
  requester: 0, receiver: 0, finance: 0, payment_approver: 0,
  kitchen_manager: 500, executive_chef: 2000, gm: Infinity, admin: Infinity,
};
const APPROVER_ROLES = ['kitchen_manager', 'executive_chef', 'gm', 'admin'];
const EXCEPTION_TYPES = ['short_delivery', 'damaged_or_rejected', 'substitute', 'price_variance', 'quantity_mismatch', 'no_po', 'duplicate_invoice', 'emergency', 'other'];

type Row = Record<string, any>;
interface DB {
  users: Row[]; vendors: Row[]; items: Row[];
  requests: Row[]; requestLines: Row[];
  pos: Row[]; poLines: Row[];
  receipts: Row[]; receiptLines: Row[];
  invoices: Row[]; invoiceLines: Row[];
  exceptions: Row[]; payments: Row[]; audit: Row[];
  settings: Record<string, string>;
  counters: Record<string, number>;
}

const round2 = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const nowStr = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const nowISO = () => new Date().toISOString();
const dateStr = (d: Date) => d.toISOString().slice(0, 10);
const todayStr = () => dateStr(new Date());
const daysAgoStr = (n: number) => new Date(Date.now() - n * 864e5).toISOString().replace('T', ' ').slice(0, 19);
const daysFromNowDate = (n: number) => dateStr(new Date(Date.now() + n * 864e5));

/* ------------------------------ seed (mirrors server/src/db.js) ------------------------------ */

function seedDB(): DB {
  const db: DB = {
    users: [], vendors: [], items: [], requests: [], requestLines: [], pos: [], poLines: [],
    receipts: [], receiptLines: [], invoices: [], invoiceLines: [], exceptions: [], payments: [],
    audit: [], settings: { approval_tier1_max: '500', approval_tier2_max: '2000', po_prefix: 'ETT-PO-' },
    counters: { po: 0, request: 0, exception: 0 },
  };
  const userRows: Array<[string, string, string]> = [
    ['Adam Wright', 'admin@ette.local', 'admin'],
    ['Sam Carter', 'requester@ette.local', 'requester'],
    ['Maria Lopez', 'manager@ette.local', 'kitchen_manager'],
    ['Daniel Kim', 'chef@ette.local', 'executive_chef'],
    ['Grace Thompson', 'gm@ette.local', 'gm'],
    ['Alex Roy', 'receiver@ette.local', 'receiver'],
    ['Priya Patel', 'finance@ette.local', 'finance'],
    ['Olivia Chen', 'payer@ette.local', 'payment_approver'],
  ];
  const U: Record<string, number> = {};
  userRows.forEach(([name, email, role], i) => { U[role] = i + 1; db.users.push({ id: i + 1, name, email, role, active: 1 }); });

  const vendorRows: Array<[string, string, string, string, string, string, number, string, string]> = [
    ['Costco Wholesale', 'Business Centre Desk', 'orders@costco-example.ca', '905-555-0100', 'Net 30', 'Mon/Wed/Fri', 200, 'Warehouse Club — Business Centre', 'Bulk dry goods, dairy and disposables'],
    ['Gordon Food Service', 'Nadia Brooks', 'orders@gfs-example.ca', '905-555-0111', 'Net 30', 'Tue/Fri', 350, 'GTA distribution centre', 'Broadline foodservice distributor'],
    ['Sysco Canada', 'Mark Ellery', 'orders@sysco-example.ca', '416-555-0142', 'Net 21', 'Mon/Thu', 300, 'Toronto distribution centre', 'Broadline + proteins'],
    ['Fresh Valley Produce', 'Luca Romano', 'sales@freshvalley-example.ca', '416-555-0177', 'Net 14', 'Daily', 75, 'Ontario Food Terminal', 'Fresh produce, daily delivery'],
    ['CleanPro Supplies', 'Erin Walsh', 'orders@cleanpro-example.ca', '905-555-0139', 'Net 30', 'Wed', 100, 'Industrial supply depot', 'Cleaning chemicals and disposables'],
  ];
  const V: Record<string, number> = { costco: 1, gfs: 2, sysco: 3, produce: 4, cleanpro: 5 };
  vendorRows.forEach(([name, contact_name, email, phone, terms, delivery_days, min_order, address, notes], i) =>
    db.vendors.push({ id: i + 1, name, contact_name, email, phone, terms, delivery_days, min_order, address, notes, active: 1 }));

  const itemRows: Array<[number, string, string, string, string, number, number, number]> = [
    [V.costco, 'Smoked salmon', 'Whole side, ~40cm', 'bag', 'Food ingredients', 5.0, 30, 8],
    [V.costco, 'Milk 2%', '4L x 4 per box, 40kg case', 'box', 'Food ingredients', 15.0, 40, 12],
    [V.costco, 'Nitrile gloves', 'Box of 100, size M', 'box', 'Disposable supplies', 12.5, 20, 6],
    [V.gfs, 'Chicken breast', 'Boneless skinless, 10kg case', 'case', 'Food ingredients', 68.0, 12, 5],
    [V.gfs, 'Roma tomatoes', '25lb case', 'case', 'Food ingredients', 32.0, 10, 4],
    [V.gfs, 'Heavy cream 35%', '12 x 1L', 'case', 'Food ingredients', 54.0, 8, 3],
    [V.sysco, 'Atlantic salmon fillets', 'Fresh, 4-5lb fillets, 10lb case', 'case', 'Food ingredients', 145.0, 6, 2],
    [V.sysco, 'All-purpose flour', '20kg bag', 'bag', 'Food ingredients', 21.0, 15, 7],
    [V.produce, 'Lemons', '140 count case', 'case', 'Food ingredients', 58.0, 5, 2],
    [V.produce, 'Fresh basil', '1lb clamshell x 6', 'case', 'Food ingredients', 24.0, 8, 3],
    [V.cleanpro, 'Dishwasher detergent', '10L pail, kitchen-safe', 'pail', 'Cleaning and sanitation', 86.0, 6, 2],
    [V.cleanpro, 'Sanitizer concentrate', '4 x 4L', 'case', 'Cleaning and sanitation', 119.0, 4, 1],
    [V.cleanpro, 'Paper towels', '12-roll case', 'case', 'Disposable supplies', 39.0, 10, 4],
  ];
  itemRows.forEach(([vendor_id, name, spec, unit, category, guide_price, par_level, on_hand], i) =>
    db.items.push({ id: i + 1, vendor_id, name, spec, unit, category, guide_price, par_level, on_hand, active: 1 }));

  let polId = 0, rlId = 0, rclId = 0, ilId = 0;
  function makePO(num: number, vendorId: number, requesterRole: string, category: string,
    lines: Array<[string, string, string, number, number]>, freight: number, tax: number,
    status: string, reqStatus: string, approverRole: string | null, daysAgo: number, extra: Row = {}) {
    const subtotal = round2(lines.reduce((s, l) => s + l[3] * l[4], 0));
    const total = round2(subtotal + freight + tax);
    const reqId = num;
    db.requests.push({
      id: reqId, ref: 'REQ-' + String(num).padStart(4, '0'), type: extra.type || 'routine',
      requester_id: U[requesterRole], vendor_id: vendorId, category, reason: extra.reason || 'Restock to par',
      needed_by: null, status: reqStatus, emergency_authorizer: null, emergency_time: null, emergency_reason: null,
      created_at: daysAgoStr(daysAgo),
    });
    for (const l of lines) db.requestLines.push({ id: ++rlId, request_id: reqId, item_id: null, item_name: l[0], spec: l[1], unit: l[2], qty: l[3], est_unit_price: l[4] });
    const poId = num;
    db.pos.push({
      id: poId, po_number: 'ETT-PO-' + String(num).padStart(4, '0'), request_id: reqId, vendor_id: vendorId,
      requester_id: U[requesterRole], category, status, subtotal, discount: 0, freight, tax, total,
      delivery_date: null, order_date: extra.orderDate || null, vendor_confirmation: extra.confirmation || null,
      required_approver_role: extra.requiredRole || null, approver_id: approverRole ? U[approverRole] : null,
      approved_at: approverRole ? new Date(Date.now() - daysAgo * 864e5).toISOString() : null,
      approval_comment: null, split_warning: null, created_at: daysAgoStr(daysAgo), closed_at: null,
    });
    for (const l of lines) db.poLines.push({ id: ++polId, po_id: poId, item_id: null, item_name: l[0], spec: l[1], unit: l[2], qty: l[3], unit_price: l[4], line_total: round2(l[3] * l[4]) });
    db.counters.po = Math.max(db.counters.po, num);
    db.counters.request = Math.max(db.counters.request, num);
    return poId;
  }

  // ETT-PO-0001 — Costco demo PO, full cycle → closed
  const po1 = makePO(1, V.costco, 'requester', 'Food ingredients',
    [['Smoked salmon', 'Whole side, ~40cm', 'bag', 20, 5], ['Milk 2%', '4L x 4 per box, 40kg case', 'box', 21, 15]],
    0, 0, 'closed', 'approved', 'kitchen_manager', 9, { orderDate: '2026-10-14', confirmation: 'Confirmed by vendor email', requiredRole: 'kitchen_manager' });
  const po1Lines = db.poLines.filter(l => l.po_id === po1);
  db.receipts.push({ id: 1, po_id: po1, receiver_id: U.receiver, delivery_slip: 'DS-88123', received_at: daysAgoStr(8), notes: 'Full delivery, quality OK' });
  for (const l of po1Lines) db.receiptLines.push({ id: ++rclId, receipt_id: 1, po_line_id: l.id, item_name: l.item_name, qty_ordered: l.qty, qty_accepted: l.qty, qty_rejected: 0, quality_check: 'Pass', temperature: '3C', expiry: '', issue: '', action: '' });
  db.invoices.push({
    id: 1, po_id: po1, vendor_id: V.costco, invoice_number: 'INV-C-1001', invoice_date: '2026-10-15', due_date: '2026-11-14',
    subtotal: 415, tax: 0, total: 415, status: 'paid', captured_by: U.finance, match_status: 'pass', match_result: null,
    matched_at: '2026-10-15', invoice_approver_id: U.finance, invoice_approved_at: '2026-10-15',
    payment_approver_id: U.payment_approver, payment_approved_at: '2026-10-16', created_at: '2026-10-15 09:00:00',
  });
  for (const l of po1Lines) db.invoiceLines.push({ id: ++ilId, invoice_id: 1, item_name: l.item_name, qty: l.qty, unit_price: l.unit_price, line_total: l.line_total });
  db.payments.push({ id: 1, invoice_id: 1, po_id: po1, amount: 415, payment_date: '2026-10-16', reference: 'EFT-2026-1016', scheduled_by: U.finance, approved_by: U.payment_approver, status: 'paid', created_at: '2026-10-16 09:00:00' });

  // ETT-PO-0002 — GFS, EC tier, received, invoice captured (awaiting match)
  const po2 = makePO(2, V.gfs, 'requester', 'Food ingredients',
    [['Chicken breast', 'Boneless skinless, 10kg case', 'case', 10, 68], ['Roma tomatoes', '25lb case', 'case', 12, 32], ['Heavy cream 35%', '12 x 1L', 'case', 7, 54]],
    25, 0, 'invoice_captured', 'approved', 'executive_chef', 4, { orderDate: '2026-10-20', confirmation: 'Confirmed', requiredRole: 'executive_chef' });
  const po2Lines = db.poLines.filter(l => l.po_id === po2);
  db.receipts.push({ id: 2, po_id: po2, receiver_id: U.receiver, delivery_slip: 'DS-90210', received_at: daysAgoStr(2), notes: 'All accepted' });
  for (const l of po2Lines) db.receiptLines.push({ id: ++rclId, receipt_id: 2, po_line_id: l.id, item_name: l.item_name, qty_ordered: l.qty, qty_accepted: l.qty, qty_rejected: 0, quality_check: 'Pass', temperature: '2C', expiry: '', issue: '', action: '' });
  db.invoices.push({
    id: 2, po_id: po2, vendor_id: V.gfs, invoice_number: 'INV-G-5520', invoice_date: '2026-10-21', due_date: '2026-11-20',
    subtotal: 1467, tax: 0, total: 1467, status: 'captured', captured_by: U.finance, match_status: null, match_result: null,
    matched_at: null, invoice_approver_id: null, invoice_approved_at: null, payment_approver_id: null, payment_approved_at: null,
    created_at: '2026-10-21 09:00:00',
  });
  db.invoiceLines.push(
    { id: ++ilId, invoice_id: 2, item_name: 'Chicken breast', qty: 10, unit_price: 68, line_total: 680 },
    { id: ++ilId, invoice_id: 2, item_name: 'Roma tomatoes', qty: 12, unit_price: 32, line_total: 384 },
    { id: ++ilId, invoice_id: 2, item_name: 'Heavy cream 35%', qty: 7, unit_price: 54, line_total: 378 },
    { id: ++ilId, invoice_id: 2, item_name: 'Freight / delivery', qty: 1, unit_price: 25, line_total: 25 },
  );

  // ETT-PO-0003 — produce, sent, awaiting receiving
  makePO(3, V.produce, 'requester', 'Food ingredients',
    [['Lemons', '140 count case', 'case', 3, 58], ['Fresh basil', '1lb clamshell x 6', 'case', 5, 24]],
    0, 26.46, 'sent', 'approved', 'kitchen_manager', 1, { orderDate: '2026-10-23', confirmation: 'Confirmed for morning delivery', requiredRole: 'kitchen_manager' });

  // ETT-PO-0004 — CleanPro, > $2,000, pending GM approval
  makePO(4, V.cleanpro, 'executive_chef', 'Cleaning and sanitation',
    [['Dishwasher detergent', '10L pail, kitchen-safe', 'pail', 14, 86], ['Sanitizer concentrate', '4 x 4L', 'case', 10, 119], ['Paper towels', '12-roll case', 'case', 8, 39]],
    40, 0, 'pending_approval', 'submitted', null, 0, { requiredRole: 'gm' });

  // ETT-PO-0005 — Sysco, short delivery with an open exception
  const po5 = makePO(5, V.sysco, 'requester', 'Food ingredients',
    [['Atlantic salmon fillets', 'Fresh, 4-5lb fillets, 10lb case', 'case', 4, 145], ['All-purpose flour', '20kg bag', 'bag', 10, 21]],
    15, 0, 'exception', 'approved', 'executive_chef', 3, { orderDate: '2026-10-21', confirmation: 'Confirmed', requiredRole: 'executive_chef' });
  const po5Lines = db.poLines.filter(l => l.po_id === po5).sort((a, b) => a.id - b.id);
  db.receipts.push({ id: 3, po_id: po5, receiver_id: U.receiver, delivery_slip: 'DS-77541', received_at: daysAgoStr(1), notes: 'Salmon short by 1 case' });
  db.receiptLines.push(
    { id: ++rclId, receipt_id: 3, po_line_id: po5Lines[0].id, item_name: po5Lines[0].item_name, qty_ordered: 4, qty_accepted: 3, qty_rejected: 0, quality_check: 'Pass', temperature: '1C', expiry: '', issue: 'Short delivery: 1 case missing', action: 'Credit requested from vendor' },
    { id: ++rclId, receipt_id: 3, po_line_id: po5Lines[1].id, item_name: po5Lines[1].item_name, qty_ordered: 10, qty_accepted: 10, qty_rejected: 0, quality_check: 'Pass', temperature: '', expiry: '', issue: '', action: '' },
  );
  db.counters.exception = 1;
  db.exceptions.push({
    id: 1, ref: 'EXC-0001', po_id: po5, invoice_id: null, vendor_id: V.sysco, type: 'short_delivery',
    description: 'Atlantic salmon fillets: ordered 4 cases, received 3. Credit or follow-up delivery requested.',
    disputed_amount: 145, owner_id: U.finance, approver_id: null, due_date: daysFromNowDate(3), status: 'open',
    resolution: null, created_at: daysAgoStr(1), resolved_at: null,
  });

  db.audit.push({ id: 1, user_id: null, user_name: 'system', action: 'seed', entity: 'system', entity_id: '', details: 'Demo data seeded: 8 users, 5 vendors, 13 items, 5 POs (ETT-PO-0001..0005)', created_at: nowStr() });
  return db;
}

/* ------------------------------ store ------------------------------ */

let cache: DB | null = null;
function load(): DB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) { cache = JSON.parse(raw) as DB; return cache; }
  } catch { /* corrupted storage → reseed */ }
  cache = seedDB();
  save();
  return cache;
}
function save() {
  try { if (cache) localStorage.setItem(DB_KEY, JSON.stringify(cache)); } catch { /* storage full/blocked — demo continues in-memory */ }
}
export function resetDemoData() {
  try { localStorage.removeItem(DB_KEY); } catch { /* ignore */ }
  cache = null;
}

const nextId = (rows: Row[]) => rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
function nextVal(db: DB, key: string) { db.counters[key] = (db.counters[key] || 0) + 1; return db.counters[key]; }
function audit(db: DB, user: Row | null, action: string, entity: string, entityId: unknown, details: string) {
  db.audit.push({ id: nextId(db.audit), user_id: user ? user.id : null, user_name: user ? user.name : 'system', action, entity, entity_id: String(entityId ?? ''), details: details || '', created_at: nowStr() });
}

/* ------------------------------ helpers (mirror server) ------------------------------ */

function thresholds(db: DB) {
  return { t1: Number(db.settings.approval_tier1_max || 500), t2: Number(db.settings.approval_tier2_max || 2000) };
}
function requiredRoleFor(db: DB, total: number) {
  const { t1, t2 } = thresholds(db);
  if (total <= t1) return 'kitchen_manager';
  if (total <= t2) return 'executive_chef';
  return 'gm';
}
function userById(db: DB, id: unknown) { return db.users.find(u => u.id === Number(id)) || null; }
function vendorById(db: DB, id: unknown) { return db.vendors.find(v => v.id === Number(id)) || null; }
function poRow(db: DB, id: unknown) { return db.pos.find(p => p.id === Number(id)) || null; }
function publicUser(u: Row) { return { id: u.id, name: u.name, email: u.email, role: u.role, roleLabel: ROLE_LABELS[u.role] }; }

function receivedByLine(db: DB, poId: number) {
  const out: Record<number, { a: number; r: number }> = {};
  for (const l of db.poLines.filter(x => x.po_id === poId)) {
    const lines = db.receiptLines.filter(rl => rl.po_line_id === l.id);
    out[l.id] = {
      a: lines.reduce((s, x) => s + (Number(x.qty_accepted) || 0), 0),
      r: lines.reduce((s, x) => s + (Number(x.qty_rejected) || 0), 0),
    };
  }
  return out;
}
function poDetail(db: DB, id: unknown): Row | null {
  const po = poRow(db, id);
  if (!po) return null;
  const d: Row = { ...po, vendor_name: vendorById(db, po.vendor_id)?.name, requester_name: userById(db, po.requester_id)?.name, approver_name: po.approver_id ? userById(db, po.approver_id)?.name : null };
  d.lines = db.poLines.filter(l => l.po_id === po.id).sort((a, b) => a.id - b.id).map(l => ({ ...l }));
  d.receipts = db.receipts.filter(r => r.po_id === po.id).sort((a, b) => a.id - b.id).map(r => ({
    ...r, receiver_name: userById(db, r.receiver_id)?.name,
    lines: db.receiptLines.filter(rl => rl.receipt_id === r.id).sort((a, b) => a.id - b.id).map(x => ({ ...x })),
  }));
  d.invoices = db.invoices.filter(i => i.po_id === po.id).sort((a, b) => a.id - b.id).map(i => ({
    ...i, lines: db.invoiceLines.filter(il => il.invoice_id === i.id).sort((a, b) => a.id - b.id).map(x => ({ ...x })),
  }));
  d.exceptions = db.exceptions.filter(e => e.po_id === po.id).sort((a, b) => a.id - b.id).map(e => ({ ...e, owner_name: e.owner_id ? userById(db, e.owner_id)?.name : null }));
  d.payments = db.payments.filter(p => p.po_id === po.id).sort((a, b) => a.id - b.id).map(p => ({ ...p }));
  d.receivedByLine = receivedByLine(db, po.id);
  return d;
}
function invoiceDetail(db: DB, id: unknown): Row | null {
  const inv = db.invoices.find(i => i.id === Number(id));
  if (!inv) return null;
  const po = poRow(db, inv.po_id);
  return {
    ...inv, vendor_name: vendorById(db, inv.vendor_id)?.name, po_number: po?.po_number,
    po_total: po?.total, po_approver_id: po?.approver_id, po_requester_id: po?.requester_id,
    lines: db.invoiceLines.filter(il => il.invoice_id === inv.id).sort((a, b) => a.id - b.id).map(x => ({ ...x })),
  };
}
function stageCounts(db: DB) {
  const get = (s: string) => db.pos.filter(p => p.status === s).length;
  return {
    requests: db.requests.filter(r => r.status !== 'draft').length,
    pendingApproval: get('pending_approval'), approved: get('approved'),
    sent: get('sent'), partiallyReceived: get('partially_received'), received: get('received'),
    invoiceCaptured: get('invoice_captured'), matched: get('matched'), exception: get('exception'),
    invoiceApproved: get('invoice_approved'), paymentApproved: get('payment_approved'),
    paid: get('paid'), closed: get('closed'), draft: get('draft'),
    openExceptions: db.exceptions.filter(e => e.status !== 'resolved').length,
  };
}
function splitWarningFor(db: DB, userId: number, vendorId: number, total: number) {
  const others = db.pos
    .filter(p => p.requester_id === userId && p.vendor_id === vendorId && String(p.created_at).slice(0, 10) === todayStr())
    .reduce((s, p) => s + (Number(p.total) || 0), 0);
  const { t1, t2 } = thresholds(db);
  const combined = others + total;
  for (const t of [t1, t2]) {
    if (total <= t && combined > t)
      return `Split-PO warning: your POs to this vendor today total CAD $${combined.toFixed(2)}, crossing the $${t} approval tier, while this PO alone is $${total.toFixed(2)}. Related purchases for the same need must be assessed together (SOP: do not split orders to bypass approval limits).`;
  }
  return null;
}

type Resp = { status: number; data: any };
const ok = (data: any, status = 200): Resp => ({ status, data });
const err = (status: number, error: string): Resp => ({ status, data: { error } });

/* ------------------------------ router ------------------------------ */

export async function demoApi(method: string, path: string, body?: any): Promise<Resp> {
  const db = load();
  const res = route(db, method.toUpperCase(), path, body);
  if (method.toUpperCase() !== 'GET') save();
  return res;
}

function route(db: DB, method: string, rawPath: string, body: any): Resp {
  const [pathname, qs] = rawPath.split('?');
  const query = new URLSearchParams(qs || '');
  const seg = pathname.split('/').filter(Boolean); // e.g. ['api','pos','3','approve']

  /* public */
  if (method === 'GET' && pathname === '/api/health') return ok({ ok: true });
  if (method === 'POST' && pathname === '/api/auth/login') {
    const email = String(body?.email || '').toLowerCase();
    const user = db.users.find(u => u.email === email);
    if (!user || String(body?.password || '') !== DEMO_PASSWORD)
      return err(401, 'Invalid email or password');
    audit(db, user, 'login', 'user', user.id, 'Signed in');
    return ok({ token: `demo-token-${user.id}`, user: publicUser(user) });
  }

  /* auth (token is a demo artifact: demo-token-<userId>) */
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('ette-token') : null;
  const m = token ? /^demo-token-(\d+)$/.exec(token) : null;
  const me = m ? userById(db, Number(m[1])) : null;
  if (!token) return err(401, 'Missing token');
  if (!me || !me.active) return err(401, 'Invalid user');
  const requireRole = (...roles: string[]) =>
    roles.includes(me.role) || me.role === 'admin' ? null : err(403, `Role ${me.role} is not allowed to do this`);

  if (method === 'GET' && pathname === '/api/auth/me') return ok({ user: { ...publicUser(me), active: 1 } });

  /* reference data */
  if (method === 'GET' && pathname === '/api/users')
    return ok(db.users.filter(u => u.active).sort((a, b) => a.name.localeCompare(b.name)).map(u => ({ id: u.id, name: u.name, role: u.role, email: u.email, roleLabel: ROLE_LABELS[u.role] })));
  if (method === 'GET' && pathname === '/api/vendors')
    return ok(db.vendors.filter(v => v.active).sort((a, b) => a.name.localeCompare(b.name)).map(v => ({ ...v })));
  if (method === 'POST' && pathname === '/api/vendors') {
    const denied = requireRole('kitchen_manager', 'executive_chef', 'gm'); if (denied) return denied;
    const b = body || {};
    if (!b.name) return err(400, 'Vendor name is required');
    const v = { id: nextId(db.vendors), name: b.name, contact_name: b.contact_name || '', email: b.email || '', phone: b.phone || '', terms: b.terms || 'Net 30', delivery_days: b.delivery_days || '', min_order: Number(b.min_order) || 0, address: b.address || '', notes: b.notes || '', active: 1 };
    db.vendors.push(v);
    audit(db, me, 'create', 'vendor', v.id, `Vendor created: ${b.name}`);
    return ok({ ...v }, 201);
  }
  if (method === 'PATCH' && seg[1] === 'vendors') {
    const denied = requireRole('kitchen_manager', 'executive_chef', 'gm'); if (denied) return denied;
    const v = vendorById(db, seg[2]);
    if (!v) return err(404, 'Vendor not found');
    const b = { ...v, ...(body || {}) };
    Object.assign(v, { name: b.name, contact_name: b.contact_name, email: b.email, phone: b.phone, terms: b.terms, delivery_days: b.delivery_days, min_order: Number(b.min_order) || 0, address: b.address, notes: b.notes });
    audit(db, me, 'update', 'vendor', v.id, `Vendor updated: ${b.name}`);
    return ok({ ...v });
  }
  if (method === 'GET' && pathname === '/api/items') {
    const vid = query.get('vendor_id');
    return ok(db.items.filter(i => i.active && (!vid || i.vendor_id === Number(vid))).sort((a, b) => a.name.localeCompare(b.name)).map(i => ({ ...i })));
  }
  if (method === 'POST' && pathname === '/api/items') {
    const denied = requireRole('kitchen_manager', 'executive_chef', 'gm'); if (denied) return denied;
    const b = body || {};
    if (!b.name || !b.vendor_id) return err(400, 'Item name and vendor are required');
    const it = { id: nextId(db.items), vendor_id: Number(b.vendor_id), name: b.name, spec: b.spec || '', unit: b.unit || '', category: b.category || '', guide_price: Number(b.guide_price) || 0, par_level: Number(b.par_level) || 0, on_hand: Number(b.on_hand) || 0, active: 1 };
    db.items.push(it);
    audit(db, me, 'create', 'item', it.id, `Item created: ${b.name}`);
    return ok({ ...it }, 201);
  }
  if (method === 'PATCH' && seg[1] === 'items') {
    const it = db.items.find(i => i.id === Number(seg[2]));
    if (!it) return err(404, 'Item not found');
    const b = { ...it, ...(body || {}) };
    Object.assign(it, { name: b.name, spec: b.spec, unit: b.unit, category: b.category, guide_price: Number(b.guide_price) || 0, par_level: Number(b.par_level) || 0, on_hand: Number(b.on_hand) || 0 });
    return ok({ ...it });
  }

  /* requests */
  if (method === 'POST' && pathname === '/api/requests') {
    const b = body || {};
    const lines = Array.isArray(b.lines) ? b.lines.filter((l: any) => l.item_name && Number(l.qty) > 0) : [];
    if (!b.vendor_id) return err(400, 'Vendor is required');
    if (!lines.length) return err(400, 'At least one line item is required');
    const type = b.type === 'emergency' ? 'emergency' : 'routine';
    if (type === 'emergency' && (!b.emergency_authorizer || !b.emergency_time || !b.emergency_reason))
      return err(400, 'Emergency purchases require a documented authorizer, authorization time, and reason (SOP Step 2).');
    const vendor = vendorById(db, b.vendor_id);
    if (!vendor) return err(400, 'Vendor not found');
    const subtotal = round2(lines.reduce((s: number, l: any) => s + Number(l.qty) * Number(l.est_unit_price || 0), 0));
    const freight = round2(b.freight), tax = round2(b.tax), discount = round2(b.discount);
    const total = round2(subtotal - discount + freight + tax);
    const ref = 'REQ-' + String(nextVal(db, 'request')).padStart(4, '0');
    const reqId = nextId(db.requests);
    const req: Row = {
      id: reqId, ref, type, requester_id: me.id, vendor_id: Number(b.vendor_id), category: b.category || '',
      reason: b.reason || '', needed_by: b.needed_by || null, status: 'submitted',
      emergency_authorizer: b.emergency_authorizer || null, emergency_time: b.emergency_time || null,
      emergency_reason: b.emergency_reason || null, created_at: nowStr(),
    };
    db.requests.push(req);
    for (const l of lines) db.requestLines.push({ id: nextId(db.requestLines), request_id: reqId, item_id: l.item_id || null, item_name: l.item_name, spec: l.spec || '', unit: l.unit || '', qty: Number(l.qty), est_unit_price: Number(l.est_unit_price) || 0 });
    const prefix = db.settings.po_prefix || 'ETT-PO-';
    const poNumber = prefix + String(nextVal(db, 'po')).padStart(4, '0');
    const warning = splitWarningFor(db, me.id, Number(b.vendor_id), total);
    const poId = nextId(db.pos);
    db.pos.push({
      id: poId, po_number: poNumber, request_id: reqId, vendor_id: Number(b.vendor_id), requester_id: me.id,
      category: b.category || '', status: 'draft', subtotal, discount, freight, tax, total,
      delivery_date: b.delivery_date || null, order_date: null, vendor_confirmation: null,
      required_approver_role: requiredRoleFor(db, total), approver_id: null, approved_at: null,
      approval_comment: null, split_warning: warning, created_at: nowStr(), closed_at: null,
    });
    for (const l of lines) db.poLines.push({ id: nextId(db.poLines), po_id: poId, item_id: l.item_id || null, item_name: l.item_name, spec: l.spec || '', unit: l.unit || '', qty: Number(l.qty), unit_price: Number(l.est_unit_price) || 0, line_total: round2(Number(l.qty) * Number(l.est_unit_price || 0)) });
    audit(db, me, 'create', 'purchase_request', ref, `${type} request created for ${vendor.name}, total CAD $${total.toFixed(2)}`);
    audit(db, me, 'create', 'purchase_order', poNumber, `PO drafted from ${ref} — status: draft`);
    if (warning) audit(db, me, 'warning', 'purchase_order', poNumber, warning);
    return ok({ request: { ...req }, po: poDetail(db, poId), splitWarning: warning }, 201);
  }
  if (method === 'GET' && pathname === '/api/requests') {
    return ok([...db.requests].sort((a, b) => b.id - a.id).map(r => {
      const po = db.pos.find(p => p.request_id === r.id);
      return { ...r, requester_name: userById(db, r.requester_id)?.name, vendor_name: vendorById(db, r.vendor_id)?.name, po_number: po?.po_number ?? null, po_id: po?.id ?? null, total: po?.total ?? null };
    }));
  }
  if (method === 'GET' && seg[1] === 'requests' && seg.length === 3) {
    const r = db.requests.find(x => x.id === Number(seg[2]));
    if (!r) return err(404, 'Request not found');
    const po = db.pos.find(p => p.request_id === r.id);
    return ok({
      ...r, requester_name: userById(db, r.requester_id)?.name, vendor_name: vendorById(db, r.vendor_id)?.name,
      lines: db.requestLines.filter(l => l.request_id === r.id).map(l => ({ ...l })),
      po: po ? poDetail(db, po.id) : null,
    });
  }

  /* purchase orders */
  if (method === 'GET' && pathname === '/api/pos')
    return ok([...db.pos].sort((a, b) => b.id - a.id).map(p => ({ ...p, vendor_name: vendorById(db, p.vendor_id)?.name, requester_name: userById(db, p.requester_id)?.name })));
  if (method === 'GET' && seg[1] === 'pos' && seg.length === 3) {
    const po = poDetail(db, seg[2]);
    if (!po) return err(404, 'PO not found');
    return ok(po);
  }
  if (method === 'POST' && seg[1] === 'pos' && seg[3] === 'submit') {
    const po = poRow(db, seg[2]);
    if (!po) return err(404, 'PO not found');
    if (po.status !== 'draft') return err(409, `Only a draft PO can be submitted (current: ${po.status})`);
    po.status = 'pending_approval';
    const rq = db.requests.find(r => r.id === po.request_id); if (rq) rq.status = 'submitted';
    audit(db, me, 'submit', 'purchase_order', po.po_number, `Submitted for approval — requires ${ROLE_LABELS[po.required_approver_role]} (CAD $${po.total.toFixed(2)})`);
    return ok(poDetail(db, po.id));
  }
  if (method === 'POST' && seg[1] === 'pos' && seg[3] === 'approve') {
    const po = poRow(db, seg[2]);
    if (!po) return err(404, 'PO not found');
    if (po.status !== 'pending_approval') return err(409, `PO is not pending approval (current: ${po.status})`);
    if (!APPROVER_ROLES.includes(me.role))
      return err(403, `Your role (${ROLE_LABELS[me.role]}) cannot approve purchase orders. This PO requires ${ROLE_LABELS[po.required_approver_role]}.`);
    if ((AUTHORITY[me.role] ?? 0) < po.total)
      return err(403, `This PO totals CAD $${po.total.toFixed(2)}, above your approval authority. It requires ${ROLE_LABELS[po.required_approver_role]}.`);
    if (me.id === po.requester_id && po.total > (AUTHORITY[me.role] ?? 0))
      return err(403, 'You cannot approve your own purchase above your own authority.');
    po.status = 'approved'; po.approver_id = me.id; po.approved_at = nowStr(); po.approval_comment = body?.comment || '';
    const rq = db.requests.find(r => r.id === po.request_id); if (rq) rq.status = 'approved';
    audit(db, me, 'approve', 'purchase_order', po.po_number, `Approved CAD $${po.total.toFixed(2)}${body?.comment ? ' — ' + body.comment : ''}`);
    return ok(poDetail(db, po.id));
  }
  if (method === 'POST' && seg[1] === 'pos' && seg[3] === 'reject') {
    const po = poRow(db, seg[2]);
    if (!po) return err(404, 'PO not found');
    if (po.status !== 'pending_approval') return err(409, `PO is not pending approval (current: ${po.status})`);
    if (!APPROVER_ROLES.includes(me.role)) return err(403, 'Your role cannot review purchase orders.');
    po.status = 'draft'; po.approval_comment = body?.comment || 'Rejected';
    audit(db, me, 'reject', 'purchase_order', po.po_number, `Sent back to draft — ${body?.comment || 'no comment'}`);
    return ok(poDetail(db, po.id));
  }
  if (method === 'POST' && seg[1] === 'pos' && seg[3] === 'send') {
    const po = poRow(db, seg[2]);
    if (!po) return err(404, 'PO not found');
    if (po.status !== 'approved')
      return err(409, 'Blocked: a routine order cannot be sent to the supplier before its PO is approved (SOP non-negotiable rule).');
    po.status = 'sent'; po.order_date = todayStr(); po.vendor_confirmation = body?.confirmation || 'Order sent to vendor';
    audit(db, me, 'send', 'purchase_order', po.po_number, `Order sent to vendor — ${body?.confirmation || 'no confirmation note'}`);
    return ok(poDetail(db, po.id));
  }
  if (method === 'POST' && seg[1] === 'pos' && seg[3] === 'receive') {
    const denied = requireRole('receiver', 'kitchen_manager', 'executive_chef', 'gm'); if (denied) return denied;
    const po = poRow(db, seg[2]);
    if (!po) return err(404, 'PO not found');
    if (!['sent', 'partially_received'].includes(po.status))
      return err(409, `PO must be sent before receiving (current: ${po.status})`);
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    if (!lines.length) return err(400, 'Receiving lines are required');
    const receiptId = nextId(db.receipts);
    db.receipts.push({ id: receiptId, po_id: po.id, receiver_id: me.id, delivery_slip: body.delivery_slip || '', received_at: nowStr(), notes: body.notes || '' });
    const newExceptions: Array<{ type: string; desc: string; amount: number }> = [];
    for (const l of lines) {
      const pl = db.poLines.find(x => x.id === Number(l.po_line_id) && x.po_id === po.id);
      if (!pl) continue;
      const acc = Number(l.qty_accepted) || 0, rej = Number(l.qty_rejected) || 0;
      db.receiptLines.push({ id: nextId(db.receiptLines), receipt_id: receiptId, po_line_id: pl.id, item_name: pl.item_name, qty_ordered: pl.qty, qty_accepted: acc, qty_rejected: rej, quality_check: l.quality_check || '', temperature: l.temperature || '', expiry: l.expiry || '', issue: l.issue || '', action: l.action || '' });
      if (pl.item_id) { const it = db.items.find(i => i.id === pl.item_id); if (it) it.on_hand = (Number(it.on_hand) || 0) + acc; }
      if (rej > 0) newExceptions.push({ type: 'damaged_or_rejected', desc: `${pl.item_name}: ${rej} ${pl.unit || ''} rejected/damaged at receiving. ${l.issue || ''}`.trim(), amount: round2(rej * pl.unit_price) });
    }
    const isFinal = body?.final === true;
    const totals = receivedByLine(db, po.id);
    let complete = true;
    for (const pl of db.poLines.filter(x => x.po_id === po.id)) {
      const t = totals[pl.id] || { a: 0, r: 0 };
      if (t.a + t.r < pl.qty - 1e-9 && !isFinal) complete = false;
      else if (t.a < pl.qty - 1e-9) {
        const already = db.exceptions.find(e => e.po_id === po.id && e.type === 'short_delivery' && String(e.description || '').includes(pl.item_name));
        if (!already) newExceptions.push({ type: 'short_delivery', desc: `${pl.item_name}: ordered ${pl.qty}, accepted ${t.a} — short delivery.`, amount: round2((pl.qty - t.a) * pl.unit_price) });
      }
    }
    for (const e of newExceptions) {
      const ref = 'EXC-' + String(nextVal(db, 'exception')).padStart(4, '0');
      db.exceptions.push({ id: nextId(db.exceptions), ref, po_id: po.id, invoice_id: null, vendor_id: po.vendor_id, type: e.type, description: e.desc, disputed_amount: e.amount, owner_id: me.id, approver_id: null, due_date: null, status: 'open', resolution: null, created_at: nowStr(), resolved_at: null });
    }
    po.status = complete ? 'received' : 'partially_received';
    audit(db, me, 'receive', 'purchase_order', po.po_number, `Delivery received (slip ${body.delivery_slip || 'n/a'}) — PO now ${complete ? 'fully received' : 'partially received'}${newExceptions.length ? `; ${newExceptions.length} exception(s) opened` : ''}`);
    return ok(poDetail(db, po.id), 201);
  }
  if (method === 'POST' && seg[1] === 'pos' && seg[3] === 'close') {
    const po = poRow(db, seg[2]);
    if (!po) return err(404, 'PO not found');
    if (po.status !== 'paid') return err(409, `PO can only be closed after payment (current: ${po.status})`);
    const open = db.exceptions.filter(e => e.po_id === po.id && e.status !== 'resolved').length;
    if (open > 0) return err(409, `PO has ${open} unresolved exception(s). Resolve them before closing.`);
    po.status = 'closed'; po.closed_at = nowStr();
    audit(db, me, 'close', 'purchase_order', po.po_number, 'PO closed — delivery, invoice and payment reconciled');
    return ok(poDetail(db, po.id));
  }

  /* invoices + three-way match */
  if (method === 'POST' && pathname === '/api/invoices') {
    const denied = requireRole('finance'); if (denied) return denied;
    const b = body || {};
    const po = poRow(db, b.po_id);
    if (!po) return err(404, 'PO not found');
    if (!b.invoice_number) return err(400, 'Invoice number is required');
    if (!['received', 'partially_received', 'invoice_captured', 'exception'].includes(po.status))
      return err(409, `Invoices can only be captured against a received PO (current: ${po.status})`);
    const dup = db.invoices.find(i => i.vendor_id === po.vendor_id && i.invoice_number === b.invoice_number);
    if (dup) return err(409, `Duplicate invoice blocked: invoice ${b.invoice_number} from this vendor is already recorded (Invoice #${dup.id}, status ${dup.status}). Do not pay twice — investigate before proceeding.`);
    const lines = Array.isArray(b.lines) ? b.lines.filter((l: any) => l.item_name) : [];
    const subtotal = round2(lines.reduce((s: number, l: any) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0));
    const tax = round2(b.tax), total = round2(subtotal + tax);
    const invId = nextId(db.invoices);
    db.invoices.push({
      id: invId, po_id: po.id, vendor_id: po.vendor_id, invoice_number: b.invoice_number, invoice_date: b.invoice_date || null,
      due_date: b.due_date || null, subtotal, tax, total, status: 'captured', captured_by: me.id, match_status: null,
      match_result: null, matched_at: null, invoice_approver_id: null, invoice_approved_at: null,
      payment_approver_id: null, payment_approved_at: null, created_at: nowStr(),
    });
    for (const l of lines) db.invoiceLines.push({ id: nextId(db.invoiceLines), invoice_id: invId, item_name: l.item_name, qty: Number(l.qty) || 0, unit_price: Number(l.unit_price) || 0, line_total: round2(Number(l.qty || 0) * Number(l.unit_price || 0)) });
    if (['received', 'partially_received'].includes(po.status)) po.status = 'invoice_captured';
    audit(db, me, 'create', 'invoice', b.invoice_number, `Invoice captured against ${po.po_number} — CAD $${total.toFixed(2)}`);
    return ok(invoiceDetail(db, invId), 201);
  }
  if (method === 'GET' && pathname === '/api/invoices')
    return ok([...db.invoices].sort((a, b) => b.id - a.id).map(i => ({ ...i, vendor_name: vendorById(db, i.vendor_id)?.name, po_number: poRow(db, i.po_id)?.po_number })));
  if (method === 'GET' && seg[1] === 'invoices' && seg.length === 3) {
    const inv = invoiceDetail(db, seg[2]);
    if (!inv) return err(404, 'Invoice not found');
    return ok(inv);
  }
  if (method === 'POST' && seg[1] === 'invoices' && seg[3] === 'match') {
    const denied = requireRole('finance'); if (denied) return denied;
    const inv0 = db.invoices.find(i => i.id === Number(seg[2]));
    if (!inv0) return err(404, 'Invoice not found');
    if (!['captured', 'exception'].includes(inv0.status)) return err(409, `Invoice cannot be matched in status ${inv0.status}`);
    const inv = invoiceDetail(db, inv0.id)!;
    const po = poDetail(db, inv.po_id)!;
    const checks: Row[] = [];
    let expected = 0, failAmount = 0, hasPriceIssue = false;
    for (const pl of po.lines) {
      const received = po.receivedByLine[pl.id]?.a || 0;
      const il = inv.lines.find((l: Row) => String(l.item_name).toLowerCase() === String(pl.item_name).toLowerCase());
      const invQty = il ? il.qty : 0, invPrice = il ? il.unit_price : null;
      const problems: string[] = [];
      if (invQty > received + 1e-9) problems.push(`Invoiced qty ${invQty} exceeds received qty ${received}`);
      if (il && Math.abs(invPrice - pl.unit_price) > 0.011) { problems.push(`Price variance: PO $${pl.unit_price} vs invoice $${invPrice}`); hasPriceIssue = true; }
      if (!il && received > 0) problems.push('Received item missing from invoice');
      if (invQty < received - 1e-9) problems.push(`Invoiced qty ${invQty} is less than received qty ${received} (possible credit owing)`);
      const lineExpected = round2(received * pl.unit_price);
      expected += lineExpected;
      if (problems.length) failAmount += Math.abs(round2(invQty * (invPrice ?? pl.unit_price)) - lineExpected);
      checks.push({ item: pl.item_name, ordered: pl.qty, received, invoicedQty: invQty, poPrice: pl.unit_price, invoicePrice: invPrice, status: problems.length ? 'variance' : 'ok', problems });
    }
    expected = round2(expected + (po.freight || 0) + (po.tax || 0));
    const totalDiff = round2(inv.total - expected);
    if (Math.abs(totalDiff) > 0.51) checks.push({ item: 'Invoice total', ordered: null, received: null, invoicedQty: null, poPrice: null, invoicePrice: null, status: 'variance', problems: [`Invoice total $${inv.total.toFixed(2)} vs expected $${expected.toFixed(2)} (received × PO price + freight/tax) — difference $${totalDiff.toFixed(2)}`] });
    const pass = checks.every(c => c.status === 'ok');
    const result = { pass, checks, expectedTotal: expected, invoiceTotal: inv.total, checkedAt: nowISO() };
    inv0.match_status = pass ? 'pass' : 'fail';
    inv0.match_result = JSON.stringify(result);
    inv0.matched_at = nowStr();
    inv0.status = pass ? 'matched' : 'exception';
    const poR = poRow(db, inv.po_id)!;
    if (pass) {
      if (['invoice_captured', 'exception', 'received', 'partially_received'].includes(poR.status)) poR.status = 'matched';
      audit(db, me, 'match', 'invoice', inv.invoice_number, `Three-way match PASSED for ${poR.po_number} — expected $${expected.toFixed(2)} = invoice $${inv.total.toFixed(2)}`);
    } else {
      poR.status = 'exception';
      const ref = 'EXC-' + String(nextVal(db, 'exception')).padStart(4, '0');
      db.exceptions.push({
        id: nextId(db.exceptions), ref, po_id: poR.id, invoice_id: inv.id, vendor_id: inv.vendor_id,
        type: hasPriceIssue ? 'price_variance' : 'quantity_mismatch',
        description: `Three-way match failed for invoice ${inv.invoice_number} on ${poR.po_number}: ` + checks.filter(c => c.status === 'variance').flatMap(c => c.problems).join('; '),
        disputed_amount: round2(Math.max(failAmount, Math.abs(totalDiff))), owner_id: me.id, approver_id: null,
        due_date: null, status: 'open', resolution: null, created_at: nowStr(), resolved_at: null,
      });
      audit(db, me, 'match', 'invoice', inv.invoice_number, `Three-way match FAILED for ${poR.po_number} — exception ${ref} opened, payment blocked`);
    }
    return ok({ ...invoiceDetail(db, inv.id), matchResult: result });
  }
  if (method === 'POST' && seg[1] === 'invoices' && seg[3] === 'approve-invoice') {
    const inv = invoiceDetail(db, seg[2]);
    if (!inv) return err(404, 'Invoice not found');
    if (inv.status !== 'matched') return err(409, `Invoice must pass the three-way match before invoice approval (current: ${inv.status})`);
    if (!['finance', 'gm', 'admin'].includes(me.role)) return err(403, 'Invoice approval requires Finance/AP, GM, or Admin.');
    if (me.id === inv.po_approver_id) return err(403, 'Separation of duties: the person who approved this PO cannot also approve its invoice. Invoice approval is independent of PO approval (SOP Step 9).');
    if (me.id === inv.captured_by) return err(403, 'Separation of duties: the person who captured this invoice cannot also approve it.');
    const inv0 = db.invoices.find(i => i.id === inv.id)!;
    inv0.status = 'invoice_approved'; inv0.invoice_approver_id = me.id; inv0.invoice_approved_at = nowStr();
    poRow(db, inv.po_id)!.status = 'invoice_approved';
    audit(db, me, 'approve', 'invoice', inv.invoice_number, 'Invoice independently approved (Step 9)');
    return ok(invoiceDetail(db, inv.id));
  }
  if (method === 'POST' && seg[1] === 'invoices' && seg[3] === 'approve-payment') {
    const inv = invoiceDetail(db, seg[2]);
    if (!inv) return err(404, 'Invoice not found');
    if (inv.status !== 'invoice_approved') return err(409, `Payment can only be approved after invoice approval (current: ${inv.status})`);
    if (!['payment_approver', 'gm', 'admin'].includes(me.role)) return err(403, 'Payment approval requires the Payment Approver, GM, or Admin.');
    if (me.id === inv.invoice_approver_id) return err(403, 'Separation of duties: the payment approver must be different from the invoice approver (SOP Step 10).');
    const inv0 = db.invoices.find(i => i.id === inv.id)!;
    inv0.status = 'payment_approved'; inv0.payment_approver_id = me.id; inv0.payment_approved_at = nowStr();
    poRow(db, inv.po_id)!.status = 'payment_approved';
    audit(db, me, 'approve_payment', 'invoice', inv.invoice_number, 'Payment approved by authorized payment approver (Step 10)');
    return ok(invoiceDetail(db, inv.id));
  }
  if (method === 'POST' && seg[1] === 'invoices' && seg[3] === 'pay') {
    const denied = requireRole('finance'); if (denied) return denied;
    const inv = invoiceDetail(db, seg[2]);
    if (!inv) return err(404, 'Invoice not found');
    if (inv.status !== 'payment_approved') return err(409, `Payment requires prior payment approval (current: ${inv.status})`);
    const amount = round2(body?.amount ?? inv.total);
    const payId = nextId(db.payments);
    const payment = { id: payId, invoice_id: inv.id, po_id: inv.po_id, amount, payment_date: body?.payment_date || todayStr(), reference: body?.reference || '', scheduled_by: me.id, approved_by: inv.payment_approver_id, status: 'paid', created_at: nowStr() };
    db.payments.push(payment);
    db.invoices.find(i => i.id === inv.id)!.status = 'paid';
    poRow(db, inv.po_id)!.status = 'paid';
    audit(db, me, 'pay', 'invoice', inv.invoice_number, `Paid CAD $${amount.toFixed(2)} ref ${body?.reference || 'n/a'} (Step 11)`);
    return ok({ payment: { ...payment }, invoice: invoiceDetail(db, inv.id) }, 201);
  }

  /* exceptions */
  if (method === 'GET' && pathname === '/api/exceptions')
    return ok([...db.exceptions].sort((a, b) => b.id - a.id).map(e => ({ ...e, vendor_name: e.vendor_id ? vendorById(db, e.vendor_id)?.name : null, po_number: e.po_id ? poRow(db, e.po_id)?.po_number : null, owner_name: e.owner_id ? userById(db, e.owner_id)?.name : null })));
  if (method === 'POST' && pathname === '/api/exceptions') {
    const b = body || {};
    if (!EXCEPTION_TYPES.includes(b.type)) return err(400, 'Valid exception type is required');
    const ref = 'EXC-' + String(nextVal(db, 'exception')).padStart(4, '0');
    const e = { id: nextId(db.exceptions), ref, po_id: b.po_id || null, invoice_id: b.invoice_id || null, vendor_id: b.vendor_id || null, type: b.type, description: b.description || '', disputed_amount: round2(b.disputed_amount), owner_id: b.owner_id || me.id, approver_id: null, due_date: b.due_date || null, status: 'open', resolution: null, created_at: nowStr(), resolved_at: null };
    db.exceptions.push(e);
    audit(db, me, 'create', 'exception', ref, `Exception opened: ${b.type} — ${b.description || ''}`);
    return ok({ ...e }, 201);
  }
  if (method === 'PATCH' && seg[1] === 'exceptions') {
    const e = db.exceptions.find(x => x.id === Number(seg[2]));
    if (!e) return err(404, 'Exception not found');
    const b = { ...e, ...(body || {}) };
    e.status = b.status; e.owner_id = b.owner_id; e.due_date = b.due_date; e.resolution = b.resolution;
    e.resolved_at = b.status === 'resolved' ? (e.resolved_at || nowISO()) : null;
    audit(db, me, 'update', 'exception', e.ref, `Exception ${e.ref} → ${b.status}${b.resolution ? ' — ' + b.resolution : ''}`);
    return ok({ ...e });
  }

  /* payments */
  if (method === 'GET' && pathname === '/api/payments')
    return ok([...db.payments].sort((a, b) => b.id - a.id).map(p => {
      const inv = db.invoices.find(i => i.id === p.invoice_id);
      const po = poRow(db, p.po_id);
      return { ...p, invoice_number: inv?.invoice_number, po_number: po?.po_number, vendor_name: po ? vendorById(db, po.vendor_id)?.name : null };
    }));

  /* dashboard / process map / reports */
  if (method === 'GET' && pathname === '/api/dashboard') {
    const pending = [...db.pos].filter(p => p.status === 'pending_approval').sort((a, b) => b.id - a.id)
      .map((p): Row => ({ ...p, vendor_name: vendorById(db, p.vendor_id)?.name, requester_name: userById(db, p.requester_id)?.name }))
      .filter(po => APPROVER_ROLES.includes(me.role) && (AUTHORITY[me.role] ?? 0) >= po.total);
    const overdue = [...db.invoices].filter(i => i.due_date && i.due_date < todayStr() && i.status !== 'paid')
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
      .map(i => ({ ...i, vendor_name: vendorById(db, i.vendor_id)?.name, po_number: poRow(db, i.po_id)?.po_number }));
    const ym = todayStr().slice(0, 7);
    const inMonth = db.pos.filter(p => p.status !== 'draft' && String(p.created_at).slice(0, 7) === ym);
    const spendByCategory = [...new Set(inMonth.map(p => p.category || ''))]
      .map(category => ({ category, amount: round2(inMonth.filter(p => (p.category || '') === category).reduce((s, p) => s + (Number(p.total) || 0), 0)) }))
      .sort((a, b) => b.amount - a.amount);
    const vendorNames = [...new Set(inMonth.map(p => p.vendor_id))];
    const spendByVendor = vendorNames.map(vid => ({ name: vendorById(db, vid)?.name, amount: inMonth.filter(p => p.vendor_id === vid).reduce((s, p) => s + (Number(p.total) || 0), 0) })).sort((a, b) => b.amount - a.amount);
    const laterStatuses = ['sent', 'partially_received', 'received', 'invoice_captured', 'matched', 'exception', 'invoice_approved', 'payment_approved', 'paid', 'closed'];
    const sentOrLater = db.pos.filter(p => laterStatuses.includes(p.status)).length;
    const approvedBeforeSend = db.pos.filter(p => p.approver_id && laterStatuses.includes(p.status)).length;
    const receivedPOs = new Set(db.receipts.map(r => r.po_id)).size;
    const matchAttempts = db.invoices.filter(i => i.match_status).length;
    const matchPass = db.invoices.filter(i => i.match_status === 'pass').length;
    const stages = stageCounts(db);
    return ok({
      myPendingApprovals: pending,
      openPOs: db.pos.filter(p => !['closed', 'draft'].includes(p.status)).length,
      openExceptions: stages.openExceptions,
      overdueInvoices: overdue,
      spendByCategory, spendByVendor,
      monthTotal: round2(spendByCategory.reduce((s, r) => s + r.amount, 0)),
      stages,
      kpis: [
        { label: 'Routine orders approved before sending', value: sentOrLater ? Math.round(approvedBeforeSend / sentOrLater * 100) : 100, target: 100, unit: '%' },
        { label: 'Deliveries with a receiving record', value: sentOrLater ? Math.round(receivedPOs / Math.max(sentOrLater, 1) * 100) : 100, target: 100, unit: '%' },
        { label: 'Three-way match pass rate', value: matchAttempts ? Math.round(matchPass / matchAttempts * 100) : 100, target: 100, unit: '%' },
        { label: 'Duplicate payments', value: 0, target: 0, unit: '' },
      ],
      recentAudit: [...db.audit].sort((a, b) => b.id - a.id).slice(0, 8).map(a => ({ ...a })),
    });
  }
  if (method === 'GET' && pathname === '/api/process-map') {
    const s = stageCounts(db);
    const steps = [
      { n: 1, key: 'need', title: 'Identify the need', desc: 'Check stock, PAR, forecast, events and open POs', count: s.requests, link: '/requests' },
      { n: 2, key: 'type', title: 'Routine or emergency?', desc: 'Emergency orders need documented authorization', count: db.requests.filter(r => r.type === 'emergency').length, link: '/requests' },
      { n: 3, key: 'request', title: 'Prepare purchase request', desc: 'Item, quantity, supplier, cost and reason', count: s.draft, link: '/requests' },
      { n: 4, key: 'approval', title: 'Get approval', desc: 'Apply correct approval limit before ordering', count: s.pendingApproval, link: '/approvals' },
      { n: 5, key: 'po', title: 'Create PO and send order', desc: 'Approved template or enabled system; record PO number', count: s.approved + s.sent, link: '/pos' },
      { n: 6, key: 'receive', title: 'Receive and inspect', desc: 'Count items; check quality, temperature, expiry, damage', count: s.sent + s.partiallyReceived, link: '/receiving' },
      { n: 7, key: 'invoice', title: 'Capture supplier invoice', desc: 'Record invoice number, PO number, itemized details', count: s.invoiceCaptured, link: '/invoices' },
      { n: 8, key: 'match', title: 'Three-way match', desc: 'Match PO + receiving record + invoice; resolve differences', count: s.matched + s.exception, link: '/invoices' },
      { n: 9, key: 'invapproval', title: 'Independent invoice approval', desc: 'Verify details, coding and exceptions', count: s.matched, link: '/approvals' },
      { n: 10, key: 'payapproval', title: 'Finance payment approval', desc: 'Check terms, vendor details and payment authority', count: s.invoiceApproved, link: '/payments' },
      { n: 11, key: 'pay', title: 'Pay and close PO', desc: 'Record payment, reconcile and close the PO', count: s.paid + s.closed, link: '/payments' },
    ];
    return ok({ steps, totals: s });
  }
  if (method === 'GET' && pathname === '/api/reports/weekly') {
    const openPOs = db.pos.filter(p => !['closed', 'draft'].includes(p.status)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map(p => ({ ...p, vendor_name: vendorById(db, p.vendor_id)?.name, age_days: Math.trunc((Date.now() - new Date(String(p.created_at).replace(' ', 'T')).getTime()) / 864e5) }));
    const openExceptions = [...db.exceptions].filter(e => e.status !== 'resolved').sort((a, b) => a.id - b.id)
      .map((e): Row => ({ ...e, vendor_name: e.vendor_id ? vendorById(db, e.vendor_id)?.name : null, po_number: e.po_id ? poRow(db, e.po_id)?.po_number : null }));
    const overdue = db.invoices.filter(i => i.due_date && i.due_date < todayStr() && i.status !== 'paid')
      .map(i => ({ ...i, vendor_name: vendorById(db, i.vendor_id)?.name, po_number: poRow(db, i.po_id)?.po_number }));
    const vendorPerformance = [...db.vendors].sort((a, b) => a.name.localeCompare(b.name)).map(v => {
      const vendorPOs = db.pos.filter(p => p.vendor_id === v.id && p.status !== 'draft');
      const spend = round2(vendorPOs.reduce((s, p) => s + (Number(p.total) || 0), 0));
      const accepted = db.receiptLines.filter(rl => { const r = db.receipts.find(x => x.id === rl.receipt_id); const po = r ? poRow(db, r.po_id) : null; return po && po.vendor_id === v.id; }).reduce((s, rl) => s + (Number(rl.qty_accepted) || 0), 0);
      const ordered = db.poLines.filter(pl => { const po = poRow(db, pl.po_id); return po && po.vendor_id === v.id && !['draft', 'pending_approval'].includes(po.status); }).reduce((s, pl) => s + (Number(pl.qty) || 0), 0);
      return { name: v.name, po_count: vendorPOs.length, spend, accepted, ordered, fillRate: ordered > 0 ? Math.round(accepted / ordered * 100) : null };
    }).sort((a, b) => b.spend - a.spend);
    const creditsPending = round2(openExceptions.filter(e => ['short_delivery', 'price_variance', 'quantity_mismatch'].includes(e.type)).reduce((s, e) => s + (e.disputed_amount || 0), 0));
    return ok({ openPOs, openExceptions, overdueInvoices: overdue, vendorPerformance, creditsPending });
  }

  /* audit / settings / search */
  if (method === 'GET' && pathname === '/api/audit') {
    const limit = Math.min(Number(query.get('limit')) || 100, 500);
    return ok([...db.audit].sort((a, b) => b.id - a.id).slice(0, limit).map(a => ({ ...a })));
  }
  if (method === 'GET' && pathname === '/api/settings') return ok({ ...db.settings });
  if (method === 'PATCH' && pathname === '/api/settings') {
    const denied = requireRole('admin'); if (denied) return denied;
    for (const [k, v] of Object.entries(body || {})) db.settings[k] = String(v);
    audit(db, me, 'update', 'settings', '', `Settings updated: ${Object.keys(body || {}).join(', ')}`);
    return ok({ ...db.settings });
  }
  if (method === 'GET' && pathname === '/api/search') {
    const s = String(query.get('q') || '').toLowerCase();
    const like = (v: unknown) => String(v ?? '').toLowerCase().includes(s);
    return ok({
      pos: db.pos.filter(p => like(p.po_number)).slice(0, 8).map(p => ({ id: p.id, po_number: p.po_number, status: p.status, total: p.total, vendor_name: vendorById(db, p.vendor_id)?.name })),
      vendors: db.vendors.filter(v => like(v.name)).slice(0, 5).map(v => ({ id: v.id, name: v.name })),
      invoices: db.invoices.filter(i => like(i.invoice_number)).slice(0, 5).map(i => ({ id: i.id, invoice_number: i.invoice_number, status: i.status, total: i.total })),
      exceptions: db.exceptions.filter(e => like(e.ref)).slice(0, 5).map(e => ({ id: e.id, ref: e.ref, type: e.type, status: e.status })),
    });
  }

  return err(404, 'Not found');
}
