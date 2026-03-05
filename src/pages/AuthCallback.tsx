import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';

export default function AuthCallback() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const tokensParam = params.get('tokens');

    if (!tokensParam) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      const tokens = JSON.parse(atob(tokensParam.replace(/-/g, '+').replace(/_/g, '/')));
      login(tokens);
      navigate('/', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  }, [login, navigate]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Completing sign-in…</p>
    </div>
  );
}
