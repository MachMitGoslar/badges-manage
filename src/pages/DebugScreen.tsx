import { useAuth } from '../auth/AuthContext.tsx';
import Layout from '../components/Layout.tsx';
import { useNavigate } from 'react-router-dom';

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
  const { token, orgIds, logout } = useAuth();
  const navigate = useNavigate();
  const payload = token ? decodeJwt(token) : null;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <Layout title="Debug">
      <h1 className="text-2xl font-bold text-white mb-6">Auth Debug</h1>

      <div className="space-y-6">
        {/* Token summary */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Session</h2>
          {token ? (
            <div className="space-y-2 text-sm">
              <div className="flex gap-3">
                <span className="text-gray-500 w-24 shrink-0">Status</span>
                <span className="text-green-400 font-medium">authenticated</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-500 w-24 shrink-0">Subject</span>
                <span className="text-gray-200 font-mono">{String(payload?.sub ?? '—')}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-500 w-24 shrink-0">Email</span>
                <span className="text-gray-200">{String(payload?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ?? payload?.email ?? '—')}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-500 w-24 shrink-0">Expires</span>
                <span className={`font-medium ${formatExpiry(payload?.exp) === 'expired' ? 'text-red-400' : 'text-yellow-300'}`}>
                  {formatExpiry(payload?.exp)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No token — not authenticated.</p>
          )}
        </section>

        {/* Org memberships */}
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Org Memberships ({orgIds.length})
          </h2>
          {orgIds.length === 0 ? (
            <p className="text-gray-500 text-sm">No org memberships found.</p>
          ) : (
            <ul className="space-y-1">
              {orgIds.map((id) => (
                <li key={id} className="text-sm font-mono text-gray-300">{id}</li>
              ))}
            </ul>
          )}
        </section>

        {/* Raw JWT payload */}
        {payload && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Raw JWT Payload</h2>
            <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </section>
        )}

        {/* Raw token */}
        {token && (
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Raw Access Token</h2>
            <p className="text-xs font-mono text-gray-500 break-all">{token}</p>
          </section>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="bg-red-950 hover:bg-red-900 text-red-400 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Clear session
          </button>
        </div>
      </div>
    </Layout>
  );
}
