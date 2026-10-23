import { Link } from 'react-router-dom';
import { get, STEPS } from '../lib/api';
import { useCountUp, useLoader } from '../lib/hooks';
import { ErrorBanner, PageTitle, Skeleton } from '../components/ui';

const DESCRIPTIONS = [
  'Check stock, PAR, forecast, events and open POs',
  'Emergency orders need documented authorization',
  'Item, quantity, supplier, cost and reason',
  'Apply the correct approval limit before ordering',
  'Use the approved system; record the PO number',
  'Count items; check quality, temperature, expiry and damage',
  'Record invoice number, PO number and itemized details',
  'Match PO + receiving record + invoice; resolve differences',
  'Verify details, coding and exceptions — independent of PO approval',
  'Check terms, vendor details and payment authority',
  'Record payment, reconcile and close the PO',
];

function StepCard({ step, count, desc, link }: { step: typeof STEPS[number]; count: number; desc: string; link: string }) {
  const v = useCountUp(count);
  const active = count > 0;
  return (
    <Link to={link}
      className="card-hover group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_14px_34px_-20px_rgba(15,23,42,0.25)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${step.color}, ${step.color}88)` }} />
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-display text-[17px] font-bold text-slate-700 transition-transform duration-200 group-hover:scale-110 dark:text-slate-100"
          style={{ background: step.tint }}>
          {step.n}
        </span>
        <span className={`text-right ${active ? '' : 'opacity-50'}`}>
          <span className="block font-display text-[26px] font-semibold leading-none text-slate-900 dark:text-white">{Math.round(v)}</span>
          <span className="mt-1 block text-[10.5px] font-semibold uppercase tracking-widest text-slate-400">in this step</span>
        </span>
      </div>
      <h3 className="mt-3.5 text-[15px] font-semibold leading-snug text-slate-800 dark:text-slate-100">{step.title}</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">{desc}</p>
      {active && <span className="pulse-soft absolute right-4 top-[74px] h-2 w-2 rounded-full" style={{ background: step.color }} />}
    </Link>
  );
}

function Connector({ vertical = false }: { vertical?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${vertical ? 'py-0.5' : 'px-0.5'}`} aria-hidden>
      <svg width={vertical ? 18 : 30} height={vertical ? 30 : 18} viewBox={vertical ? '0 0 18 30' : '0 0 30 18'} className="text-slate-300 dark:text-slate-600">
        {vertical
          ? <><line x1="9" y1="2" x2="9" y2="22" stroke="currentColor" strokeWidth="2" className="flow-dash" /><path d="M4 21 L9 28 L14 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>
          : <><line x1="2" y1="9" x2="22" y2="9" stroke="currentColor" strokeWidth="2" className="flow-dash" /><path d="M21 4 L28 9 L21 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
      </svg>
    </div>
  );
}

export default function ProcessMap() {
  const { data, error, loading } = useLoader(() => get('/api/process-map'));
  return (
    <div>
      <PageTitle title="Process Map" sub="His 11-step kitchen purchasing cycle — from need to payment. Controlled · approved · tracked. Counts update live from the system." />
      <ErrorBanner message={error} />
      {loading || !data ? <Skeleton rows={6} /> : (
        <>
          <div className="stagger hidden items-stretch gap-0 md:grid" style={{ gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr' }}>
            {data.steps.slice(0, 4).map((s: any, i: number) => (
              <div key={s.n} className="contents">
                <StepCard step={STEPS[i]} count={s.count} desc={DESCRIPTIONS[i]} link={s.link} />
                {i < 3 && <Connector />}
              </div>
            ))}
          </div>
          <div className="my-1 hidden justify-end pr-[12%] md:flex"><Connector vertical /></div>
          <div className="stagger hidden items-stretch gap-0 md:grid" style={{ gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr' }}>
            {data.steps.slice(4, 8).map((s: any, i: number) => (
              <div key={s.n} className="contents">
                <StepCard step={STEPS[i + 4]} count={s.count} desc={DESCRIPTIONS[i + 4]} link={s.link} />
                {i < 3 && <Connector />}
              </div>
            ))}
          </div>
          <div className="my-1 hidden justify-end pr-[12%] md:flex"><Connector vertical /></div>
          <div className="stagger hidden items-stretch gap-0 md:grid" style={{ gridTemplateColumns: '1fr auto 1fr auto 1fr' }}>
            {data.steps.slice(8, 11).map((s: any, i: number) => (
              <div key={s.n} className="contents">
                <StepCard step={STEPS[i + 8]} count={s.count} desc={DESCRIPTIONS[i + 8]} link={s.link} />
                {i < 2 && <Connector />}
              </div>
            ))}
            <div className="flex items-center px-2">
              <p className="max-w-[220px] text-[12.5px] leading-relaxed text-slate-400">
                Emergency orders: obtain authorization before ordering where practicable; document by the next business day. <span className="font-semibold text-slate-500 dark:text-slate-300">Do not split POs to bypass approval limits.</span>
              </p>
            </div>
          </div>

          {/* mobile: simple vertical flow */}
          <div className="stagger space-y-3 md:hidden">
            {data.steps.map((s: any, i: number) => (
              <StepCard key={s.n} step={STEPS[i]} count={s.count} desc={DESCRIPTIONS[i]} link={s.link} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
