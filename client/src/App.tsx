import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { get, getToken, type User } from './lib/api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProcessMap from './pages/ProcessMap';
import Requests from './pages/Requests';
import NewRequest from './pages/NewRequest';
import PurchaseOrders from './pages/PurchaseOrders';
import PODetail from './pages/PODetail';
import Approvals from './pages/Approvals';
import Receiving from './pages/Receiving';
import { InvoiceList } from './pages/Invoices';
import NewInvoice from './pages/NewInvoice';
import InvoiceDetail from './pages/InvoiceDetail';
import Exceptions from './pages/Exceptions';
import Payments from './pages/Payments';
import Vendors from './pages/Vendors';
import Reports from './pages/Reports';
import Audit from './pages/Audit';
import Settings from './pages/Settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (!getToken()) { setBooting(false); return; }
    get('/api/auth/me')
      .then(r => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-teal-400 font-display text-2xl font-bold text-white">e</span>
          <div className="skeleton mx-auto mt-5 h-3 w-40 rounded-full" />
        </div>
      </div>
    );
  }
  if (!user) return <Login onLogin={setUser} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout user={user} onLogout={() => setUser(null)} />}>
          <Route index element={<Dashboard user={user} />} />
          <Route path="process-map" element={<ProcessMap />} />
          <Route path="requests" element={<Requests />} />
          <Route path="requests/new" element={<NewRequest />} />
          <Route path="pos" element={<PurchaseOrders />} />
          <Route path="pos/:id" element={<PODetail user={user} />} />
          <Route path="approvals" element={<Approvals user={user} />} />
          <Route path="receiving" element={<Receiving />} />
          <Route path="invoices" element={<InvoiceList />} />
          <Route path="invoices/new" element={<NewInvoice />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="exceptions" element={<Exceptions />} />
          <Route path="payments" element={<Payments />} />
          <Route path="vendors" element={<Vendors user={user} />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit" element={<Audit />} />
          <Route path="settings" element={<Settings user={user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
