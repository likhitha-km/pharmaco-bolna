import { LoaderCircle } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="auth-page">
        <div className="auth-loading">
          <LoaderCircle className="animate-spin" size={36} color="#CC785C" />
          <p>Pharmaco</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (userProfile && !userProfile.email_verified && !userProfile.google_account && location.pathname !== '/verify-email') {
    return <Navigate to="/verify-email" replace />;
  }

  if (userProfile?.profile_incomplete && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />;
  }

  if (requiredRole && userProfile?.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
