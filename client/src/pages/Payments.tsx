import { Link } from 'react-router-dom';
import { fmtDate, get, money } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Card, ErrorBanner, PageTitle, Pill, Skeleton } from '../components/ui';

export default function Payments() {
  const pays = useLoader(() => get('/api/payments'));
  const invs = useLoader(() => get('/api/invoices'));
  const queue = (invs.data || []).filter((i: any) => ['invoice_approved', 'payment_approved', 'matched'].includes(i.status));
  return (
    <div>
      <PageTitle title="Payments" sub="Step 10–11: verify terms, vendor details and payment authority — then pay, record the reference, and close the PO." />
      <ErrorBanner message={pays.error || invs.error} />
      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="p-6 xl:col-span-2">
          <h2 className="mb-4 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Payment queue</h2>
          {invs.loading ? <Skeleton rows={3} /> : queue.length === 0
            ? <p className="py-4 text-sm text-slate-400">Nothing is waiting on payment steps.</p>
            : <div className="space-y-2.5">{queue.map((i: any) => (
              <Link key={i.id} to={`/invoices/${i.id}`} className="card-hover flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="font-semibold">{i.invoice_number}</span>
                <span className="truncate text-[13px] text-slate-400">{i.po_number} · due {fmtDate(i.due_date)}</span>
                <span className="ml-auto font-semibold">{money(i.total)}</span>
                <Pill status={i.status} />
              </Link>))}
            </div>}
          <p className="mt-4 text-[12.5px] leading-relaxed text-slate-400">Payment approval (Step 10) and recording a payment (Step 11) happen on the invoice page so the full evidence trail stays in one place. Vendor banking-detail changes must be verified independently by phone before paying — never trust the email that requested the change.</p>
        </Card>
        <Card className="overflow-hidden xl:col-span-3">
          <h2 className="px-6 pt-6 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Payment history</h2>
          {pays.loading ? <div className="p-6"><Skeleton rows={3} /></div> : !pays.data?.length
            ? <p className="p-6 text-sm text-slate-400">No payments recorded yet.</p>
            : <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                  <th className="px-6 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Invoice</th><th className="px-4 py-3 font-semibold">PO</th>
                  <th className="px-4 py-3 font-semibold">Vendor</th><th className="px-4 py-3 font-semibold">Reference</th><th className="px-6 py-3 text-right font-semibold">Amount</th></tr></thead>
                <tbody>{pays.data.map((p: any) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                    <td className="px-6 py-3.5">{fmtDate(p.payment_date)}</td>
                    <td className="px-4 py-3.5 font-medium">{p.invoice_number}</td>
                    <td className="px-4 py-3.5"><Link to={`/pos/${p.po_id}`} className="font-semibold text-indigo-600 dark:text-indigo-400">{p.po_number}</Link></td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">{p.vendor_name}</td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">{p.reference || '—'}</td>
                    <td className="px-6 py-3.5 text-right font-semibold">{money(p.amount)}</td>
                  </tr>))}
                </tbody>
              </table>
            </div>}
        </Card>
      </div>
    </div>
  );
}
