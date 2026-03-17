import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { startLogin as pkceStartLogin } from './pkce.ts';

type OrgRole = 'member' | 'admin' | 'owner';

interface AuthState {
  token: string | null;
  orgIds: string[];
  isLoading: boolean;
  isMember: (orgId: string) => boolean;
  isAdmin: (orgId: string) => boolean;
  isOwner: (orgId: string) => boolean;
  getRole: (orgId: string) => OrgRole | null;
  getOrgName: (orgId: string) => string | null;
  login: (tokens: Record<string, unknown>) => void;
  logout: () => void;
  startLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'badges_manage_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [orgIds, setOrgIds] = useState<string[]>([]);
  const [orgRoles, setOrgRoles] = useState<Record<string, OrgRole>>({});
  const [orgNames, setOrgNames] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  const login = useCallback((tokens: Record<string, unknown>) => {
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
    setOrgRoles({});
    setOrgNames({});
  }, []);

  // Proactive expiry: schedule logout when the token's exp is reached
  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof payload.exp === 'number') {
        const msUntilExpiry = payload.exp * 1000 - Date.now();
        if (msUntilExpiry <= 0) {
          logout();
          return;
        }
        const timer = setTimeout(() => {
          logout();
          window.location.href = '/login';
        }, msUntilExpiry);
        return () => clearTimeout(timer);
      }
    } catch { /* ignore malformed token */ }
  }, [token, logout]);

  // Reactive: log out immediately when any API call returns 401
  useEffect(() => {
    function handleUnauthorized() {
      logout();
      window.location.href = '/login';
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setOrgIds([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetch('/api/v1/users/me/organisations', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.organisations) {
          setOrgIds(data.organisations.map((o: { organisation_id: string }) => o.organisation_id));
          const roles: Record<string, OrgRole> = {};
          const names: Record<string, string | null> = {};
          data.organisations.forEach((o: { organisation_id: string; role: OrgRole; organisation_name?: string | null }) => {
            roles[o.organisation_id] = o.role;
            names[o.organisation_id] = o.organisation_name ?? null;
          });
          setOrgRoles(roles);
          setOrgNames(names);
        }
      })
      .catch(() => { setOrgIds([]); setOrgRoles({}); setOrgNames({}); })
      .finally(() => setIsLoading(false));
  }, [token]);

  const startLogin = useCallback(() => pkceStartLogin(), []);

  const isMember = useCallback((orgId: string) => orgIds.includes(orgId), [orgIds]);
  const getRole = useCallback((orgId: string): OrgRole | null => orgRoles[orgId] ?? null, [orgRoles]);
  const isAdmin = useCallback((orgId: string) => orgRoles[orgId] === 'admin' || orgRoles[orgId] === 'owner', [orgRoles]);
  const isOwner = useCallback((orgId: string) => orgRoles[orgId] === 'owner', [orgRoles]);
  const getOrgName = useCallback((orgId: string): string | null => orgNames[orgId] ?? null, [orgNames]);

  return (
    <AuthContext.Provider value={{ token, orgIds, isLoading, isMember, isAdmin, isOwner, getRole, getOrgName, login, logout, startLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
