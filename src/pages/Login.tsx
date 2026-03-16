import { useAuth } from '../auth/AuthContext.tsx';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { token, startLogin } = useAuth();
  if (token) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-[--color-page-bg] flex items-center justify-center p-4">
      <div className="card p-8 w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-[--color-dp-1400] mb-2">Badges Management</h1>
        <p className="text-[--color-dp-800] text-sm mb-6">Admin portal — sign in to continue</p>
        <button
          onClick={startLogin}
          className="btn btn-primary btn-rounded w-full"
        >
          Sign in with Goslar ID
        </button>
      </div>
    </div>
  );
}
