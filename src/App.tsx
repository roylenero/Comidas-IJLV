import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { SessionProvider } from './features/auth/SessionProvider';
import { SessionGate } from './features/auth/SessionGate';
import { ParentLayout } from './features/parent/ParentLayout';
import { HomePage } from './features/parent/HomePage';
import { MyOrdersPage } from './features/parent/MyOrdersPage';
import { useReadySession } from './hooks/useSession';
import { LoadingState, StateMessage } from './components/StateMessage';
import { OfflineBanner } from './components/OfflineBanner';
import { UpdatePrompt } from './components/UpdatePrompt';

// Administración se carga aparte para que la app de padres sea ligera.
const AdminLayout = lazy(() => import('./features/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const DashboardPage = lazy(() => import('./features/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ServiceDetailPage = lazy(() =>
  import('./features/admin/ServiceDetailPage').then((m) => ({ default: m.ServiceDetailPage })),
);
const ManualOrderPage = lazy(() => import('./features/admin/ManualOrderPage').then((m) => ({ default: m.ManualOrderPage })));
const MenuEditorPage = lazy(() => import('./features/admin/MenuEditorPage').then((m) => ({ default: m.MenuEditorPage })));
const FamiliesPage = lazy(() => import('./features/admin/FamiliesPage').then((m) => ({ default: m.FamiliesPage })));
const PaymentsPage = lazy(() => import('./features/admin/PaymentsPage').then((m) => ({ default: m.PaymentsPage })));
const SettingsPage = lazy(() => import('./features/admin/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function RequireAdmin({ children }: { children: ReactNode }) {
  const session = useReadySession();
  return session.isAdmin ? children : <Navigate to="/" replace />;
}

function RequireFamily({ children }: { children: ReactNode }) {
  const session = useReadySession();
  return session.familyId ? children : <Navigate to="/admin" replace />;
}

const withSuspense = (node: ReactNode) => <Suspense fallback={<LoadingState />}>{node}</Suspense>;

const router = createBrowserRouter([
  {
    element: <SessionGate />,
    children: [
      {
        element: (
          <RequireFamily>
            <ParentLayout />
          </RequireFamily>
        ),
        children: [
          { index: true, element: <HomePage /> },
          { path: 'pedidos', element: <MyOrdersPage /> },
        ],
      },
      {
        path: 'admin',
        element: <RequireAdmin>{withSuspense(<AdminLayout />)}</RequireAdmin>,
        children: [
          { index: true, element: withSuspense(<DashboardPage />) },
          { path: 'dia/:date/:service', element: withSuspense(<ServiceDetailPage />) },
          { path: 'pedido-manual', element: withSuspense(<ManualOrderPage />) },
          { path: 'menu', element: withSuspense(<MenuEditorPage />) },
          { path: 'familias', element: withSuspense(<FamiliesPage />) },
          { path: 'pagos', element: withSuspense(<PaymentsPage />) },
          { path: 'ajustes', element: withSuspense(<SettingsPage />) },
        ],
      },
      {
        path: '*',
        element: (
          <main className="page">
            <StateMessage title="Página no encontrada" action={<a className="btn btn--primary" href="/">Ir al inicio</a>} />
          </main>
        ),
      },
    ],
  },
]);

export function App() {
  return (
    <SessionProvider>
      <OfflineBanner />
      <RouterProvider router={router} />
      <UpdatePrompt />
    </SessionProvider>
  );
}
