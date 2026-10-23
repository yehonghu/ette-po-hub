import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { get, money, post } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Btn, Card, ErrorBanner, PageTitle, inputCls, labelCls } from '../components/ui';

export default function NewInvoice() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const pos = useLoader(() => get('/api/pos'));
  const eligible = (pos.data || []).filter((p: any) => ['received', 'partially_received', 'invoice_captured', 'exception'].includes(p.status));
  const [poId, setPoId] = useState<number | ''>(params.get('po') ? Number(params.get('po')) : '');
  const [po, setPo] = useState<any>(null);
  const [number, setNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [tax, setTax] = useState(0);
  const [lines, setLines] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!poId) { setPo(null); setLines([]); return; }
    get(`/api/pos/${poId}`).then(p => {
      setPo(p);
      setLines(p.lines.map((l: any) => ({ item_name: l.item_name, qty: p.receivedByLine[l.id]?.a ?? l.qty, unit_price: l.unit_price })));
    }).catch(() => {});
  }, [poId]);

  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0);

  async function submit() {
    setError(''); setBusy(true);
    try {
      const inv = await post('/api/invoices', { po_id: poId, invoice_number: number, invoice_date: invoiceDate, due_date: dueDate || null, tax: Number(tax) || 0, lines });
      navigate(`/invoices/${inv.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to capture invoice'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageTitle title="Capture supplier invoice" sub="Step 7: record the invoice number, PO number and itemized details. The same vendor + invoice number can never be captured twice — duplicate payments are designed out." />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Purchase order</label>
              <select className={inputCls} value={poId} onChange={e => setPoId(Number(e.target.value) || '')}>
                <option value="">Select a received PO…</option>
                {eligible.map((p: any) => <option key={p.id} value={p.id}>{p.po_number} — {p.vendor_name} ({money(p.total)})</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Invoice number *</label><input className={inputCls} value={number} onChange={e => setNumber(e.target.value)} placeholder="As printed on the invoice" /></div>
            <div><label className={labelCls}>Invoice date</label><input className={inputCls} type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
            <div><label className={labelCls}>Due date</label><input className={inputCls} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
          </div>
          {po && (
            <div className="fade-in mt-6">
              <label className={labelCls}>Invoice lines (prefilled from the PO — edit to match the paper invoice exactly)</label>
              <div className="space-y-2.5">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-2">
                    <input className={`${inputCls} col-span-5`} value={l.item_name} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, item_name: e.target.value } : x))} />
                    <input className={`${inputCls} col-span-2`} type="number" min="0" step="0.01" value={l.qty} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} />
                    <input className={`${inputCls} col-span-2`} type="number" min="0" step="0.01" value={l.unit_price} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, unit_price: Number(e.target.value) } : x))} />
                    <span className="col-span-2 text-right text-sm font-semibold">{money(l.qty * l.unit_price)}</span>
                    <button className="btn col-span-1 text-slate-300 hover:text-red-500" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>✕</button>
                  </div>
                ))}
              </div>
              <button className="btn mt-2 text-[13px] font-semibold text-indigo-600 dark:text-indigo-400" onClick={() => setLines(ls => [...ls, { item_name: '', qty: 1, unit_price: 0 }])}>+ Add line (e.g. Freight / delivery)</button>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:max-w-xs">
                <div><label className={labelCls}>Tax on invoice</label><input className={inputCls} type="number" min="0" step="0.01" value={tax} onChange={e => setTax(Number(e.target.value))} /></div>
              </div>
            </div>
          )}
        </Card>
        <Card className="h-fit p-6">
          <h3 className="font-display text-[16px] font-semibold text-slate-900 dark:text-white">Totals</h3>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-400">Lines subtotal</dt><dd className="font-semibold">{money(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-400">Tax</dt><dd className="font-semibold">{money(tax)}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800"><dt className="font-semibold">Invoice total</dt><dd className="font-display text-lg font-semibold">{money(subtotal + Number(tax || 0))}</dd></div>
            {po && <div className="flex justify-between"><dt className="text-slate-400">PO total</dt><dd>{money(po.total)}</dd></div>}
          </dl>
          <div className="mt-5 space-y-2.5">
            <ErrorBanner message={error} />
            <Btn onClick={submit} disabled={busy || !poId || !number} className="w-full py-2.5">{busy ? 'Capturing…' : 'Capture invoice'}</Btn>
            <p className="text-center text-[12px] text-slate-400">Next: run the three-way match from the invoice page.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
