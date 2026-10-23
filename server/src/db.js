const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, contact_name TEXT, email TEXT, phone TEXT,
  terms TEXT DEFAULT 'Net 30', delivery_days TEXT, min_order REAL DEFAULT 0,
  address TEXT, notes TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER REFERENCES vendors(id), name TEXT NOT NULL, spec TEXT, unit TEXT,
  category TEXT, guide_price REAL DEFAULT 0, par_level REAL DEFAULT 0, on_hand REAL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS purchase_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT UNIQUE NOT NULL, type TEXT NOT NULL DEFAULT 'routine',
  requester_id INTEGER REFERENCES users(id), vendor_id INTEGER REFERENCES vendors(id),
  category TEXT, reason TEXT, needed_by TEXT, status TEXT NOT NULL DEFAULT 'draft',
  emergency_authorizer TEXT, emergency_time TEXT, emergency_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS request_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER REFERENCES purchase_requests(id), item_id INTEGER,
  item_name TEXT, spec TEXT, unit TEXT, qty REAL, est_unit_price REAL
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT UNIQUE NOT NULL, request_id INTEGER REFERENCES purchase_requests(id),
  vendor_id INTEGER REFERENCES vendors(id), requester_id INTEGER REFERENCES users(id),
  category TEXT, status TEXT NOT NULL DEFAULT 'draft',
  subtotal REAL DEFAULT 0, discount REAL DEFAULT 0, freight REAL DEFAULT 0, tax REAL DEFAULT 0, total REAL DEFAULT 0,
  delivery_date TEXT, order_date TEXT, vendor_confirmation TEXT,
  required_approver_role TEXT, approver_id INTEGER, approved_at TEXT, approval_comment TEXT,
  split_warning TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), closed_at TEXT
);
CREATE TABLE IF NOT EXISTS po_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id INTEGER REFERENCES purchase_orders(id), item_id INTEGER,
  item_name TEXT, spec TEXT, unit TEXT, qty REAL, unit_price REAL, line_total REAL
);
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id INTEGER REFERENCES purchase_orders(id), receiver_id INTEGER REFERENCES users(id),
  delivery_slip TEXT, received_at TEXT NOT NULL DEFAULT (datetime('now')), notes TEXT
);
CREATE TABLE IF NOT EXISTS receipt_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id INTEGER REFERENCES receipts(id), po_line_id INTEGER,
  item_name TEXT, qty_ordered REAL, qty_accepted REAL DEFAULT 0, qty_rejected REAL DEFAULT 0,
  quality_check TEXT, temperature TEXT, expiry TEXT, issue TEXT, action TEXT
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id INTEGER REFERENCES purchase_orders(id), vendor_id INTEGER REFERENCES vendors(id),
  invoice_number TEXT NOT NULL, invoice_date TEXT, due_date TEXT,
  subtotal REAL DEFAULT 0, tax REAL DEFAULT 0, total REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'captured', captured_by INTEGER,
  match_status TEXT, match_result TEXT, matched_at TEXT,
  invoice_approver_id INTEGER, invoice_approved_at TEXT,
  payment_approver_id INTEGER, payment_approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER REFERENCES invoices(id), item_name TEXT, qty REAL, unit_price REAL, line_total REAL
);
CREATE TABLE IF NOT EXISTS exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT UNIQUE NOT NULL, po_id INTEGER, invoice_id INTEGER, vendor_id INTEGER,
  type TEXT NOT NULL, description TEXT, disputed_amount REAL DEFAULT 0,
  owner_id INTEGER, approver_id INTEGER, due_date TEXT,
  status TEXT NOT NULL DEFAULT 'open', resolution TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER REFERENCES invoices(id), po_id INTEGER,
  amount REAL, payment_date TEXT, reference TEXT,
  scheduled_by INTEGER, approved_by INTEGER, status TEXT DEFAULT 'paid',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, user_name TEXT, action TEXT NOT NULL, entity TEXT, entity_id TEXT,
  details TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
