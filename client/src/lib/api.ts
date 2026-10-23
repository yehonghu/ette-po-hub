export type User = { id: number; name: string; email: string; role: string; roleLabel: string };

const TOKEN_KEY = 'ette-token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any).error || `Request failed (${r.status})`);
  return data as T;
}
export const get = <T = any>(p: string) => api<T>('GET', p);
export const post = <T = any>(p: string, b?: unknown) => api<T>('POST', p, b ?? {});
export const patch = <T = any>(p: string, b?: unknown) => api<T>('PATCH', p, b ?? {});

export const money = (n: number | null | undefined) =>
  'CAD $' + (Number(n) || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtDate = (s?: string | null) => (s ? String(s).slice(0, 10) : '—');
export const fmtDateTime = (s?: string | null) => (s ? String(s).replace('T', ' ').slice(0, 16) : '—');

/** The 11 SOP steps, with the pastel accents from his original flowchart. */
export const STEPS = [
  { n: 1, title: 'Identify the need', color: '#7fb2e5', tint: '#e8f1fc' },
  { n: 2, title: 'Routine or emergency?', color: '#6fc7bd', tint: '#e6f5f3' },
  { n: 3, title: 'Prepare purchase request', color: '#93cf8e', tint: '#edf7ec' },
  { n: 4, title: 'Get approval', color: '#c3d97a', tint: '#f5f9e8' },
  { n: 5, title: 'Create PO & send order', color: '#ecd27a', tint: '#fbf6e0' },
  { n: 6, title: 'Receive & inspect', color: '#f2b183', tint: '#fdf0e4' },
  { n: 7, title: 'Capture supplier invoice', color: '#f09a9a', tint: '#fdecec' },
  { n: 8, title: 'Three-way match', color: '#cfa8e0', tint: '#f6eefb' },
  { n: 9, title: 'Independent invoice approval', color: '#a8a4e8', tint: '#eef0fe' },
  { n: 10, title: 'Finance payment approval', color: '#93b8e8', tint: '#e9f1fc' },
  { n: 11, title: 'Pay & close PO', color: '#7fb2e5', tint: '#e8f1fc' },
];

/** Which step (1-11) a PO status currently sits at. */
export const STATUS_STEP: Record<string, number> = {
  draft: 3, pending_approval: 4, approved: 5, sent: 6, partially_received: 6, received: 7,
  invoice_captured: 7, exception: 8, matched: 9, invoice_approved: 10, payment_approved: 11, paid: 11, closed: 11,
};
export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending_approval: 'Pending approval', approved: 'Approved', sent: 'Sent to vendor',
  partially_received: 'Partially received', received: 'Received', invoice_captured: 'Invoice captured',
  exception: 'Exception', matched: 'Matched', invoice_approved: 'Invoice approved',
  payment_approved: 'Payment approved', paid: 'Paid', closed: 'Closed',
  captured: 'Captured', open: 'Open', in_review: 'In review', resolved: 'Resolved', submitted: 'Submitted',
};
export const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  pending_approval: 'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-300',
  approved: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  sent: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  partially_received: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  received: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  invoice_captured: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  captured: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  exception: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  matched: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  invoice_approved: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  payment_approved: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  closed: 'bg-emerald-600 text-white dark:bg-emerald-500',
  open: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  in_review: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  submitted: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
};
export const EXCEPTION_TYPES = [
  'short_delivery', 'damaged_or_rejected', 'substitute', 'price_variance', 'quantity_mismatch', 'no_po', 'duplicate_invoice', 'emergency', 'other',
];
export const CATEGORIES = ['Food ingredients', 'Cleaning and sanitation', 'Disposable supplies', 'Small kitchen operating supplies'];
export const ROLE_LABELS: Record<string, string> = {
  requester: 'Kitchen Requester', kitchen_manager: 'Kitchen Manager', executive_chef: 'Executive Chef',
  gm: 'General Manager', receiver: 'Receiver', finance: 'Finance / AP', payment_approver: 'Payment Approver', admin: 'Admin',
};
