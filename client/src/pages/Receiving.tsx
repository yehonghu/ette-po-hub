import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get, money, post } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Btn, Card, ErrorBanner, PageTitle, Pill, Skeleton, SuccessBanner, inputCls, labelCls } from '../components/ui';

export default function Receiving() {
  const [params] = useSearchParams();
  const list = useLoader(() => get('/api/pos'));
  const [selected, setSelected] = useState<number | null>(params.get('po') ? Number(params.get('po')) : null);
  const [po, setPo] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [slip, setSlip] = useState('');
  const [notes, setNotes] = useState('');
  const [final, setFinal] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const awaiting = (list.data || []).filter((p: any) => ['sent', 'partially_received'].includes(p.status));

  useEffect(() => {
    if (!selected) { setPo(null); return; }
    get(`/api/pos/${selected}`).then(p => {
      setPo(p);
      setRows(p.lines.map((l: any) => ({
        po_line_id: l.id, item_name: l.item_name, qty: l.qty, already: p.receivedByLine[l.id]?.a || 0,
        qty_accepted: Math.max(0, l.qty - (p.receivedByLine[l.id]?.a || 0)), qty_rejected: 0,
        quality_check: 'Pass', temperature: '', expiry: '', issue: '', action: '',
      })));
    }).catch(() => {});
  }, [selected]);

  async function submit() {
    if (!po) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await post(`/api/pos/${po.id}/receive`, { delivery_slip: slip, notes, final, lines: rows });
      setMsg(`Receiving recorded — PO is now ${r.status.replaceAll('_', ' ')}.`);
      setPo(r); list.reload();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Receiving failed'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageTitle title="Receiving" sub="Step 6: count and inspect against the PO before signing anything. Record what actually arrived — never just what was ordered." />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Awaiting delivery ({awaiting.length})</h2>
          {list.loading ? <Skeleton rows={3} /> : awaiting.length === 0
            ? <Card className="p-6 text-sm text-slate-400">Nothing is in transit right now.</Card>
            : awaiting.map((p: any) => (
              <button key={p.id} onClick={() => setSelected(p.id)} className="w-full text-left">
                <Card hover className={`p-4.5 p-4 ${selected === p.id ? 'ring-2 ring-indigo-400' : ''}`}>
                  <div className="flex items-center gap-2"><span className="font-semibold">{p.po_number}</span><Pill status={p.status} /><span className="ml-auto font-semibold">{money(p.total)}</span></div>
                  <div className="mt-1 text-[13px] text-slate-400">{p.vendor_name}</div>
                </Card>
              </button>
            ))}
        </div>

        <Card className="p-6 xl:col-span-2">
          {!po ? <p className="py-10 text-center text-sm text-slate-400">Select a PO on the left to record its delivery.</p> : (
            <div className="fade-in">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="font-display text-[18px] font-semibold text-slate-900 dark:text-white">{po.po_number} — {po.vendor_name}</h2>
                <Pill status={po.status} />
              </div>
              <ErrorBanner message={err} /><SuccessBanner message={msg} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><label className={labelCls}>Delivery slip #</label><input className={inputCls} value={slip} onChange={e => setSlip(e.target.value)} placeholder="DS-…" /></div>
                <div><label className={labelCls}>Notes</label><input className={inputCls} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Condition, driver, timing…" /></div>
              </div>
              <div className="mt-5 space-y-3">
                {rows.map((r, i) => (
                  <div key={r.po_line_id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">{r.item_name}</span>
                      <span className="text-[12.5px] text-slate-400">ordered {r.qty} · already accepted {r.already}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div><label className={labelCls}>Accepted *</label><input type="number" min="0" step="0.01" className={`${inputCls} py-2.5 text-base`} value={r.qty_accepted} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, qty_accepted: Number(e.target.value) } : x))} /></div>
                      <div><label className={labelCls}>Rejected / damaged</label><input type="number" min="0" step="0.01" className={`${inputCls} py-2.5 text-base`} value={r.qty_rejected} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, qty_rejected: Number(e.target.value) } : x))} /></div>
                      <div><label className={labelCls}>Quality check</label>
                        <select className={`${inputCls} py-2.5`} value={r.quality_check} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, quality_check: e.target.value } : x))}>
                          <option>Pass</option><option>Fail</option><option>Pass with note</option>
                        </select></div>
                      <div><label className={labelCls}>Temperature</label><input className={inputCls} placeholder="e.g. 3C (≤5C cold)" value={r.temperature} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, temperature: e.target.value } : x))} /></div>
                      <div><label className={labelCls}>Expiry / date</label><input className={inputCls} placeholder="Expiry or condition" value={r.expiry} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, expiry: e.target.value } : x))} /></div>
                      <div className="sm:col-span-2"><label className={labelCls}>Issue</label><input className={inputCls} placeholder="Short, damaged, warm, substitute…" value={r.issue} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, issue: e.target.value } : x))} /></div>
                      <div><label className={labelCls}>Action taken</label><input className={inputCls} placeholder="Credit requested, rejected at door…" value={r.action} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, action: e.target.value } : x))} /></div>
                    </div>
                  </div>
                ))}
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={final} onChange={e => setFinal(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                This delivery is final — nothing more is coming (any shortfall becomes a tracked exception)
              </label>
              <Btn onClick={submit} disabled={busy} className="mt-5 w-full py-3 text-[15px]">{busy ? 'Recording…' : 'Record receiving'}</Btn>
              <p className="mt-2.5 text-center text-[12px] text-slate-400">Rejected quantities and final shortfalls automatically open exceptions with a named owner.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
