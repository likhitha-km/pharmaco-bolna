import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1 className="auth-title">Unauthorized</h1>
        <p className="auth-subtitle">You do not have permission to access this page.</p>
        <Link className="auth-btn-primary" to="/dashboard">Go to Dashboard</Link>
      </section>
    </main>
  );
}
