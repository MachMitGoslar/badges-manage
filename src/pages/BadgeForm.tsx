import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.tsx';
import { api, ApiError, type BadgeTemplate, type CreateBadgeInput, buildBadgePreviewUrl } from '../api/client.ts';
import Layout from '../components/Layout.tsx';
import CenterpieceSelector from '../components/CenterpieceSelector.tsx';

type BadgeType = 'normal' | 'tiered' | 'collection';
type TierRow = { amount: number; imageURL: string };

export default function BadgeForm() {
  const { orgId, badgeId } = useParams<{ orgId: string; badgeId?: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const isEdit = !!badgeId;

  const { data: existing } = useQuery({
    queryKey: ['badge', orgId, badgeId],
    queryFn: () => api.get<{ badge: BadgeTemplate }>(`/api/v1/orgs/${orgId}/badges/${badgeId}`, token),
    enabled: isEdit,
  });

  // Fetch org badges for collection picker
  const { data: orgBadges } = useQuery({
    queryKey: ['badges', orgId],
    queryFn: () => api.get<{ badges: BadgeTemplate[] }>(`/api/v1/orgs/${orgId}/badges`, token),
  });

  const [form, setForm] = useState<Omit<CreateBadgeInput, 'tiers' | 'required_badge_ids'>>({
    name: '',
    text_condition: '',
    text_awarded: '',
    imageURL: '',
    category: [],
    points: undefined,
    visible_for_users: true,
    badge_type: 'normal',
  });
  const [centerpieceUrl, setCenterpieceUrl] = useState<string | null>(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [tiers, setTiers] = useState<TierRow[]>([{ amount: 1, imageURL: '' }]);
  const [requiredBadgeIds, setRequiredBadgeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existing?.badge) return;
    const b = existing.badge;
    setForm({
      name: b.name,
      text_condition: b.text_condition,
      text_awarded: b.text_awarded,
      imageURL: b.imageURL ?? '',
      category: b.category,
      points: b.points ?? undefined,
      visible_for_users: b.visible_for_users,
      badge_type: b.badge_type,
    });
    setCategoryInput(b.category.join(', '));
    setCenterpieceUrl(b.centerpiece_url ?? null);
    if (b.badge_type === 'tiered' && b.tiers?.length) {
      setTiers(b.tiers.map((t) => ({ amount: t.amount, imageURL: t.imageURL ?? '' })));
    }
    if (b.badge_type === 'collection' && b.collection_badges?.length) {
      setRequiredBadgeIds(b.collection_badges.map((cb) => cb.id));
    }
  }, [existing]);

  function field(key: keyof typeof form, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleTypeChange(newType: BadgeType) {
    field('badge_type', newType);
    // Reset type-specific state on type switch (create mode only)
    if (!isEdit) {
      setTiers([{ amount: 1, imageURL: '' }]);
      setRequiredBadgeIds([]);
    }
  }

  // --- Tier helpers ---
  function addTier() {
    setTiers((prev) => [...prev, { amount: prev[prev.length - 1].amount + 1, imageURL: '' }]);
  }
  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateTier(i: number, key: keyof TierRow, value: string | number) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));
  }

  // --- Collection helpers ---
  function toggleBadge(id: string) {
    setRequiredBadgeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const base = {
      ...form,
      imageURL: form.imageURL || undefined,
      centerpiece_url: centerpieceUrl ?? undefined,
      category: categoryInput.split(',').map((s) => s.trim()).filter(Boolean),
    };

    const payload: CreateBadgeInput = form.badge_type === 'tiered'
      ? { ...base, tiers: tiers.map((t, i) => ({ level: i + 1, amount: t.amount, imageURL: t.imageURL || undefined })) }
      : form.badge_type === 'collection'
      ? { ...base, required_badge_ids: requiredBadgeIds }
      : base;

    try {
      if (isEdit) {
        await api.patch(`/api/v1/orgs/${orgId}/badges/${badgeId}`, token, payload);
      } else {
        await api.post(`/api/v1/orgs/${orgId}/badges`, token, payload);
      }
      navigate(`/orgs/${orgId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save badge');
    } finally {
      setSaving(false);
    }
  }

  const availableBadges = (orgBadges?.badges ?? []).filter((b) => b.id !== badgeId);

  return (
    <Layout back={{ to: `/orgs/${orgId}`, label: 'Badges' }} title={isEdit ? 'Edit Badge' : 'New Badge'}>
      <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? 'Edit Badge' : 'New Badge'}</h1>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <Field label="Name" required>
          <input
            className={input}
            value={form.name}
            onChange={(e) => field('name', e.target.value)}
            placeholder="e.g. First Hackathon"
            required
          />
        </Field>

        <Field label="Condition" required>
          <input
            className={input}
            value={form.text_condition}
            onChange={(e) => field('text_condition', e.target.value)}
            placeholder="e.g. Attended first hackathon"
            required
          />
        </Field>

        <Field label="Awarded text">
          <input
            className={input}
            value={form.text_awarded}
            onChange={(e) => field('text_awarded', e.target.value)}
            placeholder="e.g. Congratulations on attending!"
          />
        </Field>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Centerpiece image</label>
          <div className="flex items-start gap-4">
            <CenterpieceSelector orgId={orgId!} value={centerpieceUrl} onChange={setCenterpieceUrl} />
            {centerpieceUrl && (
              <img
                src={buildBadgePreviewUrl(centerpieceUrl, form.badge_type ?? 'normal', 1)}
                alt="Badge preview"
                className="w-20 h-20 rounded-lg object-cover bg-gray-800 shrink-0"
                title="Composed badge preview"
              />
            )}
          </div>
        </div>

        <Field label="Categories (comma-separated)">
          <input
            className={input}
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            placeholder="e.g. event, achievement"
          />
        </Field>

        <Field label="Points">
          <input
            className={input}
            type="number"
            min="0"
            value={form.points ?? ''}
            onChange={(e) => field('points', e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Optional"
          />
        </Field>

        <Field label="Badge type">
          <select
            className={input}
            value={form.badge_type}
            onChange={(e) => handleTypeChange(e.target.value as BadgeType)}
            disabled={isEdit}
          >
            <option value="normal">Normal</option>
            <option value="tiered">Tiered</option>
            <option value="collection">Collection</option>
          </select>
          {isEdit && (
            <p className="text-xs text-gray-500 mt-1">Badge type cannot be changed after creation.</p>
          )}
        </Field>

        {/* Tiered: tier configuration */}
        {form.badge_type === 'tiered' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Tiers</span>
              <button
                type="button"
                onClick={addTier}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Add tier
              </button>
            </div>
            {tiers.map((tier, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Tier {i + 1}</span>
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Amount required</label>
                    <input
                      className={input}
                      type="number"
                      min="1"
                      required
                      value={tier.amount}
                      onChange={(e) => updateTier(i, 'amount', Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Image URL (optional)</label>
                    <input
                      className={input}
                      type="url"
                      placeholder="https://…"
                      value={tier.imageURL}
                      onChange={(e) => updateTier(i, 'imageURL', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Collection: badge picker */}
        {form.badge_type === 'collection' && (
          <div className="space-y-2">
            <span className="text-sm text-gray-400">Required badges</span>
            {availableBadges.length === 0 ? (
              <p className="text-xs text-gray-500">No other badges in this organisation yet.</p>
            ) : (
              <div className="bg-gray-900 border border-gray-700 rounded-lg divide-y divide-gray-800 max-h-56 overflow-y-auto">
                {availableBadges.map((b) => (
                  <label key={b.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={requiredBadgeIds.includes(b.id)}
                      onChange={() => toggleBadge(b.id)}
                      className="w-4 h-4 accent-blue-500 shrink-0"
                    />
                    {b.imageURL && (
                      <img src={b.imageURL} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                    )}
                    <span className="text-sm text-gray-200 truncate">{b.name}</span>
                  </label>
                ))}
              </div>
            )}
            {requiredBadgeIds.length > 0 && (
              <p className="text-xs text-gray-500">{requiredBadgeIds.length} badge{requiredBadgeIds.length !== 1 ? 's' : ''} selected</p>
            )}
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.visible_for_users}
            onChange={(e) => field('visible_for_users', e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-sm text-gray-300">Visible to users</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || (form.badge_type === 'collection' && requiredBadgeIds.length === 0)}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create badge'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/orgs/${orgId}`)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-5 py-2.5 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </Layout>
  );
}

const input = 'w-full bg-gray-900 border border-gray-700 focus:border-blue-500 focus:outline-none text-gray-100 text-sm px-3 py-2 rounded-lg';

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
