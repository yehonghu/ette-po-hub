import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, get, money, post } from '../lib/api';
import { Btn, Card, ErrorBanner, PageTitle, SuccessBanner, inputCls, labelCls } from '../components/ui';

type Line = { item_id: number | null; item_name: string; spec: string; unit: string; qty: number; est_unit_price: number };

export default function NewRequest() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState<number | ''>('');
  const [type, setType] = useState<'routine' | 'emergency'>('routine');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [reason, setReason] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [freight, setFreight] = useState(0);
  const [tax, setTax] = useState(0);
  const [em, setEm] = useState({ authorizer: '', time: '', reason: '' });
  const [lines, setLines] = useState<Line[]>([{ item_id: null, item_name: '', spec: '', unit: '', qty: 1, est_unit_price: 0 }]);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { get('/api/vendors').then(setVendors).catch(() => {}); }, []);
  useEffect(() => { if (vendorId) get(`/api/items?vendor_id=${vendorId}`).then(setItems).catch(() => setItems([])); }, [vendorId]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.est_unit_price) || 0), 0), [lines]);
  const total = subtotal + (Number(freight) || 0) + (Number(tax) || 0);
  const tier = total <= 500 ? 'Kitchen Manager' : total <= 2000 ? 'Executive Chef' : 'General Manager';

  function setLine(i: number, patch: Partial<Line>) {
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }
  function pickItem(i: number, itemId: string) {
    const it = items.find(x => x.id === Number(itemId));
    if (!it) return setLine(i, { item_id: null });
    setLine(i, { item_id: it.id, item_name: it.name, spec: it.spec || '', unit: it.unit || '', est_unit_price: it.guide_price });
  }

  async function submit() {
    setError(''); setWarning(''); setBusy(true);
    try {
      const r = await post('/api/requests', {
        type, vendor_id: vendorId, category, reason, needed_by: neededBy || null, delivery_date: deliveryDate || null,
        freight: Number(freight) || 0, tax: Number(tax) || 0, lines,
        emergency_authorizer: em.authorizer, emergency_time: em.time, emergency_reason: em.reason,
      });
      if (r.splitWarning) { setWarning(r.splitWarning + ' — your PO was still created as a draft.'); setTimeout(() => navigate(`/pos/${r.po.id}`), 2600); }
      else navigate(`/pos/${r.po.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to create request'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageTitle title="New purchase request" sub="Steps 1–3: identify the need, classify routine vs emergency, and prepare the request. A draft PO is generated automatically — the fix for the Excel tracker's manual re-entry." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Vendor</label>
              <select className={inputCls} value={vendorId} onChange={e => setVendorId(Number(e.target.value) || '')}>
                <option value="">Select a vendor…</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5">
            <label className={labelCls}>Purchase type (Step 2)</label>
            <div className="grid grid-cols-2 gap-2">
              {(['routine', 'emergency'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`btn rounded-xl border px-4 py-3 text-left ${type === t
                    ? t === 'emergency' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/60' : 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/60'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
                  <span className="block text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">{t === 'emergency' ? '⚑ Emergency' : 'Routine'}</span>
                  <span className="block text-[12px] text-slate-400">{t === 'emergency' ? 'Needs documented authorization' : 'Standard approval flow'}</span>
                </button>
              ))}
            </div>
          </div>

          {type === 'emergency' && (
            <div className="fade-in mt-4 grid gap-4 rounded-2xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900 dark:bg-red-950/40 sm:grid-cols-3">
              <div><label className={labelCls}>Authorizer *</label><input className={inputCls} value={em.authorizer} onChange={e => setEm({ ...em, authorizer: e.target.value })} placeholder="Name + role" /></div>
              <div><label className={labelCls}>Authorization time *</label><input className={inputCls} value={em.time} onChange={e => setEm({ ...em, time: e.target.value })} placeholder="2026-10-23 15:40" /></div>
              <div><label className={labelCls}>Reason *</label><input className={inputCls} value={em.reason} onChange={e => setEm({ ...em, reason: e.target.value })} placeholder="Why is this urgent?" /></div>
              <p className="text-[12px] text-red-500 sm:col-span-3">The server rejects emergency requests without all three fields — documentation must be completed by the next business day (SOP Step 2).</p>
            </div>
          )}

          <div className="mt-5 space-y-2.5">
            <label className={labelCls}>Line items</label>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-end gap-2">
                <div className="col-span-12 sm:col-span-4">
                  {items.length > 0 && (
                    <select className={`${inputCls} mb-1.5`} value={l.item_id ?? ''} onChange={e => pickItem(i, e.target.value)}>
                      <option value="">From vendor order guide…</option>
                      {items.map(it => <option key={it.id} value={it.id}>{it.name} — ${it.guide_price}</option>)}
                    </select>
                  )}
                  <input className={inputCls} placeholder="Item name" value={l.item_name} onChange={e => setLine(i, { item_name: e.target.value })} />
                </div>
                <div className="col-span-6 sm:col-span-3"><input className={inputCls} placeholder="Spec / pack size" value={l.spec} onChange={e => setLine(i, { spec: e.target.value })} /></div>
                <div className="col-span-3 sm:col-span-1"><input className={inputCls} placeholder="Unit" value={l.unit} onChange={e => setLine(i, { unit: e.target.value })} /></div>
                <div className="col-span-3 sm:col-span-1"><input className={inputCls} type="number" min="0" placeholder="Qty" value={l.qty} onChange={e => setLine(i, { qty: Number(e.target.value) })} /></div>
                <div className="col-span-6 sm:col-span-2"><input className={inputCls} type="number" min="0" step="0.01" placeholder="Unit $" value={l.est_unit_price} onChange={e => setLine(i, { est_unit_price: Number(e.target.value) })} /></div>
                <div className="col-span-6 text-right text-sm font-semibold sm:col-span-1">{money(l.qty * l.est_unit_price)}
                  {lines.length > 1 && <button className="btn ml-2 text-slate-300 hover:text-red-500" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} aria-label="Remove line">✕</button>}
                </div>
              </div>
            ))}
            <button className="btn text-[13px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400" onClick={() => setLines(ls => [...ls, { item_id: null, item_name: '', spec: '', unit: '', qty: 1, est_unit_price: 0 }])}>+ Add line</button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><label className={labelCls}>Reason for purchase</label><input className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="Restock to par, event, low stock…" /></div>
            <div><label className={labelCls}>Needed by</label><input className={inputCls} type="date" value={neededBy} onChange={e => setNeededBy(e.target.value)} /></div>
            <div><label className={labelCls}>Requested delivery date</label><input className={inputCls} type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Freight (CAD)</label><input className={inputCls} type="number" min="0" step="0.01" value={freight} onChange={e => setFreight(Number(e.target.value))} /></div>
              <div><label className={labelCls}>Est. tax (CAD)</label><input className={inputCls} type="number" min="0" step="0.01" value={tax} onChange={e => setTax(Number(e.target.value))} /></div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="font-display text-[16px] font-semibold text-slate-900 dark:text-white">Summary</h3>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-400">Subtotal</dt><dd className="font-semibold">{money(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Freight</dt><dd className="font-semibold">{money(freight)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Est. tax</dt><dd className="font-semibold">{money(tax)}</dd></div>
              <div className="flex justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800"><dt className="font-semibold text-slate-700 dark:text-slate-200">Total (CAD)</dt><dd className="font-display text-lg font-semibold">{money(total)}</dd></div>
            </dl>
            <div className="mt-4 rounded-xl bg-lime-50 px-3.5 py-3 text-[13px] text-lime-900 dark:bg-lime-950/60 dark:text-lime-200">
              Approval route: <span className="font-semibold">{tier}</span>
              <span className="block text-[12px] opacity-75">≤ $500 Kitchen Manager · $500.01–$2,000 Executive Chef · &gt; $2,000 GM (SOP approval matrix, totals include freight &amp; tax)</span>
            </div>
            <div className="mt-5 space-y-2.5">
              <ErrorBanner message={error} />
              <SuccessBanner message={warning} />
              <Btn onClick={submit} disabled={busy || !vendorId} className="w-full py-2.5">{busy ? 'Creating…' : 'Create request & draft PO'}</Btn>
              <p className="text-center text-[12px] text-slate-400">The PO starts as a draft — nothing can be sent to the vendor before approval.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
