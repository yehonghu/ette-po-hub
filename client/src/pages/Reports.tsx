import { Link } from 'react-router-dom';
import { fmtDate, get, money } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Card, ErrorBanner, PageTitle, Pill, Skeleton } from '../components/ui';

export default function Reports() {
  const { data, error, loading } = useLoader(() => get('/api/reports/weekly'));
  if (loading) return <div><PageTitle title="Weekly Review" /><Skeleton rows={6} /></div>;
  if (error || !data) return <ErrorBanner message={error || 'Failed to load'} />;
  return (
    <div>
      <PageTitle title="Weekly Review" sub="The SOP's weekly routine (Chapters 12–13): open POs, credits and exceptions, overdue bills, and vendor performance — in one pack." />
      <div className="stagger grid grid-cols-3 gap-4">
        <Card className="p-5"><div className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Open POs</div><div className="mt-1.5 font-display text-3xl font-semibold">{data.openPOs.length}</div></Card>
        <Card className="p-5"><div className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Credits pending</div><div className="mt-1.5 font-display text-3xl font-semibold text-red-500">{money(data.creditsPending)}</div></Card>
        <Card className="p-5"><div className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Overdue bills</div><div className="mt-1.5 font-display text-3xl font-semibold">{data.overdueInvoices.length}</div></Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <h2 className="px-6 pt-6 font-display text-[16px] font-semibold">Open POs by age</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead><tr className="border-y border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800"><th className="px-6 py-2.5 font-semibold">PO</th><th className="px-4 py-2.5 font-semibold">Vendor</th><th className="px-4 py-2.5 font-semibold">Status</th><th className="px-4 py-2.5 text-right font-semibold">Age</th><th className="px-6 py-2.5 text-right font-semibold">Total</th></tr></thead>
            <tbody>{data.openPOs.map((p: any) => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                <td className="px-6 py-3"><Link to={`/pos/${p.id}`} className="font-semibold text-indigo-600 dark:text-indigo-400">{p.po_number}</Link></td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.vendor_name}</td>
                <td className="px-4 py-3"><Pill status={p.status} /></td>
                <td className="px-4 py-3 text-right">{p.age_days}d</td>
                <td className="px-6 py-3 text-right font-semibold">{money(p.total)}</td>
              </tr>))}
            </tbody>
          </table>
          {data.openPOs.length === 0 && <p className="px-6 pb-6 text-sm text-slate-400">No open POs.</p>}
        </Card>

        <Card className="overflow-hidden">
          <h2 className="px-6 pt-6 font-display text-[16px] font-semibold">Vendor performance</h2>
          <p className="px-6 text-[12.5px] text-slate-400">Fill rate = quantities accepted ÷ quantities ordered, across all live POs.</p>
          <table className="mt-3 w-full text-left text-sm">
            <thead><tr className="border-y border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800"><th className="px-6 py-2.5 font-semibold">Vendor</th><th className="px-4 py-2.5 text-right font-semibold">POs</th><th className="px-4 py-2.5 font-semibold">Fill rate</th><th className="px-6 py-2.5 text-right font-semibold">Spend</th></tr></thead>
            <tbody>{data.vendorPerformance.map((v: any) => (
              <tr key={v.name} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                <td className="px-6 py-3 font-medium">{v.name}</td>
                <td className="px-4 py-3 text-right">{v.po_count}</td>
                <td className="px-4 py-3">
                  {v.fillRate === null ? <span className="text-slate-400">—</span> : (
                    <span className="flex items-center gap-2"><span className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><span className="bar-grow block h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500" style={{ width: `${v.fillRate}%` }} /></span><span className="font-semibold">{v.fillRate}%</span></span>
                  )}
                </td>
                <td className="px-6 py-3 text-right font-semibold">{money(v.spend)}</td>
              </tr>))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 font-display text-[16px] font-semibold">Unresolved exceptions & credits</h2>
          {data.openExceptions.length === 0 ? <p className="text-sm text-slate-400">None open.</p> : data.openExceptions.map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 border-b border-slate-50 py-2.5 text-sm last:border-0 dark:border-slate-800/60">
              <span className="font-semibold">{e.ref}</span><span className="text-slate-400">{e.type.replaceAll('_', ' ')}</span>
              <span className="truncate text-slate-400">{e.po_number || ''}</span>
              <span className="ml-auto font-semibold text-red-500">{money(e.disputed_amount)}</span>
            </div>
          ))}
          <Link to="/exceptions" className="mt-3 inline-block text-[13px] font-semibold text-indigo-600 dark:text-indigo-400">Open the Exceptions center →</Link>
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 font-display text-[16px] font-semibold">Overdue bills</h2>
          {data.overdueInvoices.length === 0 ? <p className="text-sm text-slate-400">No overdue bills. Finance is happy.</p> : data.overdueInvoices.map((i: any) => (
            <div key={i.id} className="flex items-center gap-3 border-b border-slate-50 py-2.5 text-sm last:border-0 dark:border-slate-800/60">
              <Link to={`/invoices/${i.id}`} className="font-semibold text-indigo-600 dark:text-indigo-400">{i.invoice_number}</Link>
              <span className="text-slate-400">due {fmtDate(i.due_date)}</span>
              <span className="ml-auto font-semibold">{money(i.total)}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
