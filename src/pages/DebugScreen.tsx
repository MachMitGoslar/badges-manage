import { useAuth } from '../auth/AuthContext.tsx';
import Layout from '../components/Layout.tsx';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.ts';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function formatExpiry(exp: unknown): string {
  if (typeof exp !== 'number') return 'unknown';
  const ms = exp * 1000 - Date.now();
  if (ms <= 0) return 'expired';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function DebugScreen() {
  const { token, orgIds, getOrgName, logout } = useAuth();
  const navigate = useNavigate();
  const payload = token ? decodeJwt(token) : null;

  const { data: meData } = useQuery({
    queryKey: ['debug-me'],
    queryFn: () => api.get<any>('/api/v1/users/me', token),
    enabled: !!token,
  });

  const { data: badgesData } = useQuery({
    queryKey: ['debug-badges'],
    queryFn: () => api.get<any>('/api/v1/users/me/badges', token),
    enabled: !!token,
  });

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <Layout title="Debug">
      <h1 className="text-2xl font-bold text-[--color-dp-1400] mb-6">Auth Debug</h1>

      <div className="space-y-6">
        {/* Token summary */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider mb-3">Session</h2>
          {token ? (
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <span className="text-[--color-dp-700] w-24 shrink-0">Status</span>
                <span className="text-[--color-success-600] font-medium">authenticated</span>
              </div>
              <div className="flex gap-3">
                <span className="text-[--color-dp-700] w-24 shrink-0">Subject</span>
                <span className="text-[--color-dp-1200] font-mono">{String(payload?.sub ?? '—')}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-[--color-dp-700] w-24 shrink-0">Email</span>
                <span className="text-[--color-dp-1200]">{String(payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ?? payload?.email ?? '—')}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-[--color-dp-700] w-24 shrink-0">Expires</span>
                <span className={`font-medium ${formatExpiry(payload?.exp) === 'expired' ? 'text-[--color-ferocious-800]' : 'text-[--color-mango-900]'}`}>
                  {formatExpiry(payload?.exp)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[--color-dp-700] text-sm">No token — not authenticated.</p>
          )}
        </section>

        {/* Org memberships */}
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider mb-3">
            Org Memberships ({orgIds.length})
          </h2>
          {orgIds.length === 0 ? (
            <p className="text-[--color-dp-700] text-sm">No org memberships found.</p>
          ) : (
            <ul className="space-y-1">
              {orgIds.map((id) => {
                const name = getOrgName(id);
                return (
                  <li key={id} className="text-sm text-[--color-dp-1200]">
                    {name ? (
                      <><span className="font-medium">{name}</span> <span className="font-mono text-[--color-dp-600]">({id})</span></>
                    ) : (
                      <span className="font-mono">{id}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Badge showcase */}
        {meData?.profile?.showcase && (
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider mb-3">
              Showcase ({meData.profile.showcase.length} slots)
            </h2>
            {meData.profile.showcase.length === 0 ? (
              <p className="text-[--color-dp-700] text-sm">No badges in showcase.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {meData.profile.showcase.map((slot: any) => (
                  <div key={slot.position} className="flex flex-col items-center gap-1">
                    {slot.badge?.imageURL ? (
                      <img src={slot.badge.imageURL} alt={slot.badge.name ?? ''} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[--color-dp-200] flex items-center justify-center text-xs text-[--color-dp-600]">?</div>
                    )}
                    <span className="text-[10px] text-[--color-dp-600]">#{slot.position}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Badge list */}
        {badgesData && (
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider mb-3">
              Earned Badges ({badgesData.total_badges ?? 0}) · {badgesData.total_points ?? 0} pts
            </h2>
            {(badgesData.badges ?? []).length === 0 ? (
              <p className="text-[--color-dp-700] text-sm">No badges earned.</p>
            ) : (
              <ul className="space-y-2">
                {badgesData.badges.map((eb: any) => (
                  <li key={eb.earned_badge_id} className="flex items-center gap-3 text-sm">
                    {eb.badge_template?.imageURL ? (
                      <img src={eb.badge_template.imageURL} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-[--color-dp-200] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[--color-dp-1200] font-medium truncate">{eb.badge_template?.name ?? '—'}</p>
                      <p className="text-[--color-dp-600] text-xs">{eb.organisation?.name ?? eb.organisation?.id ?? '—'}</p>
                    </div>
                    {eb.badge_template?.points && (
                      <span className="ml-auto text-xs text-[--color-mango-900] font-medium shrink-0">{eb.badge_template.points} pts</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Raw JWT payload */}
        {payload && (
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider mb-3">Raw JWT Payload</h2>
            <pre className="text-xs text-[--color-dp-700] overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </section>
        )}

        {/* Raw token */}
        {token && (
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider mb-3">Raw Access Token</h2>
            <p className="text-xs font-mono text-[--color-dp-600] break-all">{token}</p>
          </section>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="btn btn-destructive btn-rounded"
          >
            Clear session
          </button>
        </div>
      </div>
    </Layout>
  );
}
