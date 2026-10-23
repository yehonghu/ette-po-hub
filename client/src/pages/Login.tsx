import { useState, type FormEvent } from 'react';
import { post, setToken, type User } from '../lib/api';
import { Btn, ErrorBanner, inputCls, labelCls } from '../components/ui';

const DEMO = [
  { email: 'requester@ette.local', label: 'Requester', name: 'Sam Carter' },
  { email: 'manager@ette.local', label: 'Kitchen Manager', name: 'Maria Lopez' },
  { email: 'chef@ette.local', label: 'Executive Chef', name: 'Daniel Kim' },
  { email: 'gm@ette.local', label: 'GM', name: 'Grace Thompson' },
  { email: 'receiver@ette.local', label: 'Receiver', name: 'Alex Roy' },
  { email: 'finance@ette.local', label: 'Finance / AP', name: 'Priya Patel' },
  { email: 'payer@ette.local', label: 'Payment Approver', name: 'Olivia Chen' },
  { email: 'admin@ette.local', label: 'Admin', name: 'Adam Wright' },
];

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState('manager@ette.local');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e?: FormEvent, overrideEmail?: string) {
    e?.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await post<{ token: string; user: User }>('/api/auth/login', { email: overrideEmail || email, password });
      setToken(r.token);
      onLogin(r.user);
    } catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(1100px_500px_at_20%_-10%,#e0e7ff_0%,transparent_60%),radial-gradient(900px_480px_at_90%_110%,#ccfbf1_0%,transparent_55%)] px-4 py-10 dark:bg-[radial-gradient(1100px_500px_at_20%_-10%,#1e1b4b_0%,transparent_60%),radial-gradient(900px_480px_at_90%_110%,#042f2e_0%,transparent_55%)] dark:bg-[#0c0f14]">
      <div className="page-enter w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 via-sky-500 to-teal-400 font-display text-3xl font-bold text-white shadow-xl shadow-indigo-500/25">e</span>
          <h1 className="mt-4 font-display text-3xl font-semibold text-slate-900 dark:text-white">ette PO Hub</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The kitchen purchasing cycle — from need to payment,<br />controlled, approved, and tracked.</p>
        </div>
        <div className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.3)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/85 sm:p-7">
          <form onSubmit={submit} className="space-y-4">
            <ErrorBanner message={error} />
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} value={email} onChange={e => setEmail(e.target.value)} type="email" required autoComplete="username" />
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <input className={inputCls} value={password} onChange={e => setPassword(e.target.value)} type="password" required autoComplete="current-password" />
            </div>
            <Btn type="submit" disabled={busy} className="w-full py-2.5">{busy ? 'Signing in…' : 'Sign in'}</Btn>
          </form>
          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Demo accounts — one click, password demo1234</div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map(d => (
                <button key={d.email} disabled={busy} onClick={() => { setEmail(d.email); submit(undefined, d.email); }}
                  className="btn rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-left hover:border-indigo-200 hover:bg-indigo-50/60 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/60">
                  <span className="block text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{d.label}</span>
                  <span className="block text-[11px] text-slate-400">{d.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-5 text-center text-[12px] text-slate-400">Implements the ette hotel Kitchen Purchasing PO SOP (11-step cycle, CAD approval matrix, three-way match).</p>
      </div>
    </div>
  );
}
