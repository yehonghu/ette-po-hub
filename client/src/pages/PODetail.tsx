import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ROLE_LABELS, STATUS_STEP, STEPS, fmtDate, fmtDateTime, get, money, post, type User } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Btn, Card, ErrorBanner, Pill, Skeleton, SuccessBanner, inputCls } from '../components/ui';

function Stepper({ status }: { status: string }) {
  const current = STATUS_STEP[status] || 1;
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-[880px] items-start">
        {STEPS.map((s, i) => {
          const done = s.n < current || status === 'closed';
          const isCurrent = s.n === current && status !== 'closed';
          return (
            <div key={s.n} className="flex flex-1 items-start last:flex-none">
              <div className="flex w-[76px] flex-col items-center text-center">
                <span className={`relative flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-all duration-500 ${done ? 'text-white' : isCurrent ? 'text-slate-800 dark:text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}
                  style={done ? { background: s.color } : isCurrent ? { background: s.tint, boxShadow: `0 0 0 2px ${s.color}, 0 0 0 6px ${s.tint}` } : undefined}>
                  {done ? '✓' : s.n}
                  {isCurrent && <span className="pulse-soft absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900" style={{ background: s.color }} />}
                </span>
                <span className={`mt-2 text-[10.5px] font-medium leading-tight ${isCurrent ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>{s.title}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="mx-1 mt-[17px] h-[3px] flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="bar-grow h-full rounded-full" style={{ width: done || isCurrent ? '100%' : '0%', background: STEPS[i + 1].color }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PODetail({ user }: { user: User }) {
  const { id } = useParams();
  const { data: po, error, loading, reload } = useLoader(() => get(`/api/pos/${id}`), [id]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [comment, setComment] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  async function act(path: string, body: unknown, success: string) {
    setBusy(true); setErr(''); setMsg('');
    try { await post(path, body); setMsg(success); await reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Action failed'); }
    finally { setBusy(false); }
  }

  if (loading) return <Skeleton rows={6} />;
  if (error || !po) return <ErrorBanner message={error || 'PO not found'} />;
  const canApprove = ['kitchen_manager', 'executive_chef', 'gm', 'admin'].includes(user.role);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/pos" className="text-sm font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">← All POs</Link>
        <h1 className="font-display text-[26px] font-semibold text-slate-900 dark:text-white">{po.po_number}</h1>
        <Pill status={po.status} />
        <span className="text-sm text-slate-400">{po.vendor_name} · requested by {po.requester_name}</span>
        <span className="ml-auto font-display text-[22px] font-semibold text-slate-900 dark:text-white">{money(po.total)}</span>
        <button onClick={() => window.print()} className="no-print"><Btn variant="ghost">Print PO</Btn></button>
      </div>

      {po.split_warning && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">⚠ {po.split_warning}</div>
      )}

      <Card className="mb-4 p-5"><Stepper status={po.status} /></Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-6">
            <h2 className="mb-4 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Line items</h2>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-sm">
              <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                <th className="whitespace-nowrap px-3 py-2 font-semibold">Item</th><th className="whitespace-nowrap px-3 py-2 font-semibold">Spec</th><th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Qty</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Received</th><th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Unit price</th><th className="whitespace-nowrap px-3 py-2 text-right font-semibold">Line total</th></tr></thead>
              <tbody>
                {po.lines.map((l: any) => (
                  <tr key={l.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                    <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">{l.item_name}</td>
                    <td className="px-3 py-2.5 text-slate-400">{l.spec || '—'}</td>
                    <td className="px-3 py-2.5 text-right">{l.qty} {l.unit}</td>
                    <td className="px-3 py-2.5 text-right">{po.receivedByLine[l.id]?.a ?? 0}</td>
                    <td className="px-3 py-2.5 text-right">{money(l.unit_price)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{money(l.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <dl className="ml-auto mt-4 w-64 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-400">Subtotal</dt><dd>{money(po.subtotal)}</dd></div>
              {!!po.discount && <div className="flex justify-between"><dt className="text-slate-400">Discount</dt><dd>−{money(po.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-slate-400">Freight</dt><dd>{money(po.freight)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-400">Tax</dt><dd>{money(po.tax)}</dd></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold dark:border-slate-800"><dt>Total (CAD)</dt><dd>{money(po.total)}</dd></div>
            </dl>
          </Card>

          {po.receipts.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-4 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Receiving records</h2>
              {po.receipts.map((r: any) => (
                <div key={r.id} className="mb-4 last:mb-0">
                  <div className="text-[13px] text-slate-500 dark:text-slate-400">Slip {r.delivery_slip || '—'} · received by {r.receiver_name} · {fmtDateTime(r.received_at)}{r.notes ? ` · ${r.notes}` : ''}</div>
                  <div className="overflow-x-auto">
                  <table className="mt-2 w-full min-w-[620px] text-sm">
                    <thead><tr className="text-left text-[11px] uppercase tracking-wider text-slate-400"><th className="whitespace-nowrap px-3 py-1 font-semibold">Item</th><th className="whitespace-nowrap px-3 py-1 text-right font-semibold">Ordered</th><th className="whitespace-nowrap px-3 py-1 text-right font-semibold">Accepted</th><th className="whitespace-nowrap px-3 py-1 text-right font-semibold">Rejected</th><th className="whitespace-nowrap px-3 py-1 font-semibold">Quality</th><th className="whitespace-nowrap px-3 py-1 font-semibold">Issue / action</th></tr></thead>
                    <tbody>{r.lines.map((l: any) => (
                      <tr key={l.id} className="border-t border-slate-50 dark:border-slate-800/60">
                        <td className="px-3 py-1.5">{l.item_name}</td><td className="px-3 py-1.5 text-right">{l.qty_ordered}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{l.qty_accepted}</td><td className="px-3 py-1.5 text-right">{l.qty_rejected}</td>
                        <td className="px-3 py-1.5">{l.quality_check || '—'}{l.temperature ? ` · ${l.temperature}` : ''}</td>
                        <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">{[l.issue, l.action].filter(Boolean).join(' → ') || '—'}</td>
                      </tr>))}</tbody>
                  </table>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {po.invoices.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-4 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Invoices</h2>
              <div className="space-y-2.5">
                {po.invoices.map((i: any) => (
                  <Link key={i.id} to={`/invoices/${i.id}`} className="card-hover flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="font-semibold">{i.invoice_number}</span>
                    <span className="text-sm text-slate-400">due {fmtDate(i.due_date)}</span>
                    <span className="ml-auto font-semibold">{money(i.total)}</span>
                    <Pill status={i.status} />
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {po.exceptions.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-4 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Exceptions on this PO</h2>
              <div className="space-y-2.5">
                {po.exceptions.map((e: any) => (
                  <div key={e.id} className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{e.ref} · {e.type.replaceAll('_', ' ')}</div>
                      <div className="text-[13px] text-slate-500 dark:text-slate-400">{e.description}</div>
                    </div>
                    <span className="font-semibold text-red-600 dark:text-red-300">{money(e.disputed_amount)}</span>
                    <Pill status={e.status} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="no-print p-6">
            <h2 className="mb-1 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Actions</h2>
            <p className="mb-4 text-[12.5px] text-slate-400">Every action is permission-checked on the server and written to the audit log.</p>
            <ErrorBanner message={err} /><SuccessBanner message={msg} />
            <div className="mt-3 space-y-2.5">
              {po.status === 'draft' && (
                <Btn className="w-full" disabled={busy} onClick={() => act(`/api/pos/${po.id}/submit`, {}, 'Submitted for approval.')}>Submit for approval →</Btn>
              )}
              {po.status === 'pending_approval' && (
                <>
                  <div className="rounded-xl bg-slate-50 px-3.5 py-3 text-[13px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                    Requires <span className="font-semibold">{ROLE_LABELS[po.required_approver_role] || po.required_approver_role}</span> (total {money(po.total)})
                  </div>
                  <input className={inputCls} placeholder="Approval comment (optional)" value={comment} onChange={e => setComment(e.target.value)} />
                  <Btn className="w-full" disabled={busy || !canApprove} onClick={() => act(`/api/pos/${po.id}/approve`, { comment }, 'PO approved.')}>Approve PO</Btn>
                  <Btn variant="ghost" className="w-full" disabled={busy || !canApprove} onClick={() => act(`/api/pos/${po.id}/reject`, { comment }, 'Sent back to draft.')}>Send back to draft</Btn>
                  {!canApprove && <p className="text-[12px] text-slate-400">Your role ({user.roleLabel}) cannot approve POs — sign in as the routed approver.</p>}
                </>
              )}
              {po.status === 'approved' && (
                <>
                  <input className={inputCls} placeholder="Vendor confirmation note" value={confirmation} onChange={e => setConfirmation(e.target.value)} />
                  <Btn className="w-full" disabled={busy} onClick={() => act(`/api/pos/${po.id}/send`, { confirmation }, 'Order marked as sent to vendor.')}>Mark order sent to vendor</Btn>
                </>
              )}
              {['sent', 'partially_received'].includes(po.status) && (
                <Link to={`/receiving?po=${po.id}`}><Btn className="w-full">Receive this delivery →</Btn></Link>
              )}
              {['received', 'partially_received', 'invoice_captured', 'exception'].includes(po.status) && (
                <Link to={`/invoices/new?po=${po.id}`}><Btn variant="soft" className="w-full">Capture supplier invoice</Btn></Link>
              )}
              {po.status === 'paid' && (
                <Btn className="w-full" disabled={busy} onClick={() => act(`/api/pos/${po.id}/close`, {}, 'PO closed.')}>Close PO</Btn>
              )}
              {['closed'].includes(po.status) && <p className="text-center text-sm text-emerald-600 dark:text-emerald-400">✓ This PO is fully reconciled and closed.</p>}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Details</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Vendor</dt><dd className="text-right font-medium">{po.vendor_name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Category</dt><dd className="text-right font-medium">{po.category || '—'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Requested by</dt><dd className="text-right font-medium">{po.requester_name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Created</dt><dd className="text-right font-medium">{fmtDateTime(po.created_at)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Delivery date</dt><dd className="text-right font-medium">{fmtDate(po.delivery_date)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-400">Order date</dt><dd className="text-right font-medium">{fmtDate(po.order_date)}</dd></div>
              {po.approver_name && <div className="flex justify-between gap-3"><dt className="text-slate-400">Approved by</dt><dd className="text-right font-medium">{po.approver_name} · {fmtDateTime(po.approved_at)}</dd></div>}
              {po.approval_comment && <div className="flex justify-between gap-3"><dt className="text-slate-400">Approval note</dt><dd className="text-right font-medium">{po.approval_comment}</dd></div>}
              {po.vendor_confirmation && <div className="flex justify-between gap-3"><dt className="text-slate-400">Vendor confirmation</dt><dd className="text-right font-medium">{po.vendor_confirmation}</dd></div>}
              {po.payments.map((p: any) => (
                <div key={p.id} className="flex justify-between gap-3"><dt className="text-slate-400">Payment</dt><dd className="text-right font-medium">{money(p.amount)} · {p.reference || 'no ref'} · {fmtDate(p.payment_date)}</dd></div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
