import { useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { mapFirebaseError } from '../utils/firebaseErrors.js';
import { validators } from '../utils/validators.js';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const emailError = validators.email(email);
    setError(emailError || '');

    if (emailError) {
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccess(true);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else {
        setError(mapFirebaseError(err.code || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1 className="auth-title">Reset Your Password</h1>
        <p className="auth-subtitle">
          Enter your registered email address. We will send you a link to reset your password.
        </p>

        {success ? (
          <div className="auth-success-card">
            <CheckCircle size={20} color="#34C759" />
            <p>
              Reset link sent to {email}. Check your inbox and follow the instructions.
              The link expires in 1 hour.
            </p>
            <Link className="auth-link-inline" to="/login">Back to Sign In</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {error ? (
              <div className="auth-error" role="alert">
                <AlertTriangle size={18} color="#FF3B30" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="field-group">
              <label className="field-label" htmlFor="email">Email address</label>
              <input
                id="email"
                className="field-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button className="auth-btn-primary" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
