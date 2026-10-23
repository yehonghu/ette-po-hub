import { useState } from 'react';
import { ROLE_LABELS, get, patch, type User } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Btn, Card, ErrorBanner, PageTitle, Skeleton, SuccessBanner, inputCls, labelCls } from '../components/ui';

const DEMO_USERS = [
  ['requester@ette.local', 'Sam Carter'], ['manager@ette.local', 'Maria Lopez'], ['chef@ette.local', 'Daniel Kim'],
  ['gm@ette.local', 'Grace Thompson'], ['receiver@ette.local', 'Alex Roy'], ['finance@ette.local', 'Priya Patel'],
  ['payer@ette.local', 'Olivia Chen'], ['admin@ette.local', 'Adam Wright'],
];

export default function Settings({ user }: { user: User }) {
  const settings = useLoader(() => get('/api/settings'));
  const users = useLoader(() => get('/api/users'));
  const [t1, setT1] = useState('');
  const [t2, setT2] = useState('');
  const [prefix, setPrefix] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const isAdmin = user.role === 'admin';
  const s = settings.data;

  async function save() {
    setErr(''); setMsg('');
    try {
      await patch('/api/settings', {
        ...(t1 ? { approval_tier1_max: t1 } : {}),
        ...(t2 ? { approval_tier2_max: t2 } : {}),
        ...(prefix ? { po_prefix: prefix } : {}),
      });
      setMsg('Settings saved. New POs will route by the updated matrix.');
      settings.reload();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  }

  return (
    <div>
      <PageTitle title="Settings" sub="The approval matrix and numbering rules are configuration, not code — exactly as the SOP's management-approval page intends." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Approval matrix (CAD)</h2>
          {settings.loading || !s ? <Skeleton rows={3} /> : (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
                Current: ≤ <span className="font-semibold">${s.approval_tier1_max}</span> Kitchen Manager · ≤ <span className="font-semibold">${s.approval_tier2_max}</span> Executive Chef · above that GM. PO prefix: <span className="font-semibold">{s.po_prefix}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={labelCls}>Tier 1 max ($)</label><input className={inputCls} type="number" placeholder={s.approval_tier1_max} value={t1} onChange={e => setT1(e.target.value)} disabled={!isAdmin} /></div>
                <div><label className={labelCls}>Tier 2 max ($)</label><input className={inputCls} type="number" placeholder={s.approval_tier2_max} value={t2} onChange={e => setT2(e.target.value)} disabled={!isAdmin} /></div>
                <div><label className={labelCls}>PO prefix</label><input className={inputCls} placeholder={s.po_prefix} value={prefix} onChange={e => setPrefix(e.target.value)} disabled={!isAdmin} /></div>
              </div>
              <ErrorBanner message={err} /><SuccessBanner message={msg} />
              {isAdmin ? <Btn onClick={save}>Save settings</Btn> : <p className="text-[13px] text-slate-400">Only Admin can change these values — you're viewing as {user.roleLabel}.</p>}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-1 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Users & roles</h2>
          <p className="mb-4 text-[12.5px] text-slate-400">Demo environment — every account uses the password <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px] dark:bg-slate-800">demo1234</code>. Demo only; change before any real use.</p>
          {users.loading ? <Skeleton rows={4} /> : (
            <div className="space-y-2">
              {(users.data || []).map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/30">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[11px] font-bold text-slate-600 dark:from-slate-700 dark:to-slate-800 dark:text-slate-200">{u.name.split(' ').map((x: string) => x[0]).join('')}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{u.name}</div>
                    <div className="truncate text-[12px] text-slate-400">{u.email}</div>
                  </div>
                  <span className="whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{ROLE_LABELS[u.role] || u.role}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 text-[12px] leading-relaxed text-slate-400">
            Seeded demo accounts: {DEMO_USERS.map(d => d[0]).join(' · ')}
          </div>
        </Card>
      </div>

      <Card className="mt-4 p-6">
        <h2 className="mb-2 font-display text-[16px] font-semibold text-slate-900 dark:text-white">Design boundaries (from the SOP)</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          <li>No live Toast or MarginEdge integration in v1 — MarginEdge's PO workflow was not enabled at ette, and MarginEdge Bill Pay supports US bank accounts / USD only, so this system runs the SOP's controlled process independently and leaves clean integration points for later.</li>
          <li>No real payments are executed and no real emails are sent to vendors — sending is recorded as "marked sent + confirmation note".</li>
          <li>All amounts are CAD. Totals used for approval routing include freight, fees and estimated tax, per the SOP approval matrix.</li>
        </ul>
      </Card>
    </div>
  );
}
