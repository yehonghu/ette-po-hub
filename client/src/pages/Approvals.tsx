import { useState } from 'react';
import { Link } from 'react-router-dom';
import { get, money, post, type User } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Btn, Card, ErrorBanner, PageTitle, Pill, Skeleton, SuccessBanner } from '../components/ui';

export default function Approvals({ user }: { user: User }) {
  const dash = useLoader(() => get('/api/dashboard'));
  const invs = useLoader(() => get('/api/invoices'));
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function act(path: string, success: string) {
    setBusy(true); setErr(''); setMsg('');
    try { await post(path, {}); setMsg(success); dash.reload(); invs.reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Action failed'); }
    finally { setBusy(false); }
  }
  const matched = (invs.data || []).filter((i: any) => i.status === 'matched');
  const payPending = (invs.data || []).filter((i: any) => i.status === 'invoice_approved');

  return (
    <div>
      <PageTitle title="Approvals" sub={`Signed in as ${user.name} (${user.roleLabel}). Three separate approvals protect the cycle: PO approval, independent invoice approval, and payment approval — never the same person twice in a row.`} />
      <ErrorBanner message={err || dash.error || invs.error} />
      <SuccessBanner message={msg} />
      <div className="mt-3 grid gap-4 xl:grid-cols-3">
        <Card className="p-6">
          <h2 className="mb-1 font-display text-[16px] font-semibold text-slate-900 dark:text-white">PO approvals for you</h2>
          <p className="mb-4 text-[12.5px] text-slate-400">Step 4 — routed by CAD total to your authority.</p>
          {dash.loading ? <Skeleton rows={3} /> : !dash.data?.myPendingApprovals.length
            ? <p className="py-4 text-sm text-slate-400">No POs are waiting for your approval.</p>
            : <div className="space-y-2.5">{dash.data.myPendingApprovals.map((po: any) => (
                <div key={po.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2"><Link to={`/pos/${po.id}`} className="font-semibold text-indigo-600 dark:text-indigo-400">{po.po_number}</Link><span className="ml-auto font-semibold">{money(po.total)}</span></div>
                  <div className="mt-0.5 text-[13px] text-slate-400">{po.vendor_name} · {po.requester_name}</div>
                  <Btn className="mt-2.5 w-full" disabled={busy} onClick={() => act(`/api/pos/${po.id}/approve`, `${po.po_number} approved.`)}>Approve</Btn>
                </div>))}
              </div>}
        </Card>

        <Card className="p-6">
          <h2 className="mb-1 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Invoice approvals</h2>
          <p className="mb-4 text-[12.5px] text-slate-400">Step 9 — independent of the PO approver and the person who captured the invoice.</p>
          {invs.loading ? <Skeleton rows={3} /> : matched.length === 0
            ? <p className="py-4 text-sm text-slate-400">No matched invoices are waiting.</p>
            : <div className="space-y-2.5">{matched.map((i: any) => (
                <div key={i.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2"><Link to={`/invoices/${i.id}`} className="font-semibold text-indigo-600 dark:text-indigo-400">{i.invoice_number}</Link><Pill status={i.status} /><span className="ml-auto font-semibold">{money(i.total)}</span></div>
                  <div className="mt-0.5 text-[13px] text-slate-400">{i.po_number} · {i.vendor_name}</div>
                  <Btn className="mt-2.5 w-full" disabled={busy} onClick={() => act(`/api/invoices/${i.id}/approve-invoice`, `Invoice ${i.invoice_number} approved independently.`)}>Approve invoice</Btn>
                </div>))}
              </div>}
        </Card>

        <Card className="p-6">
          <h2 className="mb-1 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Payment approvals</h2>
          <p className="mb-4 text-[12.5px] text-slate-400">Step 10 — the payment approver must differ from the invoice approver.</p>
          {invs.loading ? <Skeleton rows={3} /> : payPending.length === 0
            ? <p className="py-4 text-sm text-slate-400">No payments are waiting for approval.</p>
            : <div className="space-y-2.5">{payPending.map((i: any) => (
                <div key={i.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center gap-2"><Link to={`/invoices/${i.id}`} className="font-semibold text-indigo-600 dark:text-indigo-400">{i.invoice_number}</Link><span className="ml-auto font-semibold">{money(i.total)}</span></div>
                  <div className="mt-0.5 text-[13px] text-slate-400">{i.po_number} · {i.vendor_name}</div>
                  <Btn className="mt-2.5 w-full" disabled={busy} onClick={() => act(`/api/invoices/${i.id}/approve-payment`, `Payment for ${i.invoice_number} approved.`)}>Approve payment</Btn>
                </div>))}
              </div>}
        </Card>
      </div>
    </div>
  );
}
