import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthState {
  token: string | null;
  login: (tokens: Record<string, unknown>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'badges_manage_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  const login = useCallback((tokens: Record<string, unknown>) => {
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

  return <AuthContext.Provider value={{ token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
