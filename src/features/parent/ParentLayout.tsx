import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, ClipboardList, LogOut, Shield } from 'lucide-react';
import { Brand } from '../../components/Brand';
import { useReadySession } from '../../hooks/useSession';
import { signOut } from '../../services/auth';

export function ParentLayout() {
  const session = useReadySession();
  return (
    <>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <Brand />
          <nav className="nav nav--parent" aria-label="Principal">
            <NavLink to="/" end className="nav__link">
              <CalendarDays size={18} aria-hidden="true" /> Menú
            </NavLink>
            <NavLink to="/pedidos" className="nav__link">
              <ClipboardList size={18} aria-hidden="true" /> Mis pedidos
            </NavLink>
            {session.isAdmin && (
              <NavLink to="/admin" className="nav__link">
                <Shield size={18} aria-hidden="true" /> Administración
              </NavLink>
            )}
            <button type="button" className="nav__link btn--ghost" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => signOut()}>
              <LogOut size={18} aria-hidden="true" /> Salir
            </button>
          </nav>
        </div>
      </header>
      <main id="main" className="page has-tabbar">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Principal">
        <NavLink to="/" end className="tabbar__link">
          <CalendarDays size={24} aria-hidden="true" />
          Menú
        </NavLink>
        <NavLink to="/pedidos" className="tabbar__link">
          <ClipboardList size={24} aria-hidden="true" />
          Mis pedidos
        </NavLink>
        {session.isAdmin ? (
          <NavLink to="/admin" className="tabbar__link">
            <Shield size={24} aria-hidden="true" />
            Admin
          </NavLink>
        ) : (
          <button type="button" className="tabbar__link" onClick={() => signOut()}>
            <LogOut size={24} aria-hidden="true" />
            Salir
          </button>
        )}
      </nav>
    </>
  );
}
