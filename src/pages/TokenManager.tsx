import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext.tsx';
import { api, ApiError, type BadgeTemplate, type GrantToken, type GrantLogEntry, type CreateTokenInput } from '../api/client.ts';
import Layout from '../components/Layout.tsx';

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return '∞';
  return new Date(expiresAt).toLocaleDateString();
}

const STATUS_STYLES: Record<GrantLogEntry['status'], string> = {
  success:         'text-[--color-success-600]',
  failed:          'text-[--color-ferocious-800]',
  already_earned:  'text-[--color-mango-900]',
  token_expired:   'text-orange-600',
  token_exhausted: 'text-orange-600',
};

function RedemptionLog({
  orgId, tokenId, authToken, badgeImageUrl,
}: {
  orgId: string;
  tokenId: string;
  authToken: string | null;
  badgeImageUrl: string | null;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['token-redemptions', tokenId],
    queryFn: () => api.get<{ redemptions: GrantLogEntry[] }>(
      `/api/v1/orgs/${orgId}/grant-tokens/${tokenId}/redemptions`,
      authToken,
    ),
  });

  if (isLoading) return <p className="text-xs text-[--color-dp-600] py-2">Loading…</p>;

  const entries = data?.redemptions ?? [];
  if (entries.length === 0) return <p className="text-xs text-[--color-dp-700] py-2">No redemptions yet.</p>;

  return (
    <div className="mt-3 border-t border-[--color-border] pt-3 space-y-1.5">
      {badgeImageUrl && (
        <div className="flex items-center gap-2 mb-2">
          <img src={badgeImageUrl} alt="Badge" className="w-8 h-8 rounded object-cover" />
        </div>
      )}
      {entries.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-3 text-xs">
          <span className="text-[--color-dp-800] truncate max-w-[180px]" title={e.user_id}>
            {e.user_name
              ? <>{e.user_name} <span className="text-[--color-dp-500] font-mono">{e.user_id.slice(0, 6)}…</span></>
              : <span className="font-mono">{e.user_id.slice(0, 8)}…</span>
            }
          </span>
          <span className={`shrink-0 ${STATUS_STYLES[e.status]}`}>{e.status.replace(/_/g, ' ')}</span>
          <span className="text-[--color-dp-400] shrink-0">
            {new Date(e.granted_at).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function isExhausted(t: GrantToken): boolean {
  return !t.is_active || (t.max_uses !== null && t.current_uses >= t.max_uses);
}

export default function TokenManager() {
  const { orgId } = useParams<{ orgId: string }>();
  const { token, isMember } = useAuth();
  const queryClient = useQueryClient();

  if (!isMember(orgId ?? '')) {
    return (
      <Layout back={{ to: `/orgs/${orgId}`, label: 'Organisation' }} title="Grant Tokens">
        <p className="text-[--color-dp-700]">You are not a member of this organisation.</p>
      </Layout>
    );
  }

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
  const [maxUses, setMaxUses] = useState<string>('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [qrToken, setQrToken] = useState<GrantToken | null>(null);
  const [expandedTokenId, setExpandedTokenId] = useState<string | null>(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);

  const grantUrl = (t: GrantToken) => t.grant_url ?? `${window.location.origin}/grant/${t.token}`;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBadgeId) return;
    setCreating(true);
    setCreateError('');

    const payload: CreateTokenInput = {
      badge_template_id: selectedBadgeId,
      note: note || undefined,
      max_uses: maxUses ? Number(maxUses) : undefined,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    };
    try {
      const result = await api.post<{ token: GrantToken }>(`/api/v1/orgs/${orgId}/grant-tokens`, token, payload);
      setQrToken(result.token);
      setSelectedBadgeId('');
      setNote('');
      setMaxUses('1');
      setExpiresAt('');
      queryClient.invalidateQueries({ queryKey: ['org-tokens', orgId] });
      toast.success('Grant token created');
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
      <h1 className="text-2xl font-bold text-[--color-dp-1400] mb-6">Grant Tokens</h1>

      {/* Create form */}
      <div className="card p-5 mb-8">
        <h2 className="font-semibold text-[--color-dp-1400] mb-4">Create new token</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-48">
              <label className="block text-xs text-[--color-dp-700] mb-1">Badge</label>
              <select
                className="input input-sm"
                value={selectedBadgeId}
                onChange={(e) => setSelectedBadgeId(e.target.value)}
                required
              >
                <option value="">Select a badge…</option>
                {badges.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs text-[--color-dp-700] mb-1">Note (optional)</label>
              <input
                className="input input-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Event 2024-06"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-36">
              <label className="block text-xs text-[--color-dp-700] mb-1">Max uses</label>
              <input
                className="input input-sm"
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs text-[--color-dp-700] mb-1">Redeemable until (optional)</label>
              <input
                className="input input-sm"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={creating || !selectedBadgeId}
              className="btn btn-primary btn-rounded"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
        {createError && <p className="text-[--color-ferocious-800] text-sm mt-2">{createError}</p>}
      </div>

      {/* QR modal */}
      {qrToken && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[--color-border] rounded-xl p-6 max-w-sm w-full text-center shadow-xl">
            <h3 className="font-semibold text-[--color-dp-1400] mb-1">Token created</h3>
            <p className="text-xs text-[--color-dp-700] mb-4 break-all">{grantUrl(qrToken)}</p>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={grantUrl(qrToken)} size={200} bgColor="#ffffff" fgColor="#222222" />
            </div>
            <p className="text-xs font-mono text-[--color-dp-700] break-all mb-4">{qrToken.token}</p>
            <button
              onClick={() => setQrToken(null)}
              className="btn btn-secondary btn-rounded w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Token list */}
      {isLoading && <p className="text-[--color-dp-700]">Loading tokens…</p>}

      {tokensData && (
        <div className="space-y-2">
          {tokens.length === 0 && <p className="text-[--color-dp-700]">No tokens yet.</p>}
          {tokens.map((t) => {
            const badge = badges.find((b) => b.id === t.badge_template_id);
            const exhausted = isExhausted(t);
            const note = t.metadata?.note as string | undefined;
            const expanded = expandedTokenId === t.id;
            const usePct = t.max_uses ? Math.min(100, (t.current_uses / t.max_uses) * 100) : null;

            return (
              <div
                key={t.id}
                className={`card px-5 py-3 ${exhausted ? 'opacity-60' : ''}`}
              >
                {/* Main row */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[--color-dp-1200] font-mono truncate">{t.token}</p>
                    <p className="text-xs text-[--color-dp-700] mt-0.5">
                      {badge?.name ?? t.badge_template_id}
                      {note && <> · {note}</>}
                    </p>

                    {/* Uses progress */}
                    <div className="flex items-center gap-2 mt-1.5">
                      {usePct !== null && (
                        <div className="w-24 h-1 bg-[--color-dp-200] rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${usePct >= 100 ? 'bg-[--color-ferocious-800]' : 'bg-[--color-info-1000]'}`}
                            style={{ width: `${usePct}%` }}
                          />
                        </div>
                      )}
                      <span className="text-xs text-[--color-dp-600]">
                        {t.current_uses}/{t.max_uses ?? '∞'} uses
                        {t.expires_at && <> · expires {formatExpiry(t.expires_at)}</>}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!exhausted && (
                      <>
                        <button
                          onClick={() => setQrToken(t)}
                          className="btn btn-sm btn-secondary btn-rounded"
                        >
                          Show QR
                        </button>
                        {confirmDeactivateId === t.id ? (
                          <>
                            <span className="text-xs text-[--color-dp-800]">Deactivate?</span>
                            <button
                              onClick={async () => {
                                try {
                                  await api.delete(`/api/v1/orgs/${orgId}/grant-tokens/${t.id}`, token);
                                  queryClient.invalidateQueries({ queryKey: ['org-tokens', orgId] });
                                  toast.success('Token deactivated');
                                } catch (e) {
                                  toast.error(e instanceof ApiError ? e.message : 'Failed to deactivate token');
                                } finally {
                                  setConfirmDeactivateId(null);
                                }
                              }}
                              className="btn btn-sm btn-destructive btn-rounded"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeactivateId(null)}
                              className="btn btn-sm btn-secondary btn-rounded"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDeactivateId(t.id)}
                            className="btn btn-sm btn-destructive btn-rounded"
                          >
                            Deactivate
                          </button>
                        )}
                      </>
                    )}
                    {exhausted && (
                      <span className="text-xs text-[--color-dp-600]">{!t.is_active ? 'Deactivated' : 'Exhausted'}</span>
                    )}
                    <button
                      onClick={() => setExpandedTokenId(expanded ? null : t.id)}
                      className="text-xs text-[--color-dp-600] hover:text-[--color-dp-1200] transition-colors px-1"
                      title={expanded ? 'Hide redemptions' : 'Show redemptions'}
                    >
                      {expanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Redemption log */}
                {expanded && (
                  <RedemptionLog
                    orgId={orgId!}
                    tokenId={t.id}
                    authToken={token}
                    badgeImageUrl={badge?.imageURL ?? null}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <Link to={`/orgs/${orgId}`} className="nav-link text-sm">
          ← Back to organisation
        </Link>
      </div>
    </Layout>
  );
}
