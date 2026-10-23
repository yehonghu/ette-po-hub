import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDate, get, money, post } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Btn, Card, ErrorBanner, Pill, Skeleton, SuccessBanner, inputCls, labelCls } from '../components/ui';

export default function InvoiceDetail() {
  const { id } = useParams();
  const { data: inv, error, loading, reload } = useLoader(() => get(`/api/invoices/${id}`), [id]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  async function act(path: string, body: unknown, success: string) {
    setBusy(true); setErr(''); setMsg('');
    try { await post(path, body); setMsg(success); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Action failed'); }
    finally { setBusy(false); }
  }

  if (loading) return <Skeleton rows={6} />;
  if (error || !inv) return <ErrorBanner message={error || 'Invoice not found'} />;
  const match = inv.match_result ? JSON.parse(inv.match_result) : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/invoices" className="text-sm font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">← All invoices</Link>
        <h1 className="font-display text-[26px] font-semibold text-slate-900 dark:text-white">{inv.invoice_number}</h1>
        <Pill status={inv.status} />
        <span className="text-sm text-slate-400">{inv.vendor_name} · against <Link to={`/pos/${inv.po_id}`} className="font-semibold text-indigo-600 dark:text-indigo-400">{inv.po_number}</Link></span>
        <span className="ml-auto font-display text-[22px] font-semibold text-slate-900 dark:text-white">{money(inv.total)}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-6">
            <h2 className="mb-4 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Invoice lines</h2>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Item</th><th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Qty</th><th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Unit price</th><th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Line total</th></tr></thead>
              <tbody>
                {inv.lines.map((l: any) => (
                  <tr key={l.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                    <td className="px-3 py-2.5 font-medium">{l.item_name}</td><td className="px-3 py-2.5 text-right">{l.qty}</td>
                    <td className="px-3 py-2.5 text-right">{money(l.unit_price)}</td><td className="px-3 py-2.5 text-right font-semibold">{money(l.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <dl className="ml-auto mt-4 w-60 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-400">Subtotal</dt><dd>{money(inv.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Tax</dt><dd>{money(inv.tax)}</dd></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold dark:border-slate-800"><dt>Total</dt><dd>{money(inv.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Invoice date</dt><dd>{fmtDate(inv.invoice_date)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Due date</dt><dd>{fmtDate(inv.due_date)}</dd></div>
            </dl>
          </Card>

          <Card className="p-6">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-semibold text-slate-900 dark:text-white">Three-way match (Step 8)</h2>
              {inv.match_status && <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold ${inv.match_status === 'pass' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
                {inv.match_status === 'pass' ? '✓ MATCH PASSED' : '✗ MATCH FAILED'}</span>}
            </div>
            <p className="mb-4 text-[13px] text-slate-400">What was authorized (PO) vs what actually arrived (receiving record) vs what the supplier is asking to be paid (invoice).</p>
            {!match ? <p className="text-sm text-slate-400">Not matched yet — run the match to unlock invoice approval.</p> : (
              <div className="overflow-x-auto">
              <table className="w-full min-w-[660px] text-sm">
                <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">Item</th><th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Ordered</th><th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Received</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Invoiced</th><th className="whitespace-nowrap px-3 py-2 text-right font-semibold">PO price</th><th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Inv price</th><th className="whitespace-nowrap px-3 py-2 font-semibold">Result</th></tr></thead>
                <tbody>
                  {match.checks.map((c: any, i: number) => (
                    <tr key={i} className={`border-b border-slate-50 last:border-0 dark:border-slate-800/60 ${c.status === 'variance' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}>
                      <td className="px-3 py-2.5 font-medium">{c.item}</td>
                      <td className="px-3 py-2.5 text-right">{c.ordered ?? '—'}</td><td className="px-3 py-2.5 text-right">{c.received ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right">{c.invoicedQty ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right">{c.poPrice != null ? money(c.poPrice) : '—'}</td>
                      <td className="px-3 py-2.5 text-right">{c.invoicePrice != null ? money(c.invoicePrice) : '—'}</td>
                      <td className="px-3 py-2.5">{c.status === 'ok' ? <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ OK</span>
                        : <span className="text-[12.5px] font-medium text-red-600 dark:text-red-300">{c.problems.join('; ')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {match && <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400">Expected total (received × PO price + freight/tax): <span className="font-semibold">{money(match.expectedTotal)}</span> · Invoice total: <span className="font-semibold">{money(match.invoiceTotal)}</span></p>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="mb-1 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Workflow</h2>
            <p className="mb-4 text-[12.5px] text-slate-400">Steps 8–11. Separation of duties is enforced by the server, not by trust.</p>
            <ErrorBanner message={err} /><SuccessBanner message={msg} />
            <div className="mt-3 space-y-2.5">
              {['captured', 'exception'].includes(inv.status) && (
                <Btn className="w-full" disabled={busy} onClick={() => act(`/api/invoices/${inv.id}/match`, {}, 'Match run — see results.')}>{inv.match_status === 'fail' ? 'Re-run three-way match' : 'Run three-way match'}</Btn>
              )}
              {inv.status === 'matched' && (
                <Btn className="w-full" disabled={busy} onClick={() => act(`/api/invoices/${inv.id}/approve-invoice`, {}, 'Invoice independently approved.')}>Approve invoice (Step 9)</Btn>
              )}
              {inv.status === 'invoice_approved' && (
                <Btn className="w-full" disabled={busy} onClick={() => act(`/api/invoices/${inv.id}/approve-payment`, {}, 'Payment approved.')}>Approve payment (Step 10)</Btn>
              )}
              {inv.status === 'payment_approved' && (
                <>
                  <div><label className={labelCls}>Payment reference</label><input className={inputCls} value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="EFT / cheque reference" /></div>
                  <div><label className={labelCls}>Payment date</label><input className={inputCls} type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
                  <Btn className="w-full" disabled={busy} onClick={() => act(`/api/invoices/${inv.id}/pay`, { reference: payRef, payment_date: payDate }, 'Payment recorded.')}>Record payment (Step 11)</Btn>
                </>
              )}
              {inv.status === 'paid' && <p className="text-center text-sm text-emerald-600 dark:text-emerald-400">✓ Paid. The PO can now be closed from its page.</p>}
              {inv.status === 'exception' && <p className="text-[12.5px] text-slate-400">Payment is blocked while this invoice is in exception. Resolve the variance in the Exceptions center, correct the record, then re-run the match.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
