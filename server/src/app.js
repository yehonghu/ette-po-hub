const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, audit, nextVal } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'ette-po-hub-demo-secret';
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const AUTHORITY = { requester: 0, receiver: 0, finance: 0, payment_approver: 0, kitchen_manager: 500, executive_chef: 2000, gm: Infinity, admin: Infinity };
const ROLE_LABELS = { requester: 'Kitchen Requester', kitchen_manager: 'Kitchen Manager', executive_chef: 'Executive Chef', gm: 'General Manager', receiver: 'Receiver', finance: 'Finance / AP', payment_approver: 'Payment Approver', admin: 'Admin' };
const APPROVER_ROLES = ['kitchen_manager', 'executive_chef', 'gm', 'admin'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function thresholds() {
  const t1 = Number(db.prepare("SELECT value FROM settings WHERE key='approval_tier1_max'").get()?.value || 500);
  const t2 = Number(db.prepare("SELECT value FROM settings WHERE key='approval_tier2_max'").get()?.value || 2000);
  return { t1, t2 };
}
function requiredRoleFor(total) {
  const { t1, t2 } = thresholds();
  if (total <= t1) return 'kitchen_manager';
  if (total <= t2) return 'executive_chef';
  return 'gm';
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(h.slice(7), JWT_SECRET);
    const user = db.prepare('SELECT id,name,email,role,active FROM users WHERE id=?').get(payload.id);
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid user' });
    req.user = user; next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}
function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user.role) || req.user.role === 'admin'
    ? next() : res.status(403).json({ error: `Role ${req.user.role} is not allowed to do this` });
}
const q = (sql, ...p) => db.prepare(sql).all(...p);
const one = (sql, ...p) => db.prepare(sql).get(...p);

/* ---------------- auth ---------------- */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = one('SELECT * FROM users WHERE email=?', String(email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash))
    return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '12h' });
  audit(user, 'login', 'user', user.id, 'Signed in');
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, roleLabel: ROLE_LABELS[user.role] } });
});
app.get('/api/auth/me', auth, (req, res) => res.json({ user: { ...req.user, roleLabel: ROLE_LABELS[req.user.role] } }));

/* ---------------- reference data ---------------- */
app.get('/api/users', auth, (req, res) => {
  const rows = q('SELECT id,name,role,email FROM users WHERE active=1 ORDER BY name');
  res.json(rows.map(u => ({ ...u, roleLabel: ROLE_LABELS[u.role] })));
});
app.get('/api/vendors', auth, (req, res) => res.json(q('SELECT * FROM vendors WHERE active=1 ORDER BY name')));
app.post('/api/vendors', auth, requireRole('kitchen_manager', 'executive_chef', 'gm'), (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'Vendor name is required' });
  const id = db.prepare('INSERT INTO vendors(name,contact_name,email,phone,terms,delivery_days,min_order,address,notes) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(b.name, b.contact_name || '', b.email || '', b.phone || '', b.terms || 'Net 30', b.delivery_days || '', Number(b.min_order) || 0, b.address || '', b.notes || '').lastInsertRowid;
  audit(req.user, 'create', 'vendor', id, `Vendor created: ${b.name}`);
  res.status(201).json(one('SELECT * FROM vendors WHERE id=?', id));
});
app.patch('/api/vendors/:id', auth, requireRole('kitchen_manager', 'executive_chef', 'gm'), (req, res) => {
  const v = one('SELECT * FROM vendors WHERE id=?', req.params.id);
  if (!v) return res.status(404).json({ error: 'Vendor not found' });
  const b = { ...v, ...req.body };
  db.prepare('UPDATE vendors SET name=?,contact_name=?,email=?,phone=?,terms=?,delivery_days=?,min_order=?,address=?,notes=? WHERE id=?')
    .run(b.name, b.contact_name, b.email, b.phone, b.terms, b.delivery_days, Number(b.min_order) || 0, b.address, b.notes, v.id);
  audit(req.user, 'update', 'vendor', v.id, `Vendor updated: ${b.name}`);
  res.json(one('SELECT * FROM vendors WHERE id=?', v.id));
});
app.get('/api/items', auth, (req, res) => {
  const sql = req.query.vendor_id ? 'SELECT * FROM items WHERE active=1 AND vendor_id=? ORDER BY name' : 'SELECT * FROM items WHERE active=1 ORDER BY name';
  res.json(req.query.vendor_id ? q(sql, req.query.vendor_id) : q(sql));
});
app.post('/api/items', auth, requireRole('kitchen_manager', 'executive_chef', 'gm'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.vendor_id) return res.status(400).json({ error: 'Item name and vendor are required' });
  const id = db.prepare('INSERT INTO items(vendor_id,name,spec,unit,category,guide_price,par_level,on_hand) VALUES(?,?,?,?,?,?,?,?)')
    .run(b.vendor_id, b.name, b.spec || '', b.unit || '', b.category || '', Number(b.guide_price) || 0, Number(b.par_level) || 0, Number(b.on_hand) || 0).lastInsertRowid;
  audit(req.user, 'create', 'item', id, `Item created: ${b.name}`);
  res.status(201).json(one('SELECT * FROM items WHERE id=?', id));
});
app.patch('/api/items/:id', auth, (req, res) => {
  const it = one('SELECT * FROM items WHERE id=?', req.params.id);
  if (!it) return res.status(404).json({ error: 'Item not found' });
  const b = { ...it, ...req.body };
  db.prepare('UPDATE items SET name=?,spec=?,unit=?,category=?,guide_price=?,par_level=?,on_hand=? WHERE id=?')
    .run(b.name, b.spec, b.unit, b.category, Number(b.guide_price) || 0, Number(b.par_level) || 0, Number(b.on_hand) || 0, it.id);
  res.json(one('SELECT * FROM items WHERE id=?', it.id));
});

