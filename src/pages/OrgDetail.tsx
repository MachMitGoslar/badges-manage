import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';
import { api, ApiError, type Organisation, type BadgeTemplate } from '../api/client.ts';
import Layout from '../components/Layout.tsx';

export default function OrgDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const { token, isMember } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isMember(orgId ?? '');

  const { data: orgData, isLoading: orgLoading } = useQuery({
    queryKey: ['org', orgId],
    queryFn: () => api.get<{ organisation: Organisation }>(`/api/v1/orgs/${orgId}`, token),
  });

  const { data: badgesData, isLoading: badgesLoading } = useQuery({
    queryKey: ['org-badges', orgId],
    queryFn: () => api.get<{ badges: BadgeTemplate[] }>(`/api/v1/orgs/${orgId}/badges`, token),
  });

  async function deleteBadge(badgeId: string, name: string) {
    if (!confirm(`Delete badge "${name}"? This will fail if any badges have been earned.`)) return;
    try {
      await api.delete(`/api/v1/orgs/${orgId}/badges/${badgeId}`, token);
      queryClient.invalidateQueries({ queryKey: ['org-badges', orgId] });
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed to delete badge');
    }
  }

  const org = orgData?.organisation;

  return (
    <Layout back={{ to: '/', label: 'Organisations' }} title={org?.name ?? orgId}>
      {orgLoading && <p className="text-[--color-dp-700]">Loading…</p>}

      {org && (
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-4">
            {org.logoFileUrl && (
              <img src={org.logoFileUrl} alt="" className="w-16 h-16 rounded-lg object-cover bg-[--color-dp-200] shrink-0" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-[--color-dp-1400]">{org.name}</h1>
              {org.city && <p className="text-[--color-dp-800] text-sm">{[org.street, org.number, org.postcode, org.city].filter(Boolean).join(' ')}</p>}
              {org.description && <p className="text-[--color-dp-800] text-sm mt-1">{org.description}</p>}
            </div>
          </div>
          {canManage && (
            <div className="flex gap-3">
              <Link
                to={`/orgs/${orgId}/tokens`}
                className="btn btn-secondary btn-rounded"
              >
                Grant Tokens
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[--color-dp-1400]">Badge Templates</h2>
        {canManage && (
          <Link
            to={`/orgs/${orgId}/badges/new`}
            className="btn btn-primary"
          >
            + New Badge
          </Link>
        )}
      </div>

      {badgesLoading && <p className="text-[--color-dp-700]">Loading badges…</p>}

      {badgesData && (
        <div className="grid gap-3">
          {badgesData.badges.length === 0 && (
            <p className="text-[--color-dp-700]">No badges yet for this organisation.</p>
          )}
          {badgesData.badges.map((badge) => (
            <div
              key={badge.id}
              className="card px-5 py-4 flex items-center gap-4"
            >
              {badge.imageURL ? (
                <img src={badge.imageURL} alt="" className="w-12 h-12 rounded object-cover bg-[--color-dp-200] shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded bg-[--color-dp-200] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-[--color-dp-1400] truncate">{badge.name}</p>
                  {!badge.visible_for_users && (
                    <span className="badge badge-warning shrink-0">hidden</span>
                  )}
                </div>
                <p className="text-xs text-[--color-dp-800] truncate">{badge.text_condition}</p>
                <p className="text-xs text-[--color-dp-700] truncate">{badge.text_awarded}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className="badge badge-secondary">{badge.badge_type}</span>
                  {badge.points != null && (
                    <span className="badge badge-secondary">{badge.points} pts</span>
                  )}
                  {badge.category.map((c) => (
                    <span key={c} className="badge badge-secondary">{c}</span>
                  ))}
                </div>
              </div>
              {canManage && (
                <div className="flex gap-2 shrink-0">
                  <Link
                    to={`/orgs/${orgId}/badges/${badge.id}`}
                    className="btn btn-sm btn-secondary btn-rounded"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => deleteBadge(badge.id, badge.name)}
                    className="btn btn-sm btn-destructive btn-rounded"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
