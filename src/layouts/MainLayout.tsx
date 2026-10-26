import {
  Bell,
  Building2,
  FileStack,
  LayoutDashboard,
  LogOut,
  Monitor,
  Printer,
  Receipt,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import NotificationBell from "../components/NotificationBell";
import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  { to: "/", label: "Panel", icon: LayoutDashboard },
  { to: "/solpeds", label: "SOLPEDs", icon: ShoppingCart },
  { to: "/contratos", label: "Contratos", icon: FileStack },
  { to: "/pagos-mensuales", label: "Pagos mensuales", icon: Wallet },
  { to: "/licencias", label: "Licencias", icon: ShieldCheck },
  { to: "/leasing/computadoras", label: "Leasing · Computadoras", icon: Monitor },
  { to: "/leasing/impresoras", label: "Leasing · Impresoras", icon: Printer },
  { to: "/presupuesto", label: "Presupuesto", icon: Receipt },
  { to: "/alertas", label: "Alertas", icon: Bell },
];

const ADMIN_ITEMS = [
  { to: "/admin/usuarios", label: "Usuarios", icon: Users },
  { to: "/admin/roles", label: "Roles y permisos", icon: Shield },
  { to: "/admin/auditoria", label: "Auditoría", icon: FileStack },
];

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "sidebar-link active" : "sidebar-link";
}

function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function MainLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2 className="sidebar-title">
          <Building2 size={19} />
          Control de Gestión
        </h2>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navClass}>
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
          <div className="sidebar-section-label">Administración</div>
          {ADMIN_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <div className="topbar">
          <NotificationBell />
          <div className="topbar-user">
            <span className="topbar-avatar">{initials(user?.full_name)}</span>
            <span>{user?.full_name}</span>
          </div>
          <button className="btn btn-secondary" onClick={logout}>
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