/* ---------------- requests + PO creation ---------------- */
function splitWarningFor(userId, vendorId, total) {
  const others = one(`SELECT COALESCE(SUM(total),0) s FROM purchase_orders
    WHERE requester_id=? AND vendor_id=? AND date(created_at)=date('now')`, userId, vendorId).s;
  const { t1, t2 } = thresholds();
  const combined = others + total;
  for (const t of [t1, t2]) {
    if (total <= t && combined > t)
      return `Split-PO warning: your POs to this vendor today total CAD $${combined.toFixed(2)}, crossing the $${t} approval tier, while this PO alone is $${total.toFixed(2)}. Related purchases for the same need must be assessed together (SOP: do not split orders to bypass approval limits).`;
  }
  return null;
}

app.post('/api/requests', auth, (req, res) => {
  const b = req.body || {};
  const lines = Array.isArray(b.lines) ? b.lines.filter(l => l.item_name && Number(l.qty) > 0) : [];
  if (!b.vendor_id) return res.status(400).json({ error: 'Vendor is required' });
  if (!lines.length) return res.status(400).json({ error: 'At least one line item is required' });
  const type = b.type === 'emergency' ? 'emergency' : 'routine';
  if (type === 'emergency' && (!b.emergency_authorizer || !b.emergency_time || !b.emergency_reason))
    return res.status(400).json({ error: 'Emergency purchases require a documented authorizer, authorization time, and reason (SOP Step 2).' });
  const vendor = one('SELECT * FROM vendors WHERE id=?', b.vendor_id);
  if (!vendor) return res.status(400).json({ error: 'Vendor not found' });

  const subtotal = round2(lines.reduce((s, l) => s + Number(l.qty) * Number(l.est_unit_price || 0), 0));
  const freight = round2(b.freight), tax = round2(b.tax), discount = round2(b.discount);
  const total = round2(subtotal - discount + freight + tax);
  const reqN = nextVal('request');
  const ref = 'REQ-' + String(reqN).padStart(4, '0');
  const reqId = db.prepare(`INSERT INTO purchase_requests(ref,type,requester_id,vendor_id,category,reason,needed_by,status,emergency_authorizer,emergency_time,emergency_reason)
    VALUES(?,?,?,?,?,?,?, 'submitted',?,?,?)`)
    .run(ref, type, req.user.id, b.vendor_id, b.category || '', b.reason || '', b.needed_by || null,
      b.emergency_authorizer || null, b.emergency_time || null, b.emergency_reason || null).lastInsertRowid;
  const insRL = db.prepare('INSERT INTO request_lines(request_id,item_id,item_name,spec,unit,qty,est_unit_price) VALUES(?,?,?,?,?,?,?)');
  for (const l of lines) insRL.run(reqId, l.item_id || null, l.item_name, l.spec || '', l.unit || '', Number(l.qty), Number(l.est_unit_price) || 0);

  const poN = nextVal('po');
  const prefix = one("SELECT value FROM settings WHERE key='po_prefix'")?.value || 'ETT-PO-';
  const poNumber = prefix + String(poN).padStart(4, '0');
  const warning = splitWarningFor(req.user.id, Number(b.vendor_id), total);
  const poId = db.prepare(`INSERT INTO purchase_orders(po_number,request_id,vendor_id,requester_id,status,category,subtotal,discount,freight,tax,total,delivery_date,required_approver_role,split_warning)
    VALUES(?,?,?,?, 'draft',?,?,?,?,?,?,?,?,?)`)
    .run(poNumber, reqId, b.vendor_id, req.user.id, b.category || '', subtotal, discount, freight, tax, total,
      b.delivery_date || null, requiredRoleFor(total), warning).lastInsertRowid;
  const insPOL = db.prepare('INSERT INTO po_lines(po_id,item_id,item_name,spec,unit,qty,unit_price,line_total) VALUES(?,?,?,?,?,?,?,?)');
  for (const l of lines) insPOL.run(poId, l.item_id || null, l.item_name, l.spec || '', l.unit || '', Number(l.qty), Number(l.est_unit_price) || 0, round2(Number(l.qty) * Number(l.est_unit_price || 0)));
  audit(req.user, 'create', 'purchase_request', ref, `${type} request created for ${vendor.name}, total CAD $${total.toFixed(2)}`);
  audit(req.user, 'create', 'purchase_order', poNumber, `PO drafted from ${ref} — status: draft`);
  if (warning) audit(req.user, 'warning', 'purchase_order', poNumber, warning);
  res.status(201).json({ request: one('SELECT * FROM purchase_requests WHERE id=?', reqId), po: poDetail(poId), splitWarning: warning });
});

