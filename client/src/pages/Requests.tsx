import { Link } from 'react-router-dom';
import { fmtDate, get, money } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Btn, Card, ErrorBanner, PageTitle, Pill, Skeleton } from '../components/ui';

export default function Requests() {
  const { data, error, loading } = useLoader(() => get('/api/requests'));
  return (
    <div>
      <PageTitle title="Purchase Requests" sub="Step 1–3 of the cycle: identify the need, classify it, and prepare the request. Submitting a request drafts its PO automatically."
        action={<Link to="/requests/new"><Btn>+ New request</Btn></Link>} />
      <ErrorBanner message={error} />
      {loading ? <Skeleton rows={5} /> : !data?.length ? (
        <Card className="p-10 text-center text-sm text-slate-400">No requests yet. Create the first one.</Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                  <th className="px-5 py-3.5 font-semibold">Ref</th><th className="px-5 py-3.5 font-semibold">Type</th>
                  <th className="px-5 py-3.5 font-semibold">Vendor</th><th className="px-5 py-3.5 font-semibold">Requester</th>
                  <th className="px-5 py-3.5 font-semibold">Reason</th><th className="px-5 py-3.5 font-semibold">Total</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th><th className="px-5 py-3.5 font-semibold">Linked PO</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r: any) => (
                  <tr key={r.id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-100">{r.ref}</td>
                    <td className="px-5 py-3.5">{r.type === 'emergency'
                      ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">⚑ Emergency</span>
                      : <span className="text-slate-500 dark:text-slate-400">Routine</span>}</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{r.vendor_name}</td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{r.requester_name}</td>
                    <td className="max-w-[220px] truncate px-5 py-3.5 text-slate-500 dark:text-slate-400">{r.reason || '—'}</td>
                    <td className="px-5 py-3.5 font-semibold">{r.total != null ? money(r.total) : '—'}</td>
                    <td className="px-5 py-3.5"><Pill status={r.status} /></td>
                    <td className="px-5 py-3.5">{r.po_id ? <Link to={`/pos/${r.po_id}`} className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">{r.po_number}</Link> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-5 py-3 text-[12px] text-slate-400 dark:border-slate-800">Created dates: {data.length ? fmtDate(data[data.length - 1].created_at) + ' – ' + fmtDate(data[0].created_at) : '—'}</div>
        </Card>
      )}
    </div>
  );
}
