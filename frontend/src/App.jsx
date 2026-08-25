import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar.jsx';
import { Footer } from './components/layout/Footer.jsx';
import { ToastProvider } from './components/common/Toast.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import ProtectedRoute from './auth/ProtectedRoute.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { ConversationProvider } from './context/ConversationContext.jsx';

import Home from './pages/Home.jsx';
import Report from './pages/Report.jsx';
import ReportReview from './pages/ReportReview.jsx';
import DrugSearch from './pages/DrugSearch.jsx';
import DrugProfile from './pages/DrugProfile.jsx';
import MyReports from './pages/MyReports.jsx';
import Dashboard from './pages/Dashboard.jsx';
import UserDashboard from './pages/UserDashboard.jsx';
import RegulatorDashboard from './pages/RegulatorDashboard.jsx';
import SafetyHub from './pages/SafetyHub.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import CompleteProfile from './pages/CompleteProfile.jsx';
import Unauthorized from './pages/Unauthorized.jsx';

function RootRedirect() {
  return <Home />;
}

function AppLayout() {
  const location = useLocation();
  const isScrollFooter = ['/', '/home', '/safety', '/search'].includes(location.pathname) || location.pathname.startsWith('/drug/');

  return (
    <>
      <Navbar />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/home" element={<Home />} />
          <Route path="/user-dashboard" element={(
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          )} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route
            path="/verify-email"
            element={(
              <ProtectedRoute>
                <VerifyEmail />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/complete-profile"
            element={(
              <ProtectedRoute>
                <CompleteProfile />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/report"
            element={(
              <ProtectedRoute>
                <Report />
              </ProtectedRoute>
            )}
          />
          <Route path="/report/review/:conversationId" element={<ReportReview />} />
          <Route path="/search" element={<DrugSearch />} />
          <Route path="/drug/:drugName" element={<DrugProfile />} />
          <Route
            path="/my-reports"
            element={(
              <ProtectedRoute>
                <MyReports />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/dashboard"
            element={(
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/regulator"
            element={(
              <ProtectedRoute requiredRole="healthcare_professional">
                <RegulatorDashboard />
              </ProtectedRoute>
            )}
          />
          <Route path="/safety" element={<SafetyHub />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {isScrollFooter && <Footer />}
      </div>
      {!isScrollFooter && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <ConversationProvider>
            <ToastProvider>
              <AppLayout />
            </ToastProvider>
          </ConversationProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
