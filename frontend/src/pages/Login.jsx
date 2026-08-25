import { useMemo, useState } from 'react';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import GoogleOAuthButton from '../components/auth/GoogleOAuthButton.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { mapFirebaseError } from '../utils/firebaseErrors.js';

function detectIdentifierType(identifier) {
  const value = identifier.trim();

  if (!value) {
    return null;
  }

  if (/^phr-/i.test(value)) {
    return { text: 'Pharmaco ID', className: 'hint-pill pill-pharmaco' };
  }

  if (value.includes('@')) {
    return { text: 'Email address', className: 'hint-pill pill-email' };
  }

  return { text: 'Username', className: 'hint-pill pill-username' };
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, loginWithIdentifier, signInWithGoogle, setAuthError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const identifierHint = useMemo(() => detectIdentifierType(identifier), [identifier]);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const redirectPath = location.state?.from?.pathname || '/dashboard';

  const handleGoogle = async () => {
    setError('');
    setAuthError(null);
    setGoogleLoading(true);

    try {
      const result = await signInWithGoogle('patient');
      navigate(result.isNewUser ? '/complete-profile' : redirectPath, { replace: true });
    } catch (err) {
      setError(mapFirebaseError(err.code || err.message));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setAuthError(null);
    setSubmitting(true);

    try {
      await loginWithIdentifier(identifier, password);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(mapFirebaseError(err.code || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <img className="auth-logo" src="/pharmaco-logo.png" alt="Pharmaco" style={{ height: 32 }} />
        <h1 className="auth-title">Sign in to Pharmaco</h1>
        <p className="auth-subtitle">India&apos;s drug safety platform</p>

        {error ? (
          <div className="auth-error" role="alert">
            <AlertTriangle size={18} color="#FF3B30" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        <GoogleOAuthButton
          onClick={handleGoogle}
          loading={googleLoading}
          label="Continue with Google"
        />

        <div className="auth-divider" aria-hidden="true">
          <span />
          <p>or sign in with credentials</p>
          <span />
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label className="field-label" htmlFor="identifier">Email, Username, or Pharmaco ID</label>
            <input
              id="identifier"
              className="field-input"
              type="text"
              placeholder="e.g. rahul23 or PHR-2026-A4K9MZ"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
            />
            {identifierHint ? <span className={identifierHint.className}>{identifierHint.text}</span> : null}
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="password">Password</label>
            <div className="field-input-wrapper">
              <input
                id="password"
                className="field-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <p className="auth-forgot">
            <Link to="/forgot-password">Forgot password?</Link>
          </p>

          <button className="auth-btn-primary" type="submit" disabled={submitting || googleLoading}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/signup">Create account</Link>
        </p>

        <p className="auth-legal">
          By signing in you agree to our Privacy Policy and Terms of Service. Data processed per India&apos;s DPDP Act 2023.
        </p>
      </section>
    </main>
  );
}
