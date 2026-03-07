import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.tsx';
import Login from './pages/Login.tsx';
import AuthCallback from './pages/AuthCallback.tsx';
import Dashboard from './pages/Dashboard.tsx';
import OrgDetail from './pages/OrgDetail.tsx';
import BadgeForm from './pages/BadgeForm.tsx';
import TokenManager from './pages/TokenManager.tsx';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth-callback" element={<AuthCallback />} />
      <Route path="/dev/auth" element={<AuthCallback />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orgs/:orgId"
        element={
          <ProtectedRoute>
            <OrgDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orgs/:orgId/badges/new"
        element={
          <ProtectedRoute>
            <BadgeForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orgs/:orgId/badges/:badgeId"
        element={
          <ProtectedRoute>
            <BadgeForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orgs/:orgId/tokens"
        element={
          <ProtectedRoute>
            <TokenManager />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
