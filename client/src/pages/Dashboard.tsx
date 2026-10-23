import { Link } from 'react-router-dom';
import { fmtDate, fmtDateTime, get, money, type User } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Btn, Card, ErrorBanner, PageTitle, Pill, Skeleton, StatCard } from '../components/ui';

export default function Dashboard({ user }: { user: User }) {
  const { data, error, loading } = useLoader(() => get('/api/dashboard'));
  if (loading) return <div><PageTitle title="Dashboard" /><Skeleton rows={5} /></div>;
  if (error) return <ErrorBanner message={error} />;
  const d = data;
  const maxCat = Math.max(1, ...d.spendByCategory.map((c: any) => c.amount));
  const maxVen = Math.max(1, ...d.spendByVendor.map((c: any) => c.amount));
  return (
    <div>
      <PageTitle title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${user.name.split(' ')[0]}`}
        sub={`You're signed in as ${user.roleLabel}. Here's where the kitchen purchasing cycle stands right now.`}
        action={<Link to="/requests/new"><Btn>+ New purchase request</Btn></Link>} />

      <div className="stagger grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Awaiting my approval" value={d.myPendingApprovals.length} accent="#c3d97a" sub="POs routed to your authority" />
        <StatCard label="Open POs" value={d.openPOs} accent="#f2b183" sub="Not yet closed" />
        <StatCard label="Open exceptions" value={d.openExceptions} accent="#f09a9a" sub="Need an owner & resolution" />
        <StatCard label="Committed this month" value={d.monthTotal} moneyFormat accent="#7fb2e5" sub="Across all non-draft POs" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="p-6 xl:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[17px] font-semibold text-slate-900 dark:text-white">Waiting for your approval</h2>
            <Link to="/approvals" className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Approvals inbox →</Link>
          </div>
          {d.myPendingApprovals.length === 0
            ? <p className="py-6 text-center text-sm text-slate-400">Nothing is waiting on you. The kitchen thanks you.</p>
            : <div className="space-y-2.5">
                {d.myPendingApprovals.map((po: any) => (
                  <Link key={po.id} to={`/pos/${po.id}`} className="card-hover flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{po.po_number}</span>
                    <span className="truncate text-sm text-slate-500 dark:text-slate-400">{po.vendor_name}</span>
                    <span className="ml-auto font-semibold text-slate-800 dark:text-slate-100">{money(po.total)}</span>
                    <Pill status={po.status} />
                  </Link>
                ))}
              </div>}
          {d.overdueInvoices.length > 0 && (
            <div className="mt-5 rounded-xl border border-red-100 bg-red-50/70 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/40">
              <div className="text-[13px] font-semibold text-red-700 dark:text-red-300">Overdue bills ({d.overdueInvoices.length})</div>
              {d.overdueInvoices.map((i: any) => (
                <Link key={i.id} to={`/invoices/${i.id}`} className="mt-1 flex justify-between text-[13px] text-red-600 dark:text-red-300">
                  <span>{i.invoice_number} · {i.po_number}</span><span>due {fmtDate(i.due_date)} · {money(i.total)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 xl:col-span-2">
          <h2 className="mb-1 font-display text-[17px] font-semibold text-slate-900 dark:text-white">SOP success measures</h2>
          <p className="mb-4 text-[12.5px] text-slate-400">Weekly review targets from the SOP (Chapter 13).</p>
          <div className="space-y-4">
            {d.kpis.map((k: any) => (
              <div key={k.label}>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-600 dark:text-slate-300">{k.label}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{k.value}{k.unit} <span className="font-normal text-slate-400">/ {k.target}{k.unit}</span></span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="bar-grow h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500" style={{ width: `${k.target ? Math.min(100, (k.value / Math.max(k.target, 1)) * 100) : 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 font-display text-[17px] font-semibold text-slate-900 dark:text-white">This month by category</h2>
          {d.spendByCategory.length === 0 && <p className="text-sm text-slate-400">No POs yet this month.</p>}
          <div className="space-y-3">
            {d.spendByCategory.map((c: any) => (
              <div key={c.category || 'none'}>
                <div className="flex justify-between text-[13px]"><span className="text-slate-600 dark:text-slate-300">{c.category || 'Uncategorized'}</span><span className="font-semibold">{money(c.amount)}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="bar-grow h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" style={{ width: `${(c.amount / maxCat) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <h2 className="mb-4 mt-7 font-display text-[17px] font-semibold text-slate-900 dark:text-white">By vendor</h2>
          <div className="space-y-3">
            {d.spendByVendor.map((c: any) => (
              <div key={c.name}>
                <div className="flex justify-between text-[13px]"><span className="text-slate-600 dark:text-slate-300">{c.name}</span><span className="font-semibold">{money(c.amount)}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="bar-grow h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500" style={{ width: `${(c.amount / maxVen) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[17px] font-semibold text-slate-900 dark:text-white">Recent activity</h2>
            <Link to="/audit" className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Full audit log →</Link>
          </div>
          <div className="space-y-1">
            {d.recentAudit.map((a: any) => (
              <div key={a.id} className="flex gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-300 dark:bg-indigo-500" />
                <div className="min-w-0">
                  <div className="text-[13.5px] text-slate-700 dark:text-slate-200"><span className="font-semibold">{a.user_name}</span> · {a.action} <span className="font-medium">{a.entity_id}</span></div>
                  <div className="truncate text-[12.5px] text-slate-400">{a.details} · {fmtDateTime(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
