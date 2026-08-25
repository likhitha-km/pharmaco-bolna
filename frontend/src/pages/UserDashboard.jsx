import { Link } from 'react-router-dom';
import { Activity, FileText, Search, ShieldCheck, UserCircle2 } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';

const QUICK_ACTIONS = [
  { to: '/report', label: 'Report a side effect', icon: FileText, description: 'Start a secure ADR report in your language.' },
  { to: '/my-reports', label: 'View my reports', icon: Activity, description: 'Track the reports you have submitted.' },
  { to: '/search', label: 'Search medicines', icon: Search, description: 'Explore safety information for medicines.' },
];

export default function UserDashboard() {
  const { user, userProfile } = useAuth();
  const displayName = userProfile?.full_name || userProfile?.username || user?.displayName || 'there';
  const profile = userProfile || {};
  const missingDetails = [
    !profile.full_name && 'full name',
    !profile.contact_number && 'contact number',
    !profile.date_of_birth && 'date of birth',
    !profile.gender && 'gender',
    !profile.country && 'country',
    !profile.state && 'state',
  ].filter(Boolean);

  return (
    <main className="page-content" id="main-content">
      <section style={{ padding: '96px 0 56px', background: 'var(--color-surface)' }}>
        <div className="container">
          <div className="card" style={{ padding: 32, display: 'grid', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>User dashboard</p>
                <h1 className="text-h2" style={{ marginTop: 6, marginBottom: 8 }}>Welcome back, {displayName}</h1>
                <p className="text-body-lg" style={{ margin: 0, maxWidth: 640 }}>
                  Your secure workspace for reporting adverse reactions, tracking progress, and exploring medicine safety information.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: '999px', background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                <ShieldCheck size={18} />
                <span style={{ fontWeight: 600 }}>Verified account</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div className="card" style={{ padding: 20, background: 'var(--color-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <UserCircle2 size={18} color="var(--color-primary)" />
                  <strong>Account</strong>
                </div>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                  {profile.role === 'healthcare_professional' ? 'Healthcare professional' : 'Patient or caregiver'}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 600 }}>
                  Pharmaco ID: {profile.pharmaco_id || 'Pending'}
                </p>
              </div>
              <div className="card" style={{ padding: 20, background: 'var(--color-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <FileText size={18} color="var(--color-primary)" />
                  <strong>Secure reporting</strong>
                </div>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                  Private reporting tools are available only to signed-in users.
                </p>
              </div>
            </div>

            <div className="card" style={{ padding: 24, background: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <h2 className="text-h4" style={{ margin: 0 }}>Your profile details</h2>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {missingDetails.length > 0 ? `Add ${missingDetails.join(', ')} to complete your profile.` : 'Profile complete'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {[
                  ['Full name', profile.full_name || user?.displayName || 'Not added yet'],
                  ['Email', profile.email || user?.email || 'Not added yet'],
                  ['Username', profile.username || 'Not set'],
                  ['Pharmaco ID', profile.pharmaco_id || 'Pending'],
                  ['Role', profile.role === 'healthcare_professional' ? 'Healthcare professional' : 'Patient or caregiver'],
                  ['Contact number', profile.contact_number || 'Not added yet'],
                  ['Date of birth', profile.date_of_birth || 'Not added yet'],
                  ['Gender', profile.gender || 'Not added yet'],
                  ['Country', profile.country || 'Not added yet'],
                  ['State', profile.state || 'Not added yet'],
                  ['City', profile.city || 'Not added yet'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p style={{ margin: '0 0 4px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>{label}</p>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-primary)' }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '24px 0 80px' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {QUICK_ACTIONS.map(({ to, label, icon: Icon, description }) => (
              <Link key={to} to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card" style={{ padding: 24, height: '100%' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    <Icon size={20} color="var(--color-primary)" />
                  </div>
                  <h3 className="text-h4" style={{ marginBottom: 8 }}>{label}</h3>
                  <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
