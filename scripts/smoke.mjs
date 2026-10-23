/* Full-cycle smoke test for the ette PO Hub API.
   Walks: login → request → (send blocked) → approve → send → receive →
   invoice (duplicate blocked) → match → invoice approval (separation enforced) →
   payment approval → pay → close, plus emergency validation, GM-tier routing,
   and the exception path (short delivery + price variance). */
const BASE = process.env.API_URL || 'http://localhost:4000';
let passed = 0;
function ok(cond, label) {
  if (!cond) { console.error(`FAIL: ${label}`); process.exit(1); }
  passed++; console.log(`  ok - ${label}`);
}
async function api(method, path, token, body) {
  const r = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}
async function login(email) {
  const { status, data } = await api('POST', '/api/auth/login', null, { email, password: 'demo1234' });
  if (status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

const T = {};
for (const role of ['requester', 'manager', 'chef', 'gm', 'receiver', 'finance', 'payer']) {
  T[role] = await login(`${role}@ette.local`);
}
console.log('logins ok');
const vendors = (await api('GET', '/api/vendors', T.requester)).data;
const costco = vendors.find(v => v.name.includes('Costco'));
const sysco = vendors.find(v => v.name.includes('Sysco'));
ok(costco && sysco, 'seed vendors present');

/* ---- PO-A: happy path, KM tier ($400) ---- */
let r = await api('POST', '/api/requests', T.requester, {
  type: 'routine', vendor_id: costco.id, category: 'Food ingredients', reason: 'Smoke test restock',
  lines: [
    { item_name: 'Milk 2%', spec: '4L x 4 per box, 40kg case', unit: 'box', qty: 20, est_unit_price: 15 },
    { item_name: 'Smoked salmon', spec: 'Whole side, ~40cm', unit: 'bag', qty: 20, est_unit_price: 5 },
  ],
});
ok(r.status === 201, 'request created');
const poA = r.data.po;
ok(/^ETT-PO-\d{4}$/.test(poA.po_number), `PO number format (${poA.po_number})`);
ok(poA.status === 'draft' && Math.abs(poA.total - 400) < 0.01, 'PO drafted with correct total $400');
ok(poA.required_approver_role === 'kitchen_manager', 'routes to Kitchen Manager tier (<= $500)');

r = await api('POST', `/api/pos/${poA.id}/send`, T.requester, {});
ok(r.status === 409, 'send blocked before approval (SOP hard rule)');
r = await api('POST', `/api/pos/${poA.id}/submit`, T.requester, {});
ok(r.status === 200 && r.data.status === 'pending_approval', 'PO submitted for approval');
r = await api('POST', `/api/pos/${poA.id}/approve`, T.requester, {});
ok(r.status === 403, 'requester cannot approve (no approver authority)');
r = await api('POST', `/api/pos/${poA.id}/approve`, T.manager, { comment: 'Within par and budget' });
ok(r.status === 200 && r.data.status === 'approved' && r.data.approver_name === 'Maria Lopez', 'Kitchen Manager approved, approver recorded');
r = await api('POST', `/api/pos/${poA.id}/send`, T.manager, { confirmation: 'Vendor confirmed by email' });
ok(r.status === 200 && r.data.status === 'sent', 'PO sent after approval');

const poAfresh = (await api('GET', `/api/pos/${poA.id}`, T.receiver)).data;
r = await api('POST', `/api/pos/${poA.id}/receive`, T.receiver, {
  delivery_slip: 'DS-SMOKE-1', notes: 'All good',
  lines: poAfresh.lines.map(l => ({ po_line_id: l.id, qty_accepted: l.qty, qty_rejected: 0, quality_check: 'Pass', temperature: '3C' })),
});
ok(r.status === 201 && r.data.status === 'received', 'full receiving recorded');

r = await api('POST', '/api/invoices', T.finance, {
  po_id: poA.id, invoice_number: 'INV-SMOKE-A', invoice_date: '2026-10-23', due_date: '2026-11-22', tax: 0,
  lines: [
    { item_name: 'Milk 2%', qty: 20, unit_price: 15 },
    { item_name: 'Smoked salmon', qty: 20, unit_price: 5 },
  ],
});
ok(r.status === 201, 'invoice captured');
const invA = r.data;
r = await api('POST', '/api/invoices', T.finance, { po_id: poA.id, invoice_number: 'INV-SMOKE-A', lines: [] });
ok(r.status === 409, 'duplicate invoice number blocked');
r = await api('POST', `/api/invoices/${invA.id}/match`, T.finance, {});
ok(r.status === 200 && r.data.matchResult?.pass === true, 'three-way match passes');
r = await api('POST', `/api/invoices/${invA.id}/approve-invoice`, T.finance, {});
ok(r.status === 403, 'invoice capture user cannot approve own invoice (separation)');
r = await api('POST', `/api/invoices/${invA.id}/approve-invoice`, T.manager, {});
ok(r.status === 403, 'PO approver cannot approve the invoice (separation, Step 9)');
r = await api('POST', `/api/invoices/${invA.id}/approve-invoice`, T.gm, {});
ok(r.status === 200 && r.data.status === 'invoice_approved', 'independent invoice approval by GM');
r = await api('POST', `/api/invoices/${invA.id}/approve-payment`, T.gm, {});
ok(r.status === 403, 'invoice approver cannot approve payment (separation, Step 10)');
r = await api('POST', `/api/invoices/${invA.id}/approve-payment`, T.payer, {});
ok(r.status === 200 && r.data.status === 'payment_approved', 'payment approved by Payment Approver');
r = await api('POST', `/api/invoices/${invA.id}/pay`, T.finance, { reference: 'EFT-SMOKE-1' });
ok(r.status === 201 && r.data.invoice.status === 'paid', 'payment recorded');
r = await api('POST', `/api/pos/${poA.id}/close`, T.finance, {});
ok(r.status === 200 && r.data.status === 'closed', 'PO closed after reconciliation');

/* ---- emergency validation ---- */
r = await api('POST', '/api/requests', T.requester, { type: 'emergency', vendor_id: costco.id, lines: [{ item_name: 'Milk 2%', qty: 1, est_unit_price: 15 }] });
ok(r.status === 400, 'emergency without authorizer/time/reason rejected');
r = await api('POST', '/api/requests', T.requester, {
  type: 'emergency', vendor_id: costco.id, category: 'Food ingredients', reason: 'Banquet shortfall',
  emergency_authorizer: 'Grace Thompson (GM)', emergency_time: '2026-10-23 15:40', emergency_reason: 'Unexpected banquet booking',
  lines: [{ item_name: 'Milk 2%', qty: 2, est_unit_price: 15 }],
});
ok(r.status === 201, 'documented emergency request accepted');

/* ---- GM tier routing (> $2,000) ---- */
r = await api('POST', '/api/requests', T.chef, {
  type: 'routine', vendor_id: sysco.id, category: 'Food ingredients', reason: 'Smoke bulk order',
  lines: [{ item_name: 'Atlantic salmon fillets', qty: 20, est_unit_price: 145 }],
});
const poC = r.data.po;
ok(poC.required_approver_role === 'gm', 'routes to GM tier (> $2,000)');
await api('POST', `/api/pos/${poC.id}/submit`, T.chef, {});
r = await api('POST', `/api/pos/${poC.id}/approve`, T.manager, {});
ok(r.status === 403, 'Kitchen Manager cannot approve above authority');
r = await api('POST', `/api/pos/${poC.id}/approve`, T.chef, {});
ok(r.status === 403, 'Executive Chef cannot approve $2,900 PO');
r = await api('POST', `/api/pos/${poC.id}/approve`, T.gm, {});
ok(r.status === 200, 'GM approves GM-tier PO');

/* ---- PO-B: exception path — short delivery + price variance ---- */
r = await api('POST', '/api/requests', T.requester, {
  type: 'routine', vendor_id: sysco.id, category: 'Food ingredients', reason: 'Smoke exception path',
  lines: [{ item_name: 'All-purpose flour', spec: '20kg bag', unit: 'bag', qty: 10, est_unit_price: 21 }],
});
const poB = r.data.po;
await api('POST', `/api/pos/${poB.id}/submit`, T.requester, {});
await api('POST', `/api/pos/${poB.id}/approve`, T.manager, {});
await api('POST', `/api/pos/${poB.id}/send`, T.manager, { confirmation: 'Confirmed' });
const poBfresh = (await api('GET', `/api/pos/${poB.id}`, T.receiver)).data;
r = await api('POST', `/api/pos/${poB.id}/receive`, T.receiver, {
  delivery_slip: 'DS-SMOKE-2', final: true,
  lines: poBfresh.lines.map(l => ({ po_line_id: l.id, qty_accepted: 8, qty_rejected: 0, quality_check: 'Pass', issue: 'Short delivery: 2 bags missing', action: 'Credit requested' })),
});
ok(r.status === 201 && r.data.status === 'received', 'short delivery received and marked complete-with-shortfall');
let exs = (await api('GET', '/api/exceptions', T.finance)).data.filter(e => e.po_id === poB.id && e.type === 'short_delivery');
ok(exs.length >= 1, 'short-delivery exception auto-created');
r = await api('POST', '/api/invoices', T.finance, {
  po_id: poB.id, invoice_number: 'INV-SMOKE-B', due_date: '2026-11-22', tax: 0,
  lines: [{ item_name: 'All-purpose flour', qty: 8, unit_price: 23 }],
});
const invB = r.data;
r = await api('POST', `/api/invoices/${invB.id}/match`, T.finance, {});
ok(r.status === 200 && r.data.matchResult?.pass === false, 'price variance fails the three-way match');
ok(r.data.status === 'exception', 'failed match moves invoice to exception and blocks payment');
const exc = (await api('GET', '/api/exceptions', T.finance)).data.find(e => e.invoice_id === invB.id);
ok(!!exc, 'match failure auto-created an exception record');
r = await api('PATCH', `/api/exceptions/${exc.id}`, T.finance, { status: 'resolved', resolution: 'Vendor issued credit note and corrected invoice agreed.' });
ok(r.status === 200 && r.data.status === 'resolved', 'exception can be resolved with documented resolution');

/* ---- read models ---- */
r = await api('GET', '/api/dashboard', T.gm);
ok(r.status === 200 && Array.isArray(r.data.kpis) && r.data.kpis.length === 4, 'dashboard KPIs present');
r = await api('GET', '/api/process-map', T.requester);
ok(r.status === 200 && r.data.steps.length === 11, 'process map has all 11 steps');
r = await api('GET', '/api/reports/weekly', T.finance);
ok(r.status === 200 && Array.isArray(r.data.vendorPerformance), 'weekly report present');
r = await api('GET', '/api/audit?limit=5', T.gm);
ok(r.status === 200 && r.data.length > 0, 'audit log recording actions');

console.log(`\nSMOKE TEST PASSED — ${passed} assertions`);
