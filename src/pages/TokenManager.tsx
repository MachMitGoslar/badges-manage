import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../auth/AuthContext.tsx';
import { api, ApiError, type BadgeTemplate, type GrantToken, type CreateTokenInput } from '../api/client.ts';
import Layout from '../components/Layout.tsx';

export default function TokenManager() {
  const { orgId } = useParams<{ orgId: string }>();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: badgesData } = useQuery({
    queryKey: ['org-badges', orgId],
    queryFn: () => api.get<{ badges: BadgeTemplate[] }>(`/api/v1/orgs/${orgId}/badges`, token),
  });

  const { data: tokensData, isLoading } = useQuery({
    queryKey: ['org-tokens', orgId],
    queryFn: () => api.get<{ tokens: GrantToken[] }>(`/api/v1/orgs/${orgId}/grant-tokens`, token),
  });

  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [qrToken, setQrToken] = useState<GrantToken | null>(null);

  const grantUrl = (t: GrantToken) => `${window.location.origin}/grant/${t.token}`;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBadgeId) return;
    setCreating(true);
    setCreateError('');

    const payload: CreateTokenInput = { badge_template_id: selectedBadgeId, note: note || undefined };
    try {
      const result = await api.post<{ token: GrantToken }>(`/api/v1/orgs/${orgId}/grant-tokens`, token, payload);
      setQrToken(result.token);
      setSelectedBadgeId('');
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['org-tokens', orgId] });
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : 'Failed to create token');
    } finally {
      setCreating(false);
    }
  }

  const badges = badgesData?.badges ?? [];
  const tokens = tokensData?.tokens ?? [];

  return (
    <Layout back={{ to: `/orgs/${orgId}`, label: 'Organisation' }} title="Grant Tokens">
      <h1 className="text-2xl font-bold text-white mb-6">Grant Tokens</h1>

      {/* Create form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
        <h2 className="font-semibold text-white mb-4">Create new token</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-gray-400 mb-1">Badge</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
              value={selectedBadgeId}
              onChange={(e) => setSelectedBadgeId(e.target.value)}
              required
            >
              <option value="">Select a badge…</option>
              {badges.map((b) => (
                <option key={b.id} value={b.id}>{b.text_condition}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-gray-400 mb-1">Note (optional)</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Event 2024-06"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !selectedBadgeId}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
        {createError && <p className="text-red-400 text-sm mt-2">{createError}</p>}
      </div>

      {/* QR modal */}
      {qrToken && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full text-center">
            <h3 className="font-semibold text-white mb-1">Token created</h3>
            <p className="text-xs text-gray-400 mb-4 break-all">{grantUrl(qrToken)}</p>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={grantUrl(qrToken)} size={200} bgColor="#111827" fgColor="#f9fafb" />
            </div>
            <p className="text-xs font-mono text-gray-400 break-all mb-4">{qrToken.token}</p>
            <button
              onClick={() => setQrToken(null)}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2.5 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Token list */}
      {isLoading && <p className="text-gray-400">Loading tokens…</p>}

      {tokensData && (
        <div className="space-y-2">
          {tokens.length === 0 && <p className="text-gray-500">No tokens yet.</p>}
          {tokens.map((t) => {
            const badge = badges.find((b) => b.id === t.badge_template_id);
            return (
              <div
                key={t.id}
                className={`bg-gray-900 border rounded-lg px-5 py-3 flex items-center gap-4 ${t.redeemed_at ? 'border-gray-800 opacity-60' : 'border-gray-700'}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-mono truncate">{t.token}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {badge?.text_condition ?? t.badge_template_id}
                    {t.note && <> · {t.note}</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {t.redeemed_at ? (
                    <span className="text-xs text-green-400">Redeemed</span>
                  ) : (
                    <button
                      onClick={() => setQrToken(t)}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded transition-colors"
                    >
                      Show QR
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Link to={`/orgs/${orgId}`} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← Back to organisation
        </Link>
      </div>
    </Layout>
  );
}
