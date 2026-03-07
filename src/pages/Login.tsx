import { useAuth } from '../auth/AuthContext.tsx';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { token, startLogin } = useAuth();
  if (token) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-white mb-2">Badges Management</h1>
        <p className="text-gray-400 text-sm mb-6">Admin portal — sign in to continue</p>
        <button
          onClick={startLogin}
          className="inline-block w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors cursor-pointer"
        >
          Sign in with Goslar ID
        </button>
      </div>
    </div>
  );
}
