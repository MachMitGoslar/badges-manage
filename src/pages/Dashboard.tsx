import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';
import { api, type Organisation } from '../api/client.ts';
import Layout from '../components/Layout.tsx';

function OrgCard({ org, isMyOrg }: { org: Organisation; isMyOrg: boolean }) {
  return (
    <Link
      to={`/orgs/${org.id}`}
      className="card px-5 py-4 flex items-center justify-between group"
    >
      <div className="flex items-center gap-4">
        {org.logoFileUrl ? (
          <img src={org.logoFileUrl} alt="" className="w-10 h-10 rounded object-cover bg-[--color-dp-200] shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded bg-[--color-dp-200] flex items-center justify-center text-[--color-dp-700] text-lg font-bold shrink-0">
            {(org.name ?? '?')[0]}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-[--color-dp-1400]">
              {org.name ?? <span className="text-[--color-dp-600] italic">Unnamed</span>}
            </p>
            {isMyOrg && (
              <span className="badge badge-primary">your org</span>
            )}
          </div>
          {org.city && <p className="text-xs text-[--color-dp-700]">{org.city}</p>}
        </div>
      </div>
      <span className="text-[--color-dp-400] group-hover:text-[--color-dp-800] text-sm transition-colors">→</span>
    </Link>
  );
}

export default function Dashboard() {
  const { token } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['orgs'],
    queryFn: () => api.get<{ organisations: Organisation[]; my_org_ids: string[] }>('/api/v1/orgs', token),
  });

  const myOrgIds = new Set(data?.my_org_ids ?? []);
  const myOrgs = (data?.organisations ?? []).filter((o) => myOrgIds.has(o.id));
  const otherOrgs = (data?.organisations ?? []).filter((o) => !myOrgIds.has(o.id));

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-[--color-dp-1400] mb-6">Organisations</h1>

      {isLoading && <p className="text-[--color-dp-700]">Loading…</p>}
      {error && <p className="text-[--color-ferocious-800]">Failed to load organisations.</p>}

      {data && (
        <div className="space-y-8">
          {myOrgs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider mb-3">My Organisations</h2>
              <div className="grid gap-3">
                {myOrgs.map((org) => <OrgCard key={org.id} org={org} isMyOrg />)}
              </div>
            </section>
          )}

          {otherOrgs.length > 0 && (
            <section>
              {myOrgs.length > 0 && (
                <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider mb-3">Other Organisations</h2>
              )}
              <div className="grid gap-3">
                {otherOrgs.map((org) => <OrgCard key={org.id} org={org} isMyOrg={false} />)}
              </div>
            </section>
          )}

          {data.organisations.length === 0 && (
            <p className="text-[--color-dp-700]">No organisations found.</p>
          )}
        </div>
      )}
    </Layout>
  );
}
