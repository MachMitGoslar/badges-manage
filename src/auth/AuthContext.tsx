import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { startLogin as pkceStartLogin } from './pkce.ts';

interface AuthState {
  token: string | null;
  orgIds: string[];
  isMember: (orgId: string) => boolean;
  login: (tokens: Record<string, unknown>) => void;
  logout: () => void;
  startLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'badges_manage_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [orgIds, setOrgIds] = useState<string[]>([]);

  useEffect(() => {
    if (!token) {
      setOrgIds([]);
      return;
    }
    fetch('/api/v1/users/me/organisations', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.organisations) {
          setOrgIds(data.organisations.map((o: { organisation_id: string }) => o.organisation_id));
        }
      })
      .catch(() => setOrgIds([]));
  }, [token]);

  const login = useCallback((tokens: Record<string, unknown>) => {
    console.log('Logging in with tokens:', tokens);
    const accessToken = tokens.access_token as string;
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (tokens.refresh_token) {
      localStorage.setItem('badges_manage_refresh', tokens.refresh_token as string);
    }
    setToken(accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('badges_manage_refresh');
    setToken(null);
    setOrgIds([]);
  }, []);

  const startLogin = useCallback(() => pkceStartLogin(), []);

  const isMember = useCallback((orgId: string) => orgIds.includes(orgId), [orgIds]);

  return (
    <AuthContext.Provider value={{ token, orgIds, isMember, login, logout, startLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
