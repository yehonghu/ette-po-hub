import { Link } from 'react-router-dom';
import { fmtDate, get, money } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Btn, Card, ErrorBanner, PageTitle, Pill, Skeleton } from '../components/ui';

export function InvoiceList() {
  const { data, error, loading } = useLoader(() => get('/api/invoices'));
  return (
    <div>
      <PageTitle title="Invoices & Three-Way Matching" sub="Steps 7–9: capture the supplier invoice against its PO, match PO ↔ receiving ↔ invoice, then approve independently."
        action={<Link to="/invoices/new"><Btn>+ Capture invoice</Btn></Link>} />
      <ErrorBanner message={error} />
      {loading ? <Skeleton rows={5} /> : !data?.length ? (
        <Card className="p-10 text-center text-sm text-slate-400">No invoices captured yet.</Card>
      ) : (
        <div className="stagger grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((i: any) => (
            <Link key={i.id} to={`/invoices/${i.id}`}>
              <Card hover className="h-full p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[16px] font-semibold text-slate-900 dark:text-white">{i.invoice_number}</span>
                  <Pill status={i.status} />
                </div>
                <div className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">{i.vendor_name} · against {i.po_number}</div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="font-display text-[20px] font-semibold text-slate-900 dark:text-white">{money(i.total)}</span>
                  <span className="text-[12px] text-slate-400">due {fmtDate(i.due_date)}</span>
                </div>
                {i.match_status && <div className={`mt-3 text-[12.5px] font-semibold ${i.match_status === 'pass' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {i.match_status === 'pass' ? '✓ Three-way match passed' : '✗ Three-way match failed — payment blocked'}
                </div>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
