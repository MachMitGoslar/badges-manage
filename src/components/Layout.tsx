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
    <div className="min-h-screen bg-[--color-page-bg]">
      <header className="site-header">
        <div className="flex items-center gap-3">
          <Link to="/" className="nav-link font-semibold">
            Badges Admin
          </Link>
          {back && (
            <>
              <span className="text-[--color-dp-400]">/</span>
              <Link to={back.to} className="nav-link">
                {back.label}
              </Link>
            </>
          )}
          {title && (
            <>
              <span className="text-[--color-dp-400]">/</span>
              <span className="text-sm text-[--color-dp-800]">{title}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {import.meta.env.DEV && (
            <Link to="/debug" className="nav-link text-xs">
              Debug
            </Link>
          )}
          <Link to="/profile" className="nav-link text-xs">
            Profile
          </Link>
          <button
            onClick={handleLogout}
            className="text-xs text-[--color-dp-800] hover:text-[--color-mango-1200] transition-colors bg-transparent border-none cursor-pointer p-0"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
