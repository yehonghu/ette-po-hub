import { useState } from 'react';
import { Link } from 'react-router-dom';
import { STATUS_LABEL, STATUS_STEP, fmtDate, get, money } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Card, ErrorBanner, PageTitle, Pill, Skeleton } from '../components/ui';

const FILTERS = ['all', 'draft', 'pending_approval', 'approved', 'sent', 'partially_received', 'received', 'invoice_captured', 'exception', 'matched', 'invoice_approved', 'payment_approved', 'paid', 'closed'];

export default function PurchaseOrders() {
  const { data, error, loading } = useLoader(() => get('/api/pos'));
  const [filter, setFilter] = useState('all');
  const list = (data || []).filter((p: any) => filter === 'all' || p.status === filter);
  return (
    <div>
      <PageTitle title="Purchase Orders" sub="One number per order, one sequence for the whole kitchen (SOP core rule). Select a PO to see its full journey through the 11 steps." />
      <ErrorBanner message={error} />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn rounded-full px-3 py-1.5 text-[12px] font-semibold ${filter === f ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-100'}`}>
            {f === 'all' ? `All (${(data || []).length})` : STATUS_LABEL[f] || f}
          </button>
        ))}
      </div>
      {loading ? <Skeleton rows={5} /> : list.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-400">No purchase orders in this state.</Card>
      ) : (
        <div className="stagger grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((po: any) => {
            const step = STATUS_STEP[po.status] || 1;
            return (
              <Link key={po.id} to={`/pos/${po.id}`}>
                <Card hover className="h-full p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-[16px] font-semibold text-slate-900 dark:text-white">{po.po_number}</span>
                    <Pill status={po.status} />
                  </div>
                  <div className="mt-1.5 truncate text-[13px] text-slate-500 dark:text-slate-400">{po.vendor_name} · {po.category}</div>
                  <div className="mt-3 flex items-end justify-between">
                    <span className="font-display text-[20px] font-semibold text-slate-900 dark:text-white">{money(po.total)}</span>
                    <span className="text-[12px] text-slate-400">{fmtDate(po.created_at)} · {po.requester_name}</span>
                  </div>
                  <div className="mt-3.5 flex items-center gap-1">
                    {Array.from({ length: 11 }).map((_, i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? '' : 'bg-slate-100 dark:bg-slate-800'}`}
                        style={i < step ? { background: `linear-gradient(90deg,#93cf8e,#7fb2e5)` , opacity: 0.45 + (i / 11) * 0.55 } : undefined} />
                    ))}
                  </div>
                  <div className="mt-1.5 text-[11px] font-medium text-slate-400">Step {step} of 11</div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