app.get('/api/requests', auth, (req, res) => {
  res.json(q(`SELECT pr.*, u.name requester_name, v.name vendor_name,
    (SELECT po_number FROM purchase_orders WHERE request_id=pr.id) po_number,
    (SELECT id FROM purchase_orders WHERE request_id=pr.id) po_id,
    (SELECT total FROM purchase_orders WHERE request_id=pr.id) total
    FROM purchase_requests pr JOIN users u ON u.id=pr.requester_id JOIN vendors v ON v.id=pr.vendor_id ORDER BY pr.id DESC`));
});
app.get('/api/requests/:id', auth, (req, res) => {
  const r = one(`SELECT pr.*, u.name requester_name, v.name vendor_name FROM purchase_requests pr
    JOIN users u ON u.id=pr.requester_id JOIN vendors v ON v.id=pr.vendor_id WHERE pr.id=?`, req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  r.lines = q('SELECT * FROM request_lines WHERE request_id=?', r.id);
  const po = one('SELECT id FROM purchase_orders WHERE request_id=?', r.id);
  r.po = po ? poDetail(po.id) : null;
  res.json(r);
});

/* ---------------- purchase orders ---------------- */
function poRow(id) { return one('SELECT * FROM purchase_orders WHERE id=?', id); }
function poDetail(id) {
  const po = one(`SELECT po.*, v.name vendor_name, u.name requester_name, a.name approver_name
    FROM purchase_orders po JOIN vendors v ON v.id=po.vendor_id JOIN users u ON u.id=po.requester_id
    LEFT JOIN users a ON a.id=po.approver_id WHERE po.id=?`, id);
  if (!po) return null;
  po.lines = q('SELECT * FROM po_lines WHERE po_id=? ORDER BY id', id);
  po.receipts = q('SELECT r.*, u.name receiver_name FROM receipts r JOIN users u ON u.id=r.receiver_id WHERE r.po_id=? ORDER BY r.id', id);
  for (const r of po.receipts) r.lines = q('SELECT * FROM receipt_lines WHERE receipt_id=? ORDER BY id', r.id);
  po.invoices = q('SELECT * FROM invoices WHERE po_id=? ORDER BY id', id);
  for (const inv of po.invoices) inv.lines = q('SELECT * FROM invoice_lines WHERE invoice_id=? ORDER BY id', inv.id);
  po.exceptions = q('SELECT e.*, u.name owner_name FROM exceptions e LEFT JOIN users u ON u.id=e.owner_id WHERE e.po_id=? ORDER BY e.id', id);
  po.payments = q('SELECT * FROM payments WHERE po_id=? ORDER BY id', id);
  po.receivedByLine = {};
  for (const l of po.lines) {
    po.receivedByLine[l.id] = one('SELECT COALESCE(SUM(qty_accepted),0) a, COALESCE(SUM(qty_rejected),0) r FROM receipt_lines WHERE po_line_id=?', l.id);
  }
  return po;
}
function setPoStatus(po, status) { db.prepare('UPDATE purchase_orders SET status=? WHERE id=?').run(status, po.id); }

app.get('/api/pos', auth, (req, res) => {
  res.json(q(`SELECT po.*, v.name vendor_name, u.name requester_name FROM purchase_orders po
    JOIN vendors v ON v.id=po.vendor_id JOIN users u ON u.id=po.requester_id ORDER BY po.id DESC`));
});
app.get('/api/pos/:id', auth, (req, res) => {
  const po = poDetail(req.params.id);
  if (!po) return res.status(404).json({ error: 'PO not found' });
  res.json(po);
});
app.post('/api/pos/:id/submit', auth, (req, res) => {
  const po = poRow(req.params.id);
  if (!po) return res.status(404).json({ error: 'PO not found' });
  if (po.status !== 'draft') return res.status(409).json({ error: `Only a draft PO can be submitted (current: ${po.status})` });
  setPoStatus(po, 'pending_approval');
  db.prepare("UPDATE purchase_requests SET status='submitted' WHERE id=?").run(po.request_id);
  audit(req.user, 'submit', 'purchase_order', po.po_number, `Submitted for approval — requires ${ROLE_LABELS[po.required_approver_role]} (CAD $${po.total.toFixed(2)})`);
  res.json(poDetail(po.id));
});
app.post('/api/pos/:id/approve', auth, (req, res) => {
  const po = poRow(req.params.id);
  if (!po) return res.status(404).json({ error: 'PO not found' });
  if (po.status !== 'pending_approval') return res.status(409).json({ error: `PO is not pending approval (current: ${po.status})` });
  if (!APPROVER_ROLES.includes(req.user.role))
    return res.status(403).json({ error: `Your role (${ROLE_LABELS[req.user.role]}) cannot approve purchase orders. This PO requires ${ROLE_LABELS[po.required_approver_role]}.` });
  if ((AUTHORITY[req.user.role] ?? 0) < po.total)
    return res.status(403).json({ error: `This PO totals CAD $${po.total.toFixed(2)}, above your approval authority. It requires ${ROLE_LABELS[po.required_approver_role]}.` });
  if (req.user.id === po.requester_id && po.total > (AUTHORITY[req.user.role] ?? 0))
    return res.status(403).json({ error: 'You cannot approve your own purchase above your own authority.' });
  db.prepare("UPDATE purchase_orders SET status='approved', approver_id=?, approved_at=datetime('now'), approval_comment=? WHERE id=?")
    .run(req.user.id, req.body?.comment || '', po.id);
  db.prepare("UPDATE purchase_requests SET status='approved' WHERE id=?").run(po.request_id);
  audit(req.user, 'approve', 'purchase_order', po.po_number, `Approved CAD $${po.total.toFixed(2)}${req.body?.comment ? ' — ' + req.body.comment : ''}`);
  res.json(poDetail(po.id));
});
app.post('/api/pos/:id/reject', auth, (req, res) => {
  const po = poRow(req.params.id);
  if (!po) return res.status(404).json({ error: 'PO not found' });
  if (po.status !== 'pending_approval') return res.status(409).json({ error: `PO is not pending approval (current: ${po.status})` });
  if (!APPROVER_ROLES.includes(req.user.role)) return res.status(403).json({ error: 'Your role cannot review purchase orders.' });
  db.prepare("UPDATE purchase_orders SET status='draft', approval_comment=? WHERE id=?").run(req.body?.comment || 'Rejected', po.id);
  audit(req.user, 'reject', 'purchase_order', po.po_number, `Sent back to draft — ${req.body?.comment || 'no comment'}`);
  res.json(poDetail(po.id));
});
app.post('/api/pos/:id/send', auth, (req, res) => {
  const po = poRow(req.params.id);
  if (!po) return res.status(404).json({ error: 'PO not found' });
  if (po.status !== 'approved')
    return res.status(409).json({ error: 'Blocked: a routine order cannot be sent to the supplier before its PO is approved (SOP non-negotiable rule).' });
  db.prepare("UPDATE purchase_orders SET status='sent', order_date=date('now'), vendor_confirmation=? WHERE id=?")
    .run(req.body?.confirmation || 'Order sent to vendor', po.id);
  audit(req.user, 'send', 'purchase_order', po.po_number, `Order sent to vendor — ${req.body?.confirmation || 'no confirmation note'}`);
  res.json(poDetail(po.id));
});

/* ---------------- receiving ---------------- */
app.post('/api/pos/:id/receive', auth, requireRole('receiver', 'kitchen_manager', 'executive_chef', 'gm'), (req, res) => {
  const po = poRow(req.params.id);
  if (!po) return res.status(404).json({ error: 'PO not found' });
  if (!['sent', 'partially_received'].includes(po.status))
    return res.status(409).json({ error: `PO must be sent before receiving (current: ${po.status})` });
  const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
  if (!lines.length) return res.status(400).json({ error: 'Receiving lines are required' });
  const receiptId = db.prepare('INSERT INTO receipts(po_id,receiver_id,delivery_slip,notes) VALUES(?,?,?,?)')
    .run(po.id, req.user.id, req.body.delivery_slip || '', req.body.notes || '').lastInsertRowid;
  const ins = db.prepare('INSERT INTO receipt_lines(receipt_id,po_line_id,item_name,qty_ordered,qty_accepted,qty_rejected,quality_check,temperature,expiry,issue,action) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  const newExceptions = [];
  for (const l of lines) {
    const pl = one('SELECT * FROM po_lines WHERE id=? AND po_id=?', l.po_line_id, po.id);
    if (!pl) continue;
    const acc = Number(l.qty_accepted) || 0, rej = Number(l.qty_rejected) || 0;
    ins.run(receiptId, pl.id, pl.item_name, pl.qty, acc, rej, l.quality_check || '', l.temperature || '', l.expiry || '', l.issue || '', l.action || '');
    if (pl.item_id) db.prepare('UPDATE items SET on_hand=on_hand+? WHERE id=?').run(acc, pl.item_id);
    if (rej > 0) newExceptions.push({ type: 'damaged_or_rejected', desc: `${pl.item_name}: ${rej} ${pl.unit || ''} rejected/damaged at receiving. ${l.issue || ''}`.trim(), amount: round2(rej * pl.unit_price) });
  }
  // recompute receiving completeness; body.final=true means "nothing more is coming"
  // for this delivery, so any shortfall closes the receipt and becomes an exception
  const isFinal = req.body?.final === true;
  const poLines = q('SELECT * FROM po_lines WHERE po_id=?', po.id);
  let complete = true;
  for (const pl of poLines) {
    const t = one('SELECT COALESCE(SUM(qty_accepted),0) a, COALESCE(SUM(qty_rejected),0) r FROM receipt_lines WHERE po_line_id=?', pl.id);
    if (t.a + t.r < pl.qty - 1e-9 && !isFinal) complete = false;
    else if (t.a < pl.qty - 1e-9) {
      // delivery complete for this line but short
      const already = one("SELECT id FROM exceptions WHERE po_id=? AND type='short_delivery' AND description LIKE ?", po.id, `%${pl.item_name}%`);
      if (!already) newExceptions.push({ type: 'short_delivery', desc: `${pl.item_name}: ordered ${pl.qty}, accepted ${t.a} — short delivery.`, amount: round2((pl.qty - t.a) * pl.unit_price) });
    }
  }
  for (const e of newExceptions) {
    const n = nextVal('exception');
    db.prepare('INSERT INTO exceptions(ref,po_id,vendor_id,type,description,disputed_amount,owner_id,due_date,status) VALUES(?,?,?,?,?,?,?,?,?)')
      .run('EXC-' + String(n).padStart(4, '0'), po.id, po.vendor_id, e.type, e.desc, e.amount, req.user.id, null, 'open');
  }
  setPoStatus(po, complete ? 'received' : 'partially_received');
  audit(req.user, 'receive', 'purchase_order', po.po_number, `Delivery received (slip ${req.body.delivery_slip || 'n/a'}) — PO now ${complete ? 'fully received' : 'partially received'}${newExceptions.length ? `; ${newExceptions.length} exception(s) opened` : ''}`);
  res.status(201).json(poDetail(po.id));
});

/* ---------------- invoices + three-way match ---------------- */
app.post('/api/invoices', auth, requireRole('finance'), (req, res) => {
  const b = req.body || {};
  const po = poRow(b.po_id);
  if (!po) return res.status(404).json({ error: 'PO not found' });
  if (!b.invoice_number) return res.status(400).json({ error: 'Invoice number is required' });
  if (!['received', 'partially_received', 'invoice_captured', 'exception'].includes(po.status))
    return res.status(409).json({ error: `Invoices can only be captured against a received PO (current: ${po.status})` });
  const dup = one('SELECT * FROM invoices WHERE vendor_id=? AND invoice_number=?', po.vendor_id, b.invoice_number);
  if (dup) return res.status(409).json({ error: `Duplicate invoice blocked: invoice ${b.invoice_number} from this vendor is already recorded (Invoice #${dup.id}, status ${dup.status}). Do not pay twice — investigate before proceeding.` });
  const lines = Array.isArray(b.lines) ? b.lines.filter(l => l.item_name) : [];
  const subtotal = round2(lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0));
  const tax = round2(b.tax), total = round2(subtotal + tax);
  const invId = db.prepare('INSERT INTO invoices(po_id,vendor_id,invoice_number,invoice_date,due_date,subtotal,tax,total,status,captured_by) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(po.id, po.vendor_id, b.invoice_number, b.invoice_date || null, b.due_date || null, subtotal, tax, total, 'captured', req.user.id).lastInsertRowid;
  const ins = db.prepare('INSERT INTO invoice_lines(invoice_id,item_name,qty,unit_price,line_total) VALUES(?,?,?,?,?)');
  for (const l of lines) ins.run(invId, l.item_name, Number(l.qty) || 0, Number(l.unit_price) || 0, round2(Number(l.qty || 0) * Number(l.unit_price || 0)));
  if (['received', 'partially_received'].includes(po.status)) setPoStatus(po, 'invoice_captured');
  audit(req.user, 'create', 'invoice', b.invoice_number, `Invoice captured against ${po.po_number} — CAD $${total.toFixed(2)}`);
  res.status(201).json(invoiceDetail(invId));
});
function invoiceDetail(id) {
  const inv = one(`SELECT i.*, v.name vendor_name, po.po_number, po.total po_total, po.approver_id po_approver_id, po.requester_id po_requester_id
    FROM invoices i JOIN vendors v ON v.id=i.vendor_id JOIN purchase_orders po ON po.id=i.po_id WHERE i.id=?`, id);
  if (!inv) return null;
  inv.lines = q('SELECT * FROM invoice_lines WHERE invoice_id=? ORDER BY id', id);
  return inv;
}
app.get('/api/invoices', auth, (req, res) => {
  res.json(q(`SELECT i.*, v.name vendor_name, po.po_number FROM invoices i JOIN vendors v ON v.id=i.vendor_id
    JOIN purchase_orders po ON po.id=i.po_id ORDER BY i.id DESC`));
});
app.get('/api/invoices/:id', auth, (req, res) => {
  const inv = invoiceDetail(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  res.json(inv);
});
app.post('/api/invoices/:id/match', auth, requireRole('finance'), (req, res) => {
  const inv = invoiceDetail(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (!['captured', 'exception'].includes(inv.status)) return res.status(409).json({ error: `Invoice cannot be matched in status ${inv.status}` });
  const po = poDetail(inv.po_id);
  const checks = [];
  let expected = 0, failAmount = 0, hasPriceIssue = false;
  for (const pl of po.lines) {
    const received = po.receivedByLine[pl.id]?.a || 0;
    const il = inv.lines.find(l => l.item_name.toLowerCase() === pl.item_name.toLowerCase());
    const invQty = il ? il.qty : 0, invPrice = il ? il.unit_price : null;
    const problems = [];
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
  const result = { pass, checks, expectedTotal: expected, invoiceTotal: inv.total, checkedAt: new Date().toISOString() };
  db.prepare('UPDATE invoices SET match_status=?, match_result=?, matched_at=datetime(\'now\'), status=? WHERE id=?')
    .run(pass ? 'pass' : 'fail', JSON.stringify(result), pass ? 'matched' : 'exception', inv.id);
  if (pass) {
    if (['invoice_captured', 'exception', 'received', 'partially_received'].includes(po.status)) setPoStatus(po, 'matched');
    audit(req.user, 'match', 'invoice', inv.invoice_number, `Three-way match PASSED for ${po.po_number} — expected $${expected.toFixed(2)} = invoice $${inv.total.toFixed(2)}`);
  } else {
    setPoStatus(po, 'exception');
    const n = nextVal('exception');
    const ref = 'EXC-' + String(n).padStart(4, '0');
    db.prepare('INSERT INTO exceptions(ref,po_id,invoice_id,vendor_id,type,description,disputed_amount,owner_id,status) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(ref, po.id, inv.id, inv.vendor_id, hasPriceIssue ? 'price_variance' : 'quantity_mismatch',
        `Three-way match failed for invoice ${inv.invoice_number} on ${po.po_number}: ` + checks.filter(c => c.status === 'variance').flatMap(c => c.problems).join('; '),
        round2(Math.max(failAmount, Math.abs(totalDiff))), req.user.id, 'open');
    audit(req.user, 'match', 'invoice', inv.invoice_number, `Three-way match FAILED for ${po.po_number} — exception ${ref} opened, payment blocked`);
  }
  res.json({ ...invoiceDetail(inv.id), matchResult: result });
});
app.post('/api/invoices/:id/approve-invoice', auth, (req, res) => {
  const inv = invoiceDetail(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status !== 'matched') return res.status(409).json({ error: `Invoice must pass the three-way match before invoice approval (current: ${inv.status})` });
  if (!['finance', 'gm', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Invoice approval requires Finance/AP, GM, or Admin.' });
  if (req.user.id === inv.po_approver_id) return res.status(403).json({ error: 'Separation of duties: the person who approved this PO cannot also approve its invoice. Invoice approval is independent of PO approval (SOP Step 9).' });
  if (req.user.id === inv.captured_by) return res.status(403).json({ error: 'Separation of duties: the person who captured this invoice cannot also approve it.' });
  db.prepare("UPDATE invoices SET status='invoice_approved', invoice_approver_id=?, invoice_approved_at=datetime('now') WHERE id=?").run(req.user.id, inv.id);
  setPoStatus(poRow(inv.po_id), 'invoice_approved');
  audit(req.user, 'approve', 'invoice', inv.invoice_number, 'Invoice independently approved (Step 9)');
  res.json(invoiceDetail(inv.id));
});
app.post('/api/invoices/:id/approve-payment', auth, (req, res) => {
  const inv = invoiceDetail(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status !== 'invoice_approved') return res.status(409).json({ error: `Payment can only be approved after invoice approval (current: ${inv.status})` });
  if (!['payment_approver', 'gm', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Payment approval requires the Payment Approver, GM, or Admin.' });
  if (req.user.id === inv.invoice_approver_id) return res.status(403).json({ error: 'Separation of duties: the payment approver must be different from the invoice approver (SOP Step 10).' });
  db.prepare("UPDATE invoices SET status='payment_approved', payment_approver_id=?, payment_approved_at=datetime('now') WHERE id=?").run(req.user.id, inv.id);
  setPoStatus(poRow(inv.po_id), 'payment_approved');
  audit(req.user, 'approve_payment', 'invoice', inv.invoice_number, 'Payment approved by authorized payment approver (Step 10)');
  res.json(invoiceDetail(inv.id));
});
app.post('/api/invoices/:id/pay', auth, requireRole('finance'), (req, res) => {
  const inv = invoiceDetail(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  if (inv.status !== 'payment_approved') return res.status(409).json({ error: `Payment requires prior payment approval (current: ${inv.status})` });
  const amount = round2(req.body?.amount ?? inv.total);
  const payId = db.prepare('INSERT INTO payments(invoice_id,po_id,amount,payment_date,reference,scheduled_by,approved_by) VALUES(?,?,?,?,?,?,?)')
    .run(inv.id, inv.po_id, amount, req.body?.payment_date || new Date().toISOString().slice(0, 10), req.body?.reference || '', req.user.id, inv.payment_approver_id).lastInsertRowid;
  db.prepare("UPDATE invoices SET status='paid' WHERE id=?").run(inv.id);
  setPoStatus(poRow(inv.po_id), 'paid');
  audit(req.user, 'pay', 'invoice', inv.invoice_number, `Paid CAD $${amount.toFixed(2)} ref ${req.body?.reference || 'n/a'} (Step 11)`);
  res.status(201).json({ payment: one('SELECT * FROM payments WHERE id=?', payId), invoice: invoiceDetail(inv.id) });
});
app.post('/api/pos/:id/close', auth, (req, res) => {
  const po = poRow(req.params.id);
  if (!po) return res.status(404).json({ error: 'PO not found' });
  if (po.status !== 'paid') return res.status(409).json({ error: `PO can only be closed after payment (current: ${po.status})` });
  const open = one("SELECT COUNT(*) c FROM exceptions WHERE po_id=? AND status!='resolved'", po.id).c;
  if (open > 0) return res.status(409).json({ error: `PO has ${open} unresolved exception(s). Resolve them before closing.` });
  db.prepare("UPDATE purchase_orders SET status='closed', closed_at=datetime('now') WHERE id=?").run(po.id);
  audit(req.user, 'close', 'purchase_order', po.po_number, 'PO closed — delivery, invoice and payment reconciled');
  res.json(poDetail(po.id));
});

/* ---------------- exceptions ---------------- */
const EXCEPTION_TYPES = ['short_delivery', 'damaged_or_rejected', 'substitute', 'price_variance', 'quantity_mismatch', 'no_po', 'duplicate_invoice', 'emergency', 'other'];
app.get('/api/exceptions', auth, (req, res) => {
  res.json(q(`SELECT e.*, v.name vendor_name, po.po_number, u.name owner_name FROM exceptions e
    LEFT JOIN vendors v ON v.id=e.vendor_id LEFT JOIN purchase_orders po ON po.id=e.po_id
    LEFT JOIN users u ON u.id=e.owner_id ORDER BY e.id DESC`));
});
app.post('/api/exceptions', auth, (req, res) => {
  const b = req.body || {};
  if (!EXCEPTION_TYPES.includes(b.type)) return res.status(400).json({ error: 'Valid exception type is required' });
  const n = nextVal('exception');
  const ref = 'EXC-' + String(n).padStart(4, '0');
  const id = db.prepare('INSERT INTO exceptions(ref,po_id,invoice_id,vendor_id,type,description,disputed_amount,owner_id,due_date,status) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(ref, b.po_id || null, b.invoice_id || null, b.vendor_id || null, b.type, b.description || '', round2(b.disputed_amount), b.owner_id || req.user.id, b.due_date || null, 'open').lastInsertRowid;
  audit(req.user, 'create', 'exception', ref, `Exception opened: ${b.type} — ${b.description || ''}`);
  res.status(201).json(one('SELECT * FROM exceptions WHERE id=?', id));
});
app.patch('/api/exceptions/:id', auth, (req, res) => {
  const e = one('SELECT * FROM exceptions WHERE id=?', req.params.id);
  if (!e) return res.status(404).json({ error: 'Exception not found' });
  const b = { ...e, ...req.body };
  db.prepare('UPDATE exceptions SET status=?, owner_id=?, due_date=?, resolution=?, resolved_at=? WHERE id=?')
    .run(b.status, b.owner_id, b.due_date, b.resolution, b.status === 'resolved' ? (e.resolved_at || new Date().toISOString()) : null, e.id);
  audit(req.user, 'update', 'exception', e.ref, `Exception ${e.ref} → ${b.status}${b.resolution ? ' — ' + b.resolution : ''}`);
  res.json(one('SELECT * FROM exceptions WHERE id=?', e.id));
});

/* ---------------- payments list ---------------- */
app.get('/api/payments', auth, (req, res) => {
  res.json(q(`SELECT p.*, i.invoice_number, po.po_number, v.name vendor_name FROM payments p
    JOIN invoices i ON i.id=p.invoice_id JOIN purchase_orders po ON po.id=p.po_id JOIN vendors v ON v.id=po.vendor_id ORDER BY p.id DESC`));
});

/* ---------------- dashboard / map / reports ---------------- */
function stageCounts() {
  const pos = q('SELECT status, COUNT(*) c FROM purchase_orders GROUP BY status');
  const get = (s) => pos.find(r => r.status === s)?.c || 0;
  return {
    requests: one("SELECT COUNT(*) c FROM purchase_requests WHERE status!='draft'").c,
    pendingApproval: get('pending_approval'),
    approved: get('approved'),
    sent: get('sent'), partiallyReceived: get('partially_received'), received: get('received'),
    invoiceCaptured: get('invoice_captured'), matched: get('matched'), exception: get('exception'),
    invoiceApproved: get('invoice_approved'), paymentApproved: get('payment_approved'),
    paid: get('paid'), closed: get('closed'), draft: get('draft'),
    openExceptions: one("SELECT COUNT(*) c FROM exceptions WHERE status!='resolved'").c,
  };
}
app.get('/api/dashboard', auth, (req, res) => {
  const me = req.user;
  const pending = q(`SELECT po.*, v.name vendor_name, u.name requester_name FROM purchase_orders po
    JOIN vendors v ON v.id=po.vendor_id JOIN users u ON u.id=po.requester_id
    WHERE po.status='pending_approval' ORDER BY po.id DESC`)
    .filter(po => APPROVER_ROLES.includes(me.role) && (AUTHORITY[me.role] ?? 0) >= po.total);
  const overdue = q(`SELECT i.*, v.name vendor_name, po.po_number FROM invoices i JOIN vendors v ON v.id=i.vendor_id
    JOIN purchase_orders po ON po.id=i.po_id WHERE i.due_date IS NOT NULL AND i.due_date < date('now') AND i.status!='paid' ORDER BY i.due_date`);
  const spendByCategory = q(`SELECT category, COALESCE(SUM(total),0) amount FROM purchase_orders
    WHERE status NOT IN ('draft') AND strftime('%Y-%m', created_at)=strftime('%Y-%m','now') GROUP BY category ORDER BY amount DESC`);
  const spendByVendor = q(`SELECT v.name, COALESCE(SUM(po.total),0) amount FROM purchase_orders po JOIN vendors v ON v.id=po.vendor_id
    WHERE po.status NOT IN ('draft') AND strftime('%Y-%m', po.created_at)=strftime('%Y-%m','now') GROUP BY v.name ORDER BY amount DESC`);
  const sentOrLater = one("SELECT COUNT(*) c FROM purchase_orders WHERE status IN ('sent','partially_received','received','invoice_captured','matched','exception','invoice_approved','payment_approved','paid','closed')").c;
  const approvedBeforeSend = one("SELECT COUNT(*) c FROM purchase_orders WHERE approver_id IS NOT NULL AND status IN ('sent','partially_received','received','invoice_captured','matched','exception','invoice_approved','payment_approved','paid','closed')").c;
  const receivedPOs = one("SELECT COUNT(DISTINCT po_id) c FROM receipts").c;
  const matchAttempts = one("SELECT COUNT(*) c FROM invoices WHERE match_status IS NOT NULL").c;
  const matchPass = one("SELECT COUNT(*) c FROM invoices WHERE match_status='pass'").c;
  const stages = stageCounts();
  res.json({
    myPendingApprovals: pending,
    openPOs: one("SELECT COUNT(*) c FROM purchase_orders WHERE status NOT IN ('closed','draft')").c,
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
    recentAudit: q('SELECT * FROM audit_log ORDER BY id DESC LIMIT 8'),
  });
});
app.get('/api/process-map', auth, (req, res) => {
  const s = stageCounts();
  const steps = [
    { n: 1, key: 'need', title: 'Identify the need', desc: 'Check stock, PAR, forecast, events and open POs', count: s.requests, link: '/requests' },
    { n: 2, key: 'type', title: 'Routine or emergency?', desc: 'Emergency orders need documented authorization', count: one("SELECT COUNT(*) c FROM purchase_requests WHERE type='emergency'").c, link: '/requests' },
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
  res.json({ steps, totals: s });
});
app.get('/api/reports/weekly', auth, (req, res) => {
  const openPOs = q(`SELECT po.*, v.name vendor_name, CAST(julianday('now')-julianday(po.created_at) AS INTEGER) age_days
    FROM purchase_orders po JOIN vendors v ON v.id=po.vendor_id WHERE po.status NOT IN ('closed','draft') ORDER BY po.created_at`);
  const openExceptions = q(`SELECT e.*, v.name vendor_name, po.po_number FROM exceptions e LEFT JOIN vendors v ON v.id=e.vendor_id
    LEFT JOIN purchase_orders po ON po.id=e.po_id WHERE e.status!='resolved' ORDER BY e.id`);
  const overdue = q(`SELECT i.*, v.name vendor_name, po.po_number FROM invoices i JOIN vendors v ON v.id=i.vendor_id
    JOIN purchase_orders po ON po.id=i.po_id WHERE i.due_date IS NOT NULL AND i.due_date < date('now') AND i.status!='paid'`);
  const vendorPerformance = q(`SELECT v.name,
      COUNT(DISTINCT po.id) po_count,
      COALESCE(SUM(po.total),0) spend,
      COALESCE((SELECT SUM(rl.qty_accepted) FROM receipt_lines rl JOIN receipts r ON r.id=rl.receipt_id JOIN purchase_orders p2 ON p2.id=r.po_id WHERE p2.vendor_id=v.id),0) accepted,
      COALESCE((SELECT SUM(pl.qty) FROM po_lines pl JOIN purchase_orders p3 ON p3.id=pl.po_id WHERE p3.vendor_id=v.id AND p3.status NOT IN ('draft','pending_approval')),0) ordered
    FROM vendors v LEFT JOIN purchase_orders po ON po.vendor_id=v.id AND po.status NOT IN ('draft') GROUP BY v.id ORDER BY spend DESC`);
  for (const v of vendorPerformance) v.fillRate = v.ordered > 0 ? Math.round(v.accepted / v.ordered * 100) : null;
  const creditsPending = round2(openExceptions.filter(e => ['short_delivery', 'price_variance', 'quantity_mismatch'].includes(e.type)).reduce((s, e) => s + (e.disputed_amount || 0), 0));
  res.json({ openPOs, openExceptions, overdueInvoices: overdue, vendorPerformance, creditsPending });
});

/* ---------------- audit / settings / search ---------------- */
app.get('/api/audit', auth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  res.json(q('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?', limit));
});
app.get('/api/settings', auth, (req, res) => {
  const rows = q('SELECT * FROM settings');
  res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});
app.patch('/api/settings', auth, requireRole('admin'), (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) {
    db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));
  }
  audit(req.user, 'update', 'settings', '', `Settings updated: ${Object.keys(req.body || {}).join(', ')}`);
  res.json(Object.fromEntries(q('SELECT * FROM settings').map(r => [r.key, r.value])));
});
app.get('/api/search', auth, (req, res) => {
  const s = '%' + String(req.query.q || '') + '%';
  res.json({
    pos: q('SELECT id, po_number, status, total, v.name vendor_name FROM purchase_orders po JOIN vendors v ON v.id=po.vendor_id WHERE po.po_number LIKE ? LIMIT 8', s),
    vendors: q('SELECT id, name FROM vendors WHERE name LIKE ? LIMIT 5', s),
    invoices: q('SELECT id, invoice_number, status, total FROM invoices WHERE invoice_number LIKE ? LIMIT 5', s),
    exceptions: q('SELECT id, ref, type, status FROM exceptions WHERE ref LIKE ? LIMIT 5', s),
  });
});
app.get('/api/health', (req, res) => res.json({ ok: true }));

/* Serve the built client (production single-process mode) when it exists. */
const fs = require('fs');
const path = require('path');
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

module.exports = app;
