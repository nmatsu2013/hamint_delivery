import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './lib/apiClient';
import { useAuthStore } from './store/authStore';
import type { Actor } from './types/api';
import { AppLayout } from './components/layouts/AppLayout';
import { ProtectedRoute } from './components/layouts/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { OrdersListPage } from './pages/OrdersListPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { CreateSalesOrderPage } from './pages/CreateSalesOrderPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { ImportsPage } from './pages/ImportsPage';
import { WarehousePage } from './pages/WarehousePage';
import { ShipmentsPage } from './pages/ShipmentsPage';
import { BillingPage } from './pages/BillingPage';
import { TraceabilityPage } from './pages/TraceabilityPage';
import { MasterPage } from './pages/MasterPage';

export default function App() {
  const token = useAuthStore((state) => state.token);
  const actor = useAuthStore((state) => state.actor);
  const setActor = useAuthStore((state) => state.setActor);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!token || actor) {
      return;
    }
    api
      .get<Actor>('/me')
      .then((me) => setActor(me))
      .catch(() => logout());
  }, [token, actor, setActor, logout]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/orders" replace />} />
        <Route path="/orders" element={<OrdersListPage />} />
        <Route path="/orders/new" element={<CreateSalesOrderPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/imports" element={<ImportsPage />} />
        <Route path="/warehouse" element={<WarehousePage />} />
        <Route path="/shipments" element={<ShipmentsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/traceability" element={<TraceabilityPage />} />
        <Route path="/master" element={<MasterPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  );
}
