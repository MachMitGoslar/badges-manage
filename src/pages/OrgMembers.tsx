import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext.tsx';
import { api, ApiError, type OrgMember } from '../api/client.ts';
import Layout from '../components/Layout.tsx';

const ROLE_LABELS: Record<OrgMember['role'], string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

const ROLE_BADGE: Record<OrgMember['role'], string> = {
  owner: 'badge-warning',
  admin: 'badge-primary',
  member: 'badge-secondary',
};

export default function OrgMembers() {
  const { orgId } = useParams<{ orgId: string }>();
  const { token, isOwner } = useAuth();
  const queryClient = useQueryClient();
  const canManageRoles = isOwner(orgId ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => api.get<{ members: OrgMember[] }>(`/api/v1/orgs/${orgId}/members`, token),
  });

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  async function handleRoleChange(userId: string, role: OrgMember['role']) {
    setUpdatingUserId(userId);
    try {
      await api.patch(`/api/v1/orgs/${orgId}/members/${userId}`, token, { role });
      queryClient.invalidateQueries({ queryKey: ['org-members', orgId] });
      toast.success('Role updated');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to update role');
    } finally {
      setUpdatingUserId(null);
    }
  }

  const members = data?.members ?? [];

  return (
    <Layout back={{ to: `/orgs/${orgId}`, label: 'Organisation' }} title="Members">
      <h1 className="text-2xl font-bold text-[--color-dp-1400] mb-6">Members</h1>

      {isLoading && <p className="text-[--color-dp-700]">Loading…</p>}

      {data && (
        <div className="space-y-2">
          {members.length === 0 && (
            <p className="text-[--color-dp-700]">No members found.</p>
          )}
          {members.map((m) => (
            <div key={m.user_id} className="card px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[--color-dp-1400] truncate">
                  {m.name ?? <span className="text-[--color-dp-600] font-normal italic">Unknown</span>}
                </p>
                {m.email && (
                  <p className="text-xs text-[--color-dp-700] truncate">{m.email}</p>
                )}
                <p className="text-xs text-[--color-dp-500] font-mono mt-0.5">{m.user_id}</p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                {canManageRoles ? (
                  <select
                    className="input input-sm"
                    value={m.role}
                    disabled={updatingUserId === m.user_id}
                    onChange={(e) => handleRoleChange(m.user_id, e.target.value as OrgMember['role'])}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                ) : (
                  <span className={`badge ${ROLE_BADGE[m.role]}`}>{ROLE_LABELS[m.role]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
