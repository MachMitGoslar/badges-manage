import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { startLogin as pkceStartLogin } from './pkce.ts';

interface AuthState {
  token: string | null;
  login: (tokens: Record<string, unknown>) => void;
  logout: () => void;
  startLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'badges_manage_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const login = useCallback((tokens: Record<string, unknown>) => {
    console.log('Logging in with tokens:', tokens);
    const accessToken = tokens.access_token as string;
    localStorage.setItem(TOKEN_KEY, accessToken);
    // Store refresh token if present
    if (tokens.refresh_token) {
      localStorage.setItem('badges_manage_refresh', tokens.refresh_token as string);
    }
    setToken(accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('badges_manage_refresh');
    setToken(null);
  }, []);

  const startLogin = useCallback(() => pkceStartLogin(), []);

  return <AuthContext.Provider value={{ token, login, logout, startLogin }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
