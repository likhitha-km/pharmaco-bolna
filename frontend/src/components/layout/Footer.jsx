import { Link } from 'react-router-dom';
import { Shield, Heart, ExternalLink } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #111827 100%)',
        color: '#E5E7EB',
        padding: '20px 0 16px',
        marginTop: 'auto',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
      className="no-print"
      aria-label="Site footer"
    >
      <div className="container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Top row: Brand & Emergency */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(22, 156, 154, 0.16)', padding: 8, borderRadius: 999 }}>
                  <Shield size={22} color="#169C9A" aria-hidden="true" />
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#fff' }}>Pharmaco</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 14px' }}>
              <span style={{ fontSize: 14, color: '#9CA3AF' }}>Emergency: <a href="tel:112" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#F87171', textDecoration: 'none' }}>112</a></span>
              <span style={{ color: 'rgba(255,255,255,0.12)' }}>|</span>
              <span style={{ fontSize: 14, color: '#9CA3AF' }}>PvPI Helpline: <span style={{ fontWeight: 600, color: '#169C9A' }}>1800-180-3024</span></span>
            </div>
          </div>

          {/* Middle row: Links */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Platform:</span>
            {[
              { to: '/report', label: 'Report a Side Effect' },
              { to: '/search', label: 'Drug Search' },
              { to: '/dashboard', label: 'Dashboard' },
              { to: '/safety', label: 'Safety Hub' },
              { to: '/my-reports', label: 'My Reports' },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                style={{ fontSize: 14, color: '#9CA3AF', transition: 'color 0.2s ease', textDecoration: 'none' }}
                onMouseEnter={(e) => (e.target.style.color = '#169C9A')}
                onMouseLeave={(e) => (e.target.style.color = '#9CA3AF')}
              >
                {label}
              </Link>
            ))}
            
            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.12)', margin: '0 8px' }} />
            
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Resources:</span>
            {[
              { href: 'https://pvpi.nic.in', label: 'PvPI' },
              { href: 'https://cdsco.gov.in', label: 'CDSCO' },
              { href: 'https://who.int/medicines/areas/quality_safety/safety_efficacy/pharmvigi/en/', label: 'WHO' },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#9CA3AF', textDecoration: 'none' }}
              >
                {label} <ExternalLink size={14} aria-hidden="true" />
              </a>
            ))}
          </div>

          {/* Bottom row: Copyright */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
              &copy; {currentYear} Pharmaco. Built for India's Pharmacovigilance Programme (PvPI).
            </p>
            <p style={{ fontSize: 13, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
              Made with <Heart size={14} color="#EF4444" aria-label="love" /> for safer medicines in India
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
