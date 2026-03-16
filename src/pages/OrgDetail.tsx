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
      {orgLoading && <p className="text-gray-400">Loading…</p>}

      {org && (
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-4">
            {org.logoFileUrl && (
              <img src={org.logoFileUrl} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-800" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{org.name}</h1>
              {org.city && <p className="text-gray-400 text-sm">{[org.street, org.number, org.postcode, org.city].filter(Boolean).join(' ')}</p>}
              {org.description && <p className="text-gray-400 text-sm mt-1">{org.description}</p>}
            </div>
          </div>
          {canManage && (
            <div className="flex gap-3">
              <Link
                to={`/orgs/${orgId}/tokens`}
                className="bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 px-4 py-2 rounded-lg transition-colors"
              >
                Grant Tokens
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Badge Templates</h2>
        {canManage && (
          <Link
            to={`/orgs/${orgId}/badges/new`}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New Badge
          </Link>
        )}
      </div>

      {badgesLoading && <p className="text-gray-400">Loading badges…</p>}

      {badgesData && (
        <div className="grid gap-3">
          {badgesData.badges.length === 0 && (
            <p className="text-gray-500">No badges yet for this organisation.</p>
          )}
          {badgesData.badges.map((badge) => (
            <div
              key={badge.id}
              className="bg-gray-900 border border-gray-800 rounded-lg px-5 py-4 flex items-center gap-4"
            >
              {badge.imageURL ? (
                <img src={badge.imageURL} alt="" className="w-12 h-12 rounded object-cover bg-gray-800 shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded bg-gray-800 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium text-white truncate">{badge.name}</p>
                  {!badge.visible_for_users && (
                    <span className="text-xs bg-yellow-900 text-yellow-300 px-1.5 py-0.5 rounded shrink-0">hidden</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{badge.text_condition}</p>
                <p className="text-xs text-gray-500 truncate">{badge.text_awarded}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{badge.badge_type}</span>
                  {badge.points != null && (
                    <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{badge.points} pts</span>
                  )}
                  {badge.category.map((c) => (
                    <span key={c} className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              </div>
              {canManage && (
                <div className="flex gap-2 shrink-0">
                  <Link
                    to={`/orgs/${orgId}/badges/${badge.id}`}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition-colors"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => deleteBadge(badge.id, badge.name)}
                    className="text-xs bg-red-950 hover:bg-red-900 text-red-400 px-3 py-1.5 rounded transition-colors"
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
