import { useState } from 'react';
import { CATEGORIES, get, money, patch, post, type User } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { Btn, Card, ErrorBanner, Modal, PageTitle, Skeleton, SuccessBanner, inputCls, labelCls } from '../components/ui';

export default function Vendors({ user }: { user: User }) {
  const vendors = useLoader(() => get('/api/vendors'));
  const items = useLoader(() => get('/api/items'));
  const [selected, setSelected] = useState<number | null>(null);
  const [addVendor, setAddVendor] = useState(false);
  const [vForm, setVForm] = useState({ name: '', contact_name: '', email: '', phone: '', terms: 'Net 30', delivery_days: '', min_order: 0 });
  const [iForm, setIForm] = useState({ name: '', spec: '', unit: '', category: CATEGORIES[0], guide_price: 0, par_level: 0, on_hand: 0 });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const canEdit = ['kitchen_manager', 'executive_chef', 'gm', 'admin'].includes(user.role);
  const vItems = (items.data || []).filter((i: any) => !selected || i.vendor_id === selected);

  async function createVendor() {
    setErr('');
    try { await post('/api/vendors', vForm); setAddVendor(false); setMsg('Vendor added. It can now be used on purchase requests.'); vendors.reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  }
  async function createItem() {
    if (!selected) return;
    setErr('');
    try { await post('/api/items', { ...iForm, vendor_id: selected }); setIForm({ name: '', spec: '', unit: '', category: CATEGORIES[0], guide_price: 0, par_level: 0, on_hand: 0 }); setMsg('Item added to the order guide.'); items.reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  }
  async function updateStock(item: any, field: 'par_level' | 'on_hand', value: number) {
    try { await patch(`/api/items/${item.id}`, { [field]: value }); items.reload(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
  }

  return (
    <div>
      <PageTitle title="Vendors & Items" sub="Approved vendors, order guides, and par levels — the master data every PO is priced and checked against."
        action={canEdit ? <Btn onClick={() => setAddVendor(true)}>+ Add vendor</Btn> : undefined} />
      <ErrorBanner message={err || vendors.error} /><SuccessBanner message={msg} />
      <div className="mt-3 grid gap-4 xl:grid-cols-3">
        <div className="space-y-3">
          {vendors.loading ? <Skeleton rows={4} /> : (vendors.data || []).map((v: any) => (
            <button key={v.id} onClick={() => setSelected(sel => sel === v.id ? null : v.id)} className="w-full text-left">
              <Card hover className={`p-5 ${selected === v.id ? 'ring-2 ring-indigo-400' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[16px] font-semibold text-slate-900 dark:text-white">{v.name}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{v.terms}</span>
                </div>
                <div className="mt-1.5 space-y-0.5 text-[13px] text-slate-500 dark:text-slate-400">
                  <div>{v.contact_name} · {v.phone}</div>
                  <div>{v.email}</div>
                  <div>Delivery: {v.delivery_days || '—'} · Min order {money(v.min_order)}</div>
                  {v.notes && <div className="text-slate-400">{v.notes}</div>}
                </div>
              </Card>
            </button>
          ))}
          <p className="px-1 text-[12px] text-slate-400">Select a vendor to filter its order guide. New vendors require GM approval in the real SOP — vendor creation here is limited to management roles.</p>
        </div>

        <Card className="overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between px-6 pt-6">
            <h2 className="font-display text-[16px] font-semibold text-slate-900 dark:text-white">Order guide & par levels {selected ? `— ${(vendors.data || []).find((v: any) => v.id === selected)?.name || ''}` : '— all vendors'}</h2>
            <span className="text-[12px] text-slate-400">{vItems.length} items</span>
          </div>
          {items.loading ? <div className="p-6"><Skeleton rows={4} /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 dark:border-slate-800">
                  <th className="px-6 py-3 font-semibold">Item</th><th className="px-4 py-3 font-semibold">Spec</th><th className="px-4 py-3 font-semibold">Unit</th>
                  <th className="px-4 py-3 text-right font-semibold">Guide price</th><th className="px-4 py-3 text-right font-semibold">Par</th><th className="px-6 py-3 text-right font-semibold">On hand</th></tr></thead>
                <tbody>
                  {vItems.map((i: any) => {
                    const low = Number(i.on_hand) < Number(i.par_level);
                    return (
                      <tr key={i.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/80 dark:border-slate-800/60 dark:hover:bg-slate-800/40">
                        <td className="px-6 py-3 font-medium">{i.name} {low && <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">BELOW PAR</span>}</td>
                        <td className="px-4 py-3 text-slate-400">{i.spec || '—'}</td>
                        <td className="px-4 py-3">{i.unit || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold">{money(i.guide_price)}</td>
                        <td className="px-4 py-3 text-right">
                          <input type="number" min="0" className="w-[70px] rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-right hover:border-slate-200 focus:border-indigo-300 dark:hover:border-slate-700" defaultValue={i.par_level} onBlur={e => updateStock(i, 'par_level', Number(e.target.value))} />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <input type="number" min="0" className="w-[70px] rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-right hover:border-slate-200 focus:border-indigo-300 dark:hover:border-slate-700" defaultValue={i.on_hand} onBlur={e => updateStock(i, 'on_hand', Number(e.target.value))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {selected && canEdit && (
            <div className="border-t border-slate-100 px-6 py-5 dark:border-slate-800">
              <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-slate-400">Add item to this vendor's guide</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <input className={inputCls} placeholder="Item name" value={iForm.name} onChange={e => setIForm({ ...iForm, name: e.target.value })} />
                <input className={inputCls} placeholder="Spec / pack" value={iForm.spec} onChange={e => setIForm({ ...iForm, spec: e.target.value })} />
                <input className={inputCls} placeholder="Unit" value={iForm.unit} onChange={e => setIForm({ ...iForm, unit: e.target.value })} />
                <select className={inputCls} value={iForm.category} onChange={e => setIForm({ ...iForm, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                <input className={inputCls} type="number" min="0" step="0.01" placeholder="Guide $" value={iForm.guide_price || ''} onChange={e => setIForm({ ...iForm, guide_price: Number(e.target.value) })} />
                <input className={inputCls} type="number" min="0" placeholder="Par level" value={iForm.par_level || ''} onChange={e => setIForm({ ...iForm, par_level: Number(e.target.value) })} />
                <input className={inputCls} type="number" min="0" placeholder="On hand" value={iForm.on_hand || ''} onChange={e => setIForm({ ...iForm, on_hand: Number(e.target.value) })} />
                <Btn onClick={createItem} disabled={!iForm.name}>Add item</Btn>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal open={addVendor} onClose={() => setAddVendor(false)} title="Add vendor">
        <div className="space-y-4">
          <div><label className={labelCls}>Vendor name *</label><input className={inputCls} value={vForm.name} onChange={e => setVForm({ ...vForm, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Contact</label><input className={inputCls} value={vForm.contact_name} onChange={e => setVForm({ ...vForm, contact_name: e.target.value })} /></div>
            <div><label className={labelCls}>Phone</label><input className={inputCls} value={vForm.phone} onChange={e => setVForm({ ...vForm, phone: e.target.value })} /></div>
            <div><label className={labelCls}>Email</label><input className={inputCls} value={vForm.email} onChange={e => setVForm({ ...vForm, email: e.target.value })} /></div>
            <div><label className={labelCls}>Terms</label><input className={inputCls} value={vForm.terms} onChange={e => setVForm({ ...vForm, terms: e.target.value })} /></div>
            <div><label className={labelCls}>Delivery days</label><input className={inputCls} value={vForm.delivery_days} onChange={e => setVForm({ ...vForm, delivery_days: e.target.value })} placeholder="Mon/Wed/Fri" /></div>
            <div><label className={labelCls}>Min order (CAD)</label><input className={inputCls} type="number" min="0" value={vForm.min_order} onChange={e => setVForm({ ...vForm, min_order: Number(e.target.value) })} /></div>
          </div>
          <Btn onClick={createVendor} disabled={!vForm.name} className="w-full">Add vendor</Btn>
        </div>
      </Modal>
    </div>
  );
}
