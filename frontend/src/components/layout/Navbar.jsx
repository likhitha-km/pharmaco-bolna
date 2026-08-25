import { Link, useLocation } from 'react-router-dom';
import { Shield, Globe, UserCircle2, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useLanguageContext } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../auth/AuthProvider.jsx';

const PUBLIC_NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/search', label: 'Drug Search' },
  { to: '/safety', label: 'Safety Hub' },
];

const PRIVATE_NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/report', label: 'Report ADR' },
  { to: '/my-reports', label: 'My Reports' },
  { to: '/search', label: 'Drug Search' },
  { to: '/safety', label: 'Safety Hub' },
];

export function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { language, setLanguage, LANGUAGES } = useLanguageContext();
  const { user, logout } = useAuth();
  const navLinks = user ? PRIVATE_NAV_LINKS : PUBLIC_NAV_LINKS;

  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 72, zIndex: 200,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)',
      }}
      aria-label="Main navigation"
    >
      <div className="container" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }} aria-label="Pharmaco Home">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} color="#fff" aria-hidden="true" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--color-primary)' }}>
            Pharmaco
          </span>
        </Link>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="no-print">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              style={{
                padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: 14,
                fontFamily: 'var(--font-body)', fontWeight: 500,
                color: location.pathname === link.to ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                background: location.pathname === link.to ? 'var(--color-primary-light)' : 'transparent',
                transition: 'all 0.2s',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => { if (location.pathname !== link.to) e.target.style.background = 'var(--color-surface-secondary)'; }}
              onMouseLeave={(e) => { if (location.pathname !== link.to) e.target.style.background = 'transparent'; }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="no-print">
          {/* Language selector */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', cursor: 'pointer' }}>
            <Globe size={16} color="var(--color-text-muted)" aria-hidden="true" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--color-text-secondary)', cursor: 'pointer', outline: 'none' }}
              aria-label="Select language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.native}</option>
              ))}
            </select>
          </div>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link to="/dashboard" aria-label="Open your dashboard">
                <button className="btn btn-outline" style={{ padding: '8px 10px' }}>
                  <UserCircle2 size={18} />
                </button>
              </Link>
              <button className="btn btn-ghost" style={{ padding: '8px 10px' }} onClick={() => logout()} aria-label="Log out">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <>
              <Link to="/login">
                <button className="btn btn-outline" aria-label="Log in to Pharmaco">
                  Log in
                </button>
              </Link>
              <Link to="/signup">
                <button className="btn btn-primary" aria-label="Create a Pharmaco account">
                  Sign up
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
