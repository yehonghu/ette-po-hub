import { useState } from 'react';
import { fmtDateTime, get } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Card, ErrorBanner, PageTitle, Skeleton } from '../components/ui';

export default function Audit() {
  const { data, error, loading } = useLoader(() => get('/api/audit?limit=200'));
  const [entity, setEntity] = useState('all');
  const entitySet = new Set<string>();
  (data || []).forEach((a: any) => { if (a.entity) entitySet.add(String(a.entity)); });
  const entities: string[] = ['all', ...entitySet];
  const list = (data || []).filter((a: any) => entity === 'all' || a.entity === entity);
  return (
    <div>
      <PageTitle title="Audit Log" sub="Every create, approval, receiving, match, exception and payment — who did it, and when. The audit trail the SOP demands." />
      <ErrorBanner message={error} />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {entities.map(e => (
          <button key={e} onClick={() => setEntity(e)} className={`btn rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize ${entity === e ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>{e.replaceAll('_', ' ')}</button>
        ))}
      </div>
      {loading ? <Skeleton rows={6} /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                <th className="px-5 py-3.5 font-semibold">When</th><th className="px-5 py-3.5 font-semibold">Who</th><th className="px-5 py-3.5 font-semibold">Action</th>
                <th className="px-5 py-3.5 font-semibold">Record</th><th className="px-5 py-3.5 font-semibold">Details</th></tr></thead>
              <tbody>
                {list.map((a: any) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-400">{fmtDateTime(a.created_at)}</td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium">{a.user_name}</td>
                    <td className="px-5 py-3"><span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{a.action}</span></td>
                    <td className="whitespace-nowrap px-5 py-3 font-medium">{a.entity_id}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
