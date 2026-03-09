import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.tsx';
import { api, type Organisation } from '../api/client.ts';
import Layout from '../components/Layout.tsx';

function OrgCard({ org }: { org: Organisation }) {
  return (
    <Link
      to={`/orgs/${org.id}`}
      className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-lg px-5 py-4 flex items-center justify-between transition-colors group"
    >
      <div className="flex items-center gap-4">
        {org.logoFileUrl ? (
          <img src={org.logoFileUrl} alt="" className="w-10 h-10 rounded object-cover bg-gray-800" />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-800 flex items-center justify-center text-gray-600 text-lg font-bold">
            {(org.name ?? '?')[0]}
          </div>
        )}
        <div>
          <p className="font-medium text-white">{org.name ?? <span className="text-gray-500 italic">Unnamed</span>}</p>
          {org.city && <p className="text-xs text-gray-500">{org.city}</p>}
        </div>
      </div>
      <span className="text-gray-600 group-hover:text-gray-400 text-sm">→</span>
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
      <h1 className="text-2xl font-bold text-white mb-6">Organisations</h1>

      {isLoading && <p className="text-gray-400">Loading…</p>}
      {error && <p className="text-red-400">Failed to load organisations.</p>}

      {data && (
        <div className="space-y-8">
          {myOrgs.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">My Organisations</h2>
              <div className="grid gap-3">
                {myOrgs.map((org) => <OrgCard key={org.id} org={org} />)}
              </div>
            </section>
          )}

          {otherOrgs.length > 0 && (
            <section>
              {myOrgs.length > 0 && (
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Other Organisations</h2>
              )}
              <div className="grid gap-3">
                {otherOrgs.map((org) => <OrgCard key={org.id} org={org} />)}
              </div>
            </section>
          )}

          {data.organisations.length === 0 && (
            <p className="text-gray-500">No organisations found.</p>
          )}
        </div>
      )}
    </Layout>
  );
}
