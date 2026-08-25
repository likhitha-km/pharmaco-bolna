import { useEffect, useState } from 'react';
import { Mail, RefreshCcw } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { mapFirebaseError } from '../utils/firebaseErrors.js';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const { user, userProfile, loading, logout } = useAuth();
  const [resending, setResending] = useState(false);
  const [counter, setCounter] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !db) {
      return undefined;
    }

    const interval = setInterval(async () => {
      try {
        await user.reload();
        if (user.emailVerified) {
          await updateDoc(doc(db, 'users', user.uid), {
            email_verified: true,
            account_status: 'active',
            updated_at: serverTimestamp(),
          });
          navigate('/dashboard', { replace: true });
        }
      } catch (_err) {
        // Keep silent polling failures non-blocking.
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, navigate]);

  useEffect(() => {
    if (counter <= 0) {
      return undefined;
    }
    const timeout = setTimeout(() => setCounter((prev) => prev - 1), 1000);
    return () => clearTimeout(timeout);
  }, [counter]);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!loading && userProfile?.email_verified) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleResend = async () => {
    if (!user || counter > 0) {
      return;
    }

    setError('');
    setResending(true);

    try {
      await sendEmailVerification(user, {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: false,
      });
      setCounter(60);
      setMessage('Verification email sent successfully.');
    } catch (err) {
      setError(mapFirebaseError(err.code || err.message));
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/signup', { replace: true });
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-success" style={{ gap: 12 }}>
          <Mail size={48} color="#CC785C" />
          <h1 className="auth-title">Verify Your Email Address</h1>
          <p className="auth-subtitle" style={{ marginBottom: 0 }}>
            We sent a verification link to {user?.email}. Click the link in the email to activate your account.
          </p>
          <p className="auth-subtitle" style={{ marginBottom: 0 }}>
            If you do not see the email, check your spam folder.
          </p>
        </div>

        {error ? <p className="field-error" style={{ textAlign: 'center', marginTop: 12 }}>{error}</p> : null}
        {message ? <p style={{ color: '#34C759', textAlign: 'center', marginTop: 12 }}>{message}</p> : null}

        <button className="auth-btn-primary" type="button" onClick={handleResend} disabled={resending || counter > 0}>
          <RefreshCcw size={14} />
          {counter > 0 ? `Resend in ${counter}s...` : 'Resend Verification Email'}
        </button>

        <button className="auth-link-button" type="button" onClick={handleSignOut}>
          Use a different email? Sign out
        </button>
      </section>
    </main>
  );
}
