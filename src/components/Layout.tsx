import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  title?: string;
  back?: { to: string; label: string };
}

export default function Layout({ children, title, back }: Props) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm font-semibold text-white hover:text-blue-400 transition-colors">
            Badges Admin
          </Link>
          {back && (
            <>
              <span className="text-gray-600">/</span>
              <Link to={back.to} className="text-sm text-gray-400 hover:text-white transition-colors">
                {back.label}
              </Link>
            </>
          )}
          {title && (
            <>
              <span className="text-gray-600">/</span>
              <span className="text-sm text-gray-300">{title}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {import.meta.env.DEV && (
            <Link to="/debug" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Debug
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
