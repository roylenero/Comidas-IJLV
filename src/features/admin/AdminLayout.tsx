import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, CreditCard, LayoutDashboard, LogOut, PlusCircle, Settings, Users, Home } from 'lucide-react';
import { Brand } from '../../components/Brand';
import { useReadySession } from '../../hooks/useSession';
import { signOut } from '../../services/auth';

const LINKS = [
  { to: '/admin', label: 'Hoy', icon: LayoutDashboard, end: true },
  { to: '/admin/pedido-manual', label: 'Pedido manual', icon: PlusCircle },
  { to: '/admin/menu', label: 'Menú', icon: CalendarDays },
  { to: '/admin/familias', label: 'Familias', icon: Users },
  { to: '/admin/pagos', label: 'Pagos', icon: CreditCard },
  { to: '/admin/ajustes', label: 'Precios', icon: Settings },
];

export function AdminLayout() {
  const session = useReadySession();
  return (
    <>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <header className="app-header app-header--admin">
        <div className="app-header__inner">
          <Brand to="/admin" />
          <span className="visually-hidden">Administración</span>
          <nav className="nav" aria-label="Administración">
            {LINKS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="nav__link">
                <Icon size={18} aria-hidden="true" /> {label}
              </NavLink>
            ))}
            {session.familyId && (
              <NavLink to="/" end className="nav__link">
                <Home size={18} aria-hidden="true" /> Vista familia
              </NavLink>
            )}
            <button
              type="button"
              className="nav__link"
              style={{ border: 0, background: 'none', cursor: 'pointer' }}
              onClick={() => signOut()}
            >
              <LogOut size={18} aria-hidden="true" /> Salir
            </button>
          </nav>
        </div>
      </header>
      <main id="main" className="page page--admin">
        <Outlet />
      </main>
    </>
  );
}
