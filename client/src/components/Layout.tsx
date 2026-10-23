import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { get, setToken, type User } from '../lib/api';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◧' },
  { to: '/process-map', label: 'Process Map', icon: '◎' },
  { to: '/requests', label: 'Purchase Requests', icon: '✎' },
  { to: '/pos', label: 'Purchase Orders', icon: '▤' },
  { to: '/approvals', label: 'Approvals', icon: '✓' },
  { to: '/receiving', label: 'Receiving', icon: '⇩' },
  { to: '/invoices', label: 'Invoices & Matching', icon: '≣' },
  { to: '/exceptions', label: 'Exceptions', icon: '⚠' },
  { to: '/payments', label: 'Payments', icon: '$' },
  { to: '/vendors', label: 'Vendors & Items', icon: '⚑' },
  { to: '/reports', label: 'Weekly Reports', icon: '▦' },
  { to: '/audit', label: 'Audit Log', icon: '≡' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  useEffect(() => { if (open) { setQ(''); setResults(null); setTimeout(() => inputRef.current?.focus(), 30); } }, [open ]);
  useEffect(() => {
    if (!open || q.trim().length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      try { setResults(await get(`/api/search?q=${encodeURIComponent(q)}`)); } catch { setResults(null); }
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);
  if (!open) return null;
  const go = (to: string) => { onClose(); navigate(to); };
  return (
    <div className="fade-in fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/40 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="modal-pop w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search PO numbers, vendors, invoices, exceptions…"
          className="w-full border-b border-slate-100 bg-transparent px-5 py-4 text-[15px] dark:border-slate-800" />
        <div className="max-h-[46vh] overflow-y-auto p-2">
          {NAV.filter(n => n.label.toLowerCase().includes(q.toLowerCase())).map(n => (
            <button key={n.to} onClick={() => go(n.to)} className="btn flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="w-5 text-center text-slate-400">{n.icon}</span>{n.label}<span className="ml-auto text-xs text-slate-400">page</span>
            </button>
          ))}
          {results?.pos?.map((p: any) => (
            <button key={'po' + p.id} onClick={() => go(`/pos/${p.id}`)} className="btn flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="w-5 text-center text-slate-400">▤</span><span className="font-semibold">{p.po_number}</span>
              <span className="text-slate-500">{p.vendor_name}</span><span className="ml-auto text-xs text-slate-400">{p.status}</span>
            </button>
          ))}
          {results?.vendors?.map((v: any) => (
            <button key={'v' + v.id} onClick={() => go('/vendors')} className="btn flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="w-5 text-center text-slate-400">⚑</span>{v.name}<span className="ml-auto text-xs text-slate-400">vendor</span>
            </button>
          ))}
          {results?.invoices?.map((i: any) => (
            <button key={'i' + i.id} onClick={() => go(`/invoices/${i.id}`)} className="btn flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="w-5 text-center text-slate-400">≣</span><span className="font-semibold">{i.invoice_number}</span><span className="ml-auto text-xs text-slate-400">invoice</span>
            </button>
          ))}
          {results?.exceptions?.map((e: any) => (
            <button key={'e' + e.id} onClick={() => go('/exceptions')} className="btn flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <span className="w-5 text-center text-slate-400">⚠</span><span className="font-semibold">{e.ref}</span><span className="text-slate-500">{e.type}</span>
            </button>
          ))}
          {q.length >= 2 && !results && <div className="px-3 py-4 text-sm text-slate-400">Searching…</div>}
        </div>
        <div className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400 dark:border-slate-800">ESC to close · results respect your permissions</div>
      </div>
    </div>
  );
}

export default function Layout({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [dark, setDark] = useState(() => localStorage.getItem('ette-theme') === 'dark');
  const [palette, setPalette] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const location = useLocation();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('ette-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); }
      if (e.key === 'Escape') setPalette(false);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  useEffect(() => { setMobileNav(false); }, [location.pathname]);

  return (
    <div className="min-h-screen lg:flex">
      {/* sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-[248px] transform border-r border-slate-200/70 bg-white/80 backdrop-blur-xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-950/80 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col px-4 py-5">
          <Link to="/" className="flex items-center gap-3 px-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-teal-400 font-display text-lg font-bold text-white shadow-lg shadow-indigo-500/25">e</span>
            <span>
              <span className="block font-display text-[17px] font-semibold leading-tight text-slate-900 dark:text-white">ette PO Hub</span>
              <span className="block text-[11px] font-medium uppercase tracking-widest text-slate-400">Kitchen purchasing</span>
            </span>
          </Link>
          <nav className="mt-7 flex-1 space-y-0.5 overflow-y-auto pr-1">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-all duration-150 ${isActive
                  ? 'bg-indigo-50 text-indigo-700 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.15)] dark:bg-indigo-950/70 dark:text-indigo-200'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'}`}>
                <span className="w-5 text-center text-[15px] opacity-80 transition-transform duration-150 group-hover:scale-110">{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[13px] font-bold text-slate-600 dark:from-slate-700 dark:to-slate-800 dark:text-slate-200">
                {user.name.split(' ').map(s => s[0]).join('')}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{user.name}</div>
                <div className="truncate text-[11px] text-slate-400">{user.roleLabel}</div>
              </div>
            </div>
            <button onClick={() => { setToken(null); onLogout(); }} className="btn mt-3 w-full rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white">
              Sign out
            </button>
          </div>
        </div>
      </aside>
      {mobileNav && <div className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setMobileNav(false)} />}

      {/* main column */}
      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-20 border-b border-slate-200/60 bg-[#f6f7f9]/75 backdrop-blur-xl dark:border-slate-800/70 dark:bg-[#0c0f14]/75">
          <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-5 sm:px-8">
            <button className="btn rounded-xl p-2 text-slate-500 hover:bg-white dark:hover:bg-slate-900 lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open menu">☰</button>
            <button onClick={() => setPalette(true)}
              className="btn hidden h-10 flex-1 items-center gap-3 rounded-xl border border-slate-200/80 bg-white/70 px-4 text-left text-sm text-slate-400 shadow-sm hover:bg-white sm:flex dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-900">
              <span>⌕</span><span className="flex-1">Search POs, vendors, invoices…</span>
              <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800">⌘K</kbd>
            </button>
            <div className="flex-1 sm:hidden" />
            <button onClick={() => setDark(d => !d)} className="btn flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-[15px] shadow-sm hover:bg-white dark:border-slate-800 dark:bg-slate-900/70" aria-label="Toggle dark mode">
              {dark ? '☀' : '☾'}
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1200px] px-5 py-7 sm:px-8 sm:py-9">
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </main>
        <footer className="mx-auto max-w-[1200px] px-8 pb-10 text-[12px] text-slate-400">
          Process design © ette hotel kitchen PO SOP — implemented as ETTE PO Hub. Demo environment: no real orders or payments are made.
        </footer>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
