import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Search, Shield, Settings, LogOut } from 'lucide-react';

const SIDEBAR_LINKS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/my-reports', icon: FileText, label: 'My Reports' },
  { to: '/search', icon: Search, label: 'Drug Search' },
  { to: '/safety', icon: Shield, label: 'Safety Hub' },
  { to: '/regulator', icon: Settings, label: 'Regulator View' },
];

export function Sidebar() {
  return (
    <aside style={{
      width: 220, flexShrink: 0, background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)', padding: '24px 12px',
      display: 'flex', flexDirection: 'column', gap: 4, minHeight: '100vh',
      position: 'sticky', top: 72, alignSelf: 'flex-start',
    }}
      aria-label="Sidebar navigation"
    >
      {SIDEBAR_LINKS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to} to={to}
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            borderRadius: 'var(--radius-md)', fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 500,
            color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            background: isActive ? 'var(--color-primary-light)' : 'transparent',
            textDecoration: 'none', transition: 'all 0.2s',
          })}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </aside>
  );
}
