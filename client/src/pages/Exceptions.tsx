import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EXCEPTION_TYPES, fmtDate, get, money, patch, post } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Btn, Card, ErrorBanner, Modal, PageTitle, Pill, Skeleton, SuccessBanner, inputCls, labelCls } from '../components/ui';

export default function Exceptions() {
  const { data, error, loading, reload } = useLoader(() => get('/api/exceptions'));
  const users = useLoader(() => get('/api/users'));
  const [filter, setFilter] = useState('open');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ type: 'short_delivery', description: '', disputed_amount: 0, due_date: '' });
  const [resolutions, setResolutions] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const list = (data || []).filter((e: any) => filter === 'all' || (filter === 'open' ? e.status !== 'resolved' : e.status === 'resolved'));
  const totalDisputed = list.reduce((s: number, e: any) => s + (e.status !== 'resolved' ? e.disputed_amount || 0 : 0), 0);

  async function resolve(e: any) {
    setErr(''); setMsg('');
    try { await patch(`/api/exceptions/${e.id}`, { status: 'resolved', resolution: resolutions[e.id] || 'Resolved' }); setMsg(`${e.ref} resolved.`); reload(); }
    catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); }
  }
  async function create() {
    setErr('');
    try { await post('/api/exceptions', form); setCreateOpen(false); setMsg('Exception opened with a named owner (you).'); reload(); }
    catch (x) { setErr(x instanceof Error ? x.message : 'Failed'); }
  }

  return (
    <div>
      <PageTitle title="Exceptions Center" sub="Every variance gets a named owner, a due date, and a documented resolution (SOP Chapter 9). Nothing disputed is paid until it is resolved."
        action={<Btn onClick={() => setCreateOpen(true)}>+ Log exception</Btn>} />
      <ErrorBanner message={err || error} /><SuccessBanner message={msg} />
      <div className="mb-5 mt-3 flex flex-wrap items-center gap-2">
        {[['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`btn rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${filter === k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>{l}</button>
        ))}
        <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">Open disputed total: <span className="font-display text-[16px] font-semibold text-red-500">{money(totalDisputed)}</span></span>
      </div>
      {loading ? <Skeleton rows={5} /> : list.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-400">No exceptions in this view. Clean kitchen.</Card>
      ) : (
        <div className="stagger space-y-3">
          {list.map((e: any) => (
            <Card key={e.id} className="p-5">
              <div className="flex flex-wrap items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[15px] dark:bg-red-950">⚠</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{e.ref}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{e.type.replaceAll('_', ' ')}</span>
                    <Pill status={e.status} />
                    {e.po_number && <Link to={`/pos/${e.po_id}`} className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400">{e.po_number}</Link>}
                    <span className="text-[13px] text-slate-400">{e.vendor_name || ''}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{e.description}</p>
                  <div className="mt-1.5 text-[12.5px] text-slate-400">Owner: {e.owner_name || '—'} · Due: {fmtDate(e.due_date)} · Opened {fmtDate(e.created_at)}</div>
                  {e.resolution && <div className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[13px] text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Resolution: {e.resolution}</div>}
                  {e.status !== 'resolved' && (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input className={inputCls} placeholder="Resolution / outcome (credit note, corrected invoice, follow-up delivery…)" value={resolutions[e.id] || ''} onChange={ev => setResolutions(r => ({ ...r, [e.id]: ev.target.value }))} />
                      <Btn variant="soft" onClick={() => resolve(e)} className="shrink-0">Resolve</Btn>
                    </div>
                  )}
                </div>
                <span className="font-display text-[18px] font-semibold text-slate-900 dark:text-white">{money(e.disputed_amount)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Log an exception">
        <div className="space-y-4">
          <div><label className={labelCls}>Type</label>
            <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {EXCEPTION_TYPES.map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
            </select></div>
          <div><label className={labelCls}>Description & evidence</label><textarea className={inputCls} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What happened, what evidence is kept (slip, photo, vendor email)…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Disputed amount (CAD)</label><input className={inputCls} type="number" min="0" step="0.01" value={form.disputed_amount} onChange={e => setForm({ ...form, disputed_amount: Number(e.target.value) })} /></div>
            <div><label className={labelCls}>Due date</label><input className={inputCls} type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
          </div>
          <p className="text-[12px] text-slate-400">Owner defaults to you ({users.data ? 'signed-in user' : ''}). Owners are accountable for the next action and due date.</p>
          <Btn onClick={create} className="w-full">Open exception</Btn>
        </div>
      </Modal>
    </div>
  );
}
