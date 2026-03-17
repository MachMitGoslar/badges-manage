import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';
import { exchangeCode } from '../auth/pkce.ts';

export default function AuthCallback() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const code = params.get('code');

    if (error) {
      console.error('[AuthCallback] OIDC error:', error, params.get('error_description'));
      navigate('/login', { replace: true });
      return;
    }

    if (!code) {
      navigate('/login', { replace: true });
      return;
    }

    exchangeCode(code)
      .then((tokens) => {
        login(tokens);
        navigate('/', { replace: true });
      })
      .catch((err) => {
        console.error('[AuthCallback] token exchange failed:', err);
        navigate('/login', { replace: true });
      });
  }, [login, navigate]);

  return (
    <div className="min-h-screen bg-[--color-page-bg] flex items-center justify-center gap-3">
      <div className="w-5 h-5 border-2 border-[--color-mango-600] border-t-transparent rounded-full animate-spin" />
      <p className="text-[--color-dp-700] text-sm">Completing sign-in…</p>
    </div>
  );
}
