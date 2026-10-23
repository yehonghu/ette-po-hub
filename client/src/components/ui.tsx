import type { ReactNode } from 'react';
import { STATUS_LABEL, STATUS_STYLE } from '../lib/api';
import { useCountUp } from '../lib/hooks';

export function Card({ children, className = '', hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_10px_30px_-18px_rgba(15,23,42,0.15)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 ${hover ? 'card-hover' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function Pill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function StatCard({ label, value, sub, accent = '#7fb2e5', moneyFormat = false }: { label: string; value: number; sub?: string; accent?: string; moneyFormat?: boolean }) {
  const v = useCountUp(value);
  const shown = moneyFormat
    ? 'CAD $' + v.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(v).toLocaleString();
  return (
    <Card className="p-5" hover>
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        {label}
      </div>
      <div className="mt-2 font-display text-[32px] font-semibold leading-none text-slate-900 dark:text-white">{shown}</div>
      {sub && <div className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">{sub}</div>}
    </Card>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-14 rounded-2xl" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return <div className="fade-in rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">{message}</div>;
}
export function SuccessBanner({ message }: { message: string }) {
  if (!message) return null;
  return <div className="fade-in rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">{message}</div>;
}

export function Btn({ children, onClick, variant = 'primary', className = '', disabled, type }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'soft'; className?: string; disabled?: boolean; type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-indigo-600 text-white shadow-[0_6px_16px_-6px_rgba(79,70,229,0.6)] hover:bg-indigo-500',
    soft: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900',
    ghost: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
    danger: 'bg-red-600 text-white hover:bg-red-500',
  } as const;
  return (
    <button type={type || 'button'} disabled={disabled} onClick={onClick}
      className={`btn inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
export const labelCls = 'mb-1 block text-[12px] font-semibold uppercase tracking-wider text-slate-400';

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div className={`modal-pop max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="btn rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[26px] font-semibold leading-tight text-slate-900 dark:text-white">{title}</h1>
        {sub && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