`);

const DEMO_PASSWORD = 'demo1234';

function nextVal(key) {
  db.prepare('INSERT INTO counters(key,value) VALUES(?,1) ON CONFLICT(key) DO UPDATE SET value=value+1').run(key);
  return db.prepare('SELECT value FROM counters WHERE key=?').get(key).value;
}
function peekVal(key) {
  const r = db.prepare('SELECT value FROM counters WHERE key=?').get(key);
  return r ? r.value : 0;
}
function audit(user, action, entity, entityId, details) {
  db.prepare('INSERT INTO audit_log(user_id,user_name,action,entity,entity_id,details) VALUES(?,?,?,?,?,?)')
    .run(user ? user.id : null, user ? user.name : 'system', action, entity, String(entityId ?? ''), details || '');
}

function seed() {
  const n = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (n > 0) return;
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const userRows = [
    ['Adam Wright', 'admin@ette.local', 'admin'],
    ['Sam Carter', 'requester@ette.local', 'requester'],
    ['Maria Lopez', 'manager@ette.local', 'kitchen_manager'],
    ['Daniel Kim', 'chef@ette.local', 'executive_chef'],
    ['Grace Thompson', 'gm@ette.local', 'gm'],
    ['Alex Roy', 'receiver@ette.local', 'receiver'],
    ['Priya Patel', 'finance@ette.local', 'finance'],
    ['Olivia Chen', 'payer@ette.local', 'payment_approver'],
  ];
  const insU = db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)');
  const U = {};
  for (const [name, email, role] of userRows) U[role] = insU.run(name, email, hash, role).lastInsertRowid;

  const insV = db.prepare('INSERT INTO vendors(name,contact_name,email,phone,terms,delivery_days,min_order,address,notes) VALUES(?,?,?,?,?,?,?,?,?)');
  const V = {};
  V.costco = insV.run('Costco Wholesale', 'Business Centre Desk', 'orders@costco-example.ca', '905-555-0100', 'Net 30', 'Mon/Wed/Fri', 200, 'Warehouse Club — Business Centre', 'Bulk dry goods, dairy and disposables').lastInsertRowid;
  V.gfs = insV.run('Gordon Food Service', 'Nadia Brooks', 'orders@gfs-example.ca', '905-555-0111', 'Net 30', 'Tue/Fri', 350, 'GTA distribution centre', 'Broadline foodservice distributor').lastInsertRowid;
  V.sysco = insV.run('Sysco Canada', 'Mark Ellery', 'orders@sysco-example.ca', '416-555-0142', 'Net 21', 'Mon/Thu', 300, 'Toronto distribution centre', 'Broadline + proteins').lastInsertRowid;
  V.produce = insV.run('Fresh Valley Produce', 'Luca Romano', 'sales@freshvalley-example.ca', '416-555-0177', 'Net 14', 'Daily', 75, 'Ontario Food Terminal', 'Fresh produce, daily delivery').lastInsertRowid;
  V.cleanpro = insV.run('CleanPro Supplies', 'Erin Walsh', 'orders@cleanpro-example.ca', '905-555-0139', 'Net 30', 'Wed', 100, 'Industrial supply depot', 'Cleaning chemicals and disposables').lastInsertRowid;

  const insI = db.prepare('INSERT INTO items(vendor_id,name,spec,unit,category,guide_price,par_level,on_hand) VALUES(?,?,?,?,?,?,?,?)');
  insI.run(V.costco, 'Smoked salmon', 'Whole side, ~40cm', 'bag', 'Food ingredients', 5.00, 30, 8);
  insI.run(V.costco, 'Milk 2%', '4L x 4 per box, 40kg case', 'box', 'Food ingredients', 15.00, 40, 12);
  insI.run(V.costco, 'Nitrile gloves', 'Box of 100, size M', 'box', 'Disposable supplies', 12.50, 20, 6);
  insI.run(V.gfs, 'Chicken breast', 'Boneless skinless, 10kg case', 'case', 'Food ingredients', 68.00, 12, 5);
  insI.run(V.gfs, 'Roma tomatoes', '25lb case', 'case', 'Food ingredients', 32.00, 10, 4);
  insI.run(V.gfs, 'Heavy cream 35%', '12 x 1L', 'case', 'Food ingredients', 54.00, 8, 3);
  insI.run(V.sysco, 'Atlantic salmon fillets', 'Fresh, 4-5lb fillets, 10lb case', 'case', 'Food ingredients', 145.00, 6, 2);
  insI.run(V.sysco, 'All-purpose flour', '20kg bag', 'bag', 'Food ingredients', 21.00, 15, 7);
  insI.run(V.produce, 'Lemons', '140 count case', 'case', 'Food ingredients', 58.00, 5, 2);
  insI.run(V.produce, 'Fresh basil', '1lb clamshell x 6', 'case', 'Food ingredients', 24.00, 8, 3);
  insI.run(V.cleanpro, 'Dishwasher detergent', '10L pail, kitchen-safe', 'pail', 'Cleaning and sanitation', 86.00, 6, 2);
  insI.run(V.cleanpro, 'Sanitizer concentrate', '4 x 4L', 'case', 'Cleaning and sanitation', 119.00, 4, 1);
  insI.run(V.cleanpro, 'Paper towels', '12-roll case', 'case', 'Disposable supplies', 39.00, 10, 4);

  db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run('approval_tier1_max', '500');
  db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run('approval_tier2_max', '2000');
  db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run('po_prefix', 'ETT-PO-');

  const insPO = db.prepare(`INSERT INTO purchase_orders(po_number,vendor_id,requester_id,category,status,subtotal,discount,freight,tax,total,delivery_date,order_date,vendor_confirmation,required_approver_role,approver_id,approved_at,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now',?))`);
  const insPOL = db.prepare('INSERT INTO po_lines(po_id,item_name,spec,unit,qty,unit_price,line_total) VALUES(?,?,?,?,?,?,?)');
  const insReq = db.prepare(`INSERT INTO purchase_requests(ref,type,requester_id,vendor_id,category,reason,needed_by,status,created_at) VALUES(?,?,?,?,?,?,?,?,datetime('now',?))`);
  const insRL = db.prepare('INSERT INTO request_lines(request_id,item_name,spec,unit,qty,est_unit_price) VALUES(?,?,?,?,?,?)');

  function makePO(num, vendorId, requesterRole, category, lines, freight, tax, status, reqStatus, approverRole, daysAgo, extra = {}) {
    const subtotal = lines.reduce((s, l) => s + l[3] * l[4], 0);
    const total = Math.round((subtotal + freight + tax) * 100) / 100;
    const reqId = insReq.run('REQ-' + String(num).padStart(4, '0'), extra.type || 'routine', U[requesterRole], vendorId, category, extra.reason || 'Restock to par', null, reqStatus, `-${daysAgo} days`).lastInsertRowid;
    for (const l of lines) insRL.run(reqId, l[0], l[1], l[2], l[3], l[4]);
    const poId = insPO.run('ETT-PO-' + String(num).padStart(4, '0'), vendorId, U[requesterRole], category, status, subtotal, 0, freight, tax, total,
      null, extra.orderDate || null, extra.confirmation || null, extra.requiredRole || null,
      approverRole ? U[approverRole] : null, approverRole ? new Date(Date.now() - daysAgo * 864e5).toISOString() : null, `-${daysAgo} days`).lastInsertRowid;
    db.prepare('UPDATE purchase_orders SET request_id=? WHERE id=?').run(reqId, poId);
    for (const l of lines) insPOL.run(poId, l[0], l[1], l[2], l[3], l[4], Math.round(l[3] * l[4] * 100) / 100);
    db.prepare('INSERT INTO counters(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=MAX(value,excluded.value)').run('po', num);
    db.prepare('INSERT INTO counters(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=MAX(value,excluded.value)').run('request', num);
    return poId;
  }

  // ETT-PO-0001 — his demo PO (Costco: smoked salmon + milk), full cycle -> closed
  const po1 = makePO(1, V.costco, 'requester', 'Food ingredients',
    [['Smoked salmon', 'Whole side, ~40cm', 'bag', 20, 5.00], ['Milk 2%', '4L x 4 per box, 40kg case', 'box', 21, 15.00]],
    0, 0, 'closed', 'approved', 'kitchen_manager', 9, { orderDate: '2026-10-14', confirmation: 'Confirmed by vendor email', requiredRole: 'kitchen_manager' });
  const po1Lines = db.prepare('SELECT * FROM po_lines WHERE po_id=?').all(po1);
  const rc1 = db.prepare('INSERT INTO receipts(po_id,receiver_id,delivery_slip,received_at,notes) VALUES(?,?,?,?,datetime(\'now\',\'-8 days\'))').run(po1, U.receiver, 'DS-88123', 'Full delivery, quality OK').lastInsertRowid;
  const insRCL = db.prepare('INSERT INTO receipt_lines(receipt_id,po_line_id,item_name,qty_ordered,qty_accepted,qty_rejected,quality_check,temperature,expiry,issue,action) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  for (const l of po1Lines) insRCL.run(rc1, l.id, l.item_name, l.qty, l.qty, 0, 'Pass', '3C', '', '', '');
  const inv1 = db.prepare(`INSERT INTO invoices(po_id,vendor_id,invoice_number,invoice_date,due_date,subtotal,tax,total,status,captured_by,match_status,matched_at,invoice_approver_id,invoice_approved_at,payment_approver_id,payment_approved_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(po1, V.costco, 'INV-C-1001', '2026-10-15', '2026-11-14', 415, 0, 415, 'paid', U.finance, 'pass', '2026-10-15', U.finance, '2026-10-15', U.payment_approver, '2026-10-16').lastInsertRowid;
  const insIL = db.prepare('INSERT INTO invoice_lines(invoice_id,item_name,qty,unit_price,line_total) VALUES(?,?,?,?,?)');
  for (const l of po1Lines) insIL.run(inv1, l.item_name, l.qty, l.unit_price, l.line_total);
  db.prepare('INSERT INTO payments(invoice_id,po_id,amount,payment_date,reference,scheduled_by,approved_by) VALUES(?,?,?,?,?,?,?)')
    .run(inv1, po1, 415, '2026-10-16', 'EFT-2026-1016', U.finance, U.payment_approver);

  // ETT-PO-0002 — GFS, EC tier, received, invoice captured (awaiting match)
  const po2 = makePO(2, V.gfs, 'requester', 'Food ingredients',
    [['Chicken breast', 'Boneless skinless, 10kg case', 'case', 10, 68.00], ['Roma tomatoes', '25lb case', 'case', 12, 32.00], ['Heavy cream 35%', '12 x 1L', 'case', 7, 54.00]],
    25, 0, 'invoice_captured', 'approved', 'executive_chef', 4, { orderDate: '2026-10-20', confirmation: 'Confirmed', requiredRole: 'executive_chef' });
  const po2Lines = db.prepare('SELECT * FROM po_lines WHERE po_id=?').all(po2);
  const rc2 = db.prepare('INSERT INTO receipts(po_id,receiver_id,delivery_slip,received_at,notes) VALUES(?,?,?,?,datetime(\'now\',\'-2 days\'))').run(po2, U.receiver, 'DS-90210', 'All accepted').lastInsertRowid;
  for (const l of po2Lines) insRCL.run(rc2, l.id, l.item_name, l.qty, l.qty, 0, 'Pass', '2C', '', '', '');
  const inv2 = db.prepare('INSERT INTO invoices(po_id,vendor_id,invoice_number,invoice_date,due_date,subtotal,tax,total,status,captured_by) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(po2, V.gfs, 'INV-G-5520', '2026-10-21', '2026-11-20', 1467, 0, 1467, 'captured', U.finance).lastInsertRowid;
  insIL.run(inv2, 'Chicken breast', 10, 68.00, 680); insIL.run(inv2, 'Roma tomatoes', 12, 32.00, 384); insIL.run(inv2, 'Heavy cream 35%', 7, 54.00, 378); insIL.run(inv2, 'Freight / delivery', 1, 25.00, 25);

  // ETT-PO-0003 — produce, sent, awaiting receiving
  makePO(3, V.produce, 'requester', 'Food ingredients',
    [['Lemons', '140 count case', 'case', 3, 58.00], ['Fresh basil', '1lb clamshell x 6', 'case', 5, 24.00]],
    0, 26.46, 'sent', 'approved', 'kitchen_manager', 1, { orderDate: '2026-10-23', confirmation: 'Confirmed for morning delivery', requiredRole: 'kitchen_manager' });

  // ETT-PO-0004 — CleanPro, > $2,000, pending GM approval
  makePO(4, V.cleanpro, 'executive_chef', 'Cleaning and sanitation',
    [['Dishwasher detergent', '10L pail, kitchen-safe', 'pail', 14, 86.00], ['Sanitizer concentrate', '4 x 4L', 'case', 10, 119.00], ['Paper towels', '12-roll case', 'case', 8, 39.00]],
    40, 0, 'pending_approval', 'submitted', null, 0, { requiredRole: 'gm' });

  // ETT-PO-0005 — Sysco, partially received with an open short-delivery exception
  const po5 = makePO(5, V.sysco, 'requester', 'Food ingredients',
    [['Atlantic salmon fillets', 'Fresh, 4-5lb fillets, 10lb case', 'case', 4, 145.00], ['All-purpose flour', '20kg bag', 'bag', 10, 21.00]],
    15, 0, 'exception', 'approved', 'executive_chef', 3, { orderDate: '2026-10-21', confirmation: 'Confirmed', requiredRole: 'executive_chef' });
  const po5Lines = db.prepare('SELECT * FROM po_lines WHERE po_id=? ORDER BY id').all(po5);
  const rc5 = db.prepare('INSERT INTO receipts(po_id,receiver_id,delivery_slip,received_at,notes) VALUES(?,?,?,?,datetime(\'now\',\'-1 days\'))').run(po5, U.receiver, 'DS-77541', 'Salmon short by 1 case').lastInsertRowid;
  insRCL.run(rc5, po5Lines[0].id, po5Lines[0].item_name, 4, 3, 0, 'Pass', '1C', '', 'Short delivery: 1 case missing', 'Credit requested from vendor');
  insRCL.run(rc5, po5Lines[1].id, po5Lines[1].item_name, 10, 10, 0, 'Pass', '', '', '', '');
  db.prepare('INSERT INTO counters(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=MAX(value,excluded.value)').run('exception', 1);
  db.prepare(`INSERT INTO exceptions(ref,po_id,vendor_id,type,description,disputed_amount,owner_id,due_date,status)
    VALUES('EXC-0001',?,?,?,?,?,?,date('now','+3 days'),'open')`)
    .run(po5, V.sysco, 'short_delivery', 'Atlantic salmon fillets: ordered 4 cases, received 3. Credit or follow-up delivery requested.', 145, U.finance);

  for (const [action, entity, eid, det] of [
    ['seed', 'system', '', 'Demo data seeded: 8 users, 5 vendors, 13 items, 5 POs (ETT-PO-0001..0005)'],
  ]) audit(null, action, entity, eid, det);
}

seed();
module.exports = { db, audit, nextVal, peekVal, DEMO_PASSWORD };
