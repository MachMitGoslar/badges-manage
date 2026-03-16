import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.tsx';
import { api, ApiError, type BadgeTemplate, type CreateBadgeInput } from '../api/client.ts';
import Layout from '../components/Layout.tsx';
import CenterpieceSelector from '../components/CenterpieceSelector.tsx';
import BadgePreview from '../components/BadgePreview.tsx';

type BadgeType = 'normal' | 'tiered' | 'collection';
type TierRow = { amount: number; imageURL: string; name: string; text_awarded: string };
type Step = 'pick-type' | 'fill';

// ── Icon renderers (accept a className so size is controlled at the call site) ─

function NormalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="12" cy="13" r="7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4h6l-1.5 6h-3L9 4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v3l2 2" />
    </svg>
  );
}

function TieredIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="2" y="17" width="5" height="5" rx="1" />
      <rect x="9.5" y="11" width="5" height="11" rx="1" />
      <rect x="17" y="5" width="5" height="17" rx="1" />
    </svg>
  );
}

function CollectionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="2" y="2" width="9" height="9" rx="1.5" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" />
      <rect x="13" y="13" width="9" height="9" rx="1.5" />
    </svg>
  );
}

// ── Type picker metadata ──────────────────────────────────────────────────────

type IconComponent = React.ComponentType<{ className?: string }>;

const TYPE_META: Record<BadgeType, { label: string; description: string; Icon: IconComponent }> = {
  normal: {
    label: 'Normal Badge',
    description: 'A single-achievement badge, awarded once when a user meets the condition.',
    Icon: NormalIcon,
  },
  tiered: {
    label: 'Tiered Badge',
    description: 'Progressive Bronze → Silver → Gold stages. Users advance by hitting milestone amounts.',
    Icon: TieredIcon,
  },
  collection: {
    label: 'Collection Badge',
    description: 'Awarded automatically once a user has collected a specific set of other badges.',
    Icon: CollectionIcon,
  },
};

const TYPE_COLORS: Record<BadgeType, string> = {
  normal:     'text-blue-400',
  tiered:     'text-yellow-400',
  collection: 'text-purple-400',
};

// Stage labels and colours for tiered tiers (3 stages × 4 levels = 12 max)
const STAGE_NAMES = ['Bronze', 'Silver', 'Gold'];
const STAGE_COLORS = ['text-yellow-700', 'text-gray-400', 'text-yellow-400'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function BadgeForm() {
  const { orgId, badgeId } = useParams<{ orgId: string; badgeId?: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const isEdit = !!badgeId;

  const [step, setStep] = useState<Step>(isEdit ? 'fill' : 'pick-type');

  const { data: existing } = useQuery({
    queryKey: ['badge', orgId, badgeId],
    queryFn: () => api.get<{ badge: BadgeTemplate }>(`/api/v1/orgs/${orgId}/badges/${badgeId}`, token),
    enabled: isEdit,
  });

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
  const [tiers, setTiers] = useState<TierRow[]>([{ amount: 5, imageURL: '', name: '', text_awarded: '' }]);
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
      setTiers(b.tiers.map((t) => ({
        amount: t.amount,
        imageURL: t.imageURL ?? '',
        name: t.name ?? '',
        text_awarded: t.text_awarded ?? '',
      })));
    }
    if (b.badge_type === 'collection' && b.collection_badges?.length) {
      setRequiredBadgeIds(b.collection_badges.map((cb) => cb.id));
    }
  }, [existing]);

  function field(key: keyof typeof form, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectType(type: BadgeType) {
    field('badge_type', type);
    setTiers([{ amount: 5, imageURL: '', name: '', text_awarded: '' }]);
    setRequiredBadgeIds([]);
    setStep('fill');
  }

  // ── Tier helpers ─────────────────────────────────────────────────────────────

  function addTier() {
    setTiers((prev) => {
      const last = prev[prev.length - 1].amount;
      return [...prev, { amount: last + 1, imageURL: '', name: '', text_awarded: '' }];
    });
  }

  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateTierAmount(i: number, value: number) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, amount: value } : t)));
  }

  function updateTierField(i: number, key: 'name' | 'text_awarded', value: string) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));
  }

  // Per-tier validation: each amount must be strictly greater than the previous
  const tierErrors: string[] = tiers.map((t, i) => {
    const prevAmount = i > 0 ? tiers[i - 1].amount : 0;
    if (t.amount <= prevAmount) {
      return i > 0
        ? `Must be greater than ${STAGE_NAMES[Math.floor((i - 1) / 4)]} Level ${((i - 1) % 4) + 1} (${prevAmount})`
        : 'Must be greater than 0';
    }
    return '';
  });
  const hasTierError = tierErrors.some(Boolean);

  // ── Collection helpers ────────────────────────────────────────────────────────

  function toggleBadge(id: string) {
    setRequiredBadgeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

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
      ? {
          ...base,
          tiers: tiers.map((t, i) => ({
            level: i + 1,
            amount: t.amount,
            imageURL: t.imageURL || undefined,
            name: t.name || null,
            text_awarded: t.text_awarded || null,
          })),
        }
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
  const submitDisabled =
    saving ||
    (form.badge_type === 'collection' && requiredBadgeIds.length === 0) ||
    (form.badge_type === 'tiered' && hasTierError);

  // ── Type picker step ──────────────────────────────────────────────────────────

  if (step === 'pick-type') {
    return (
      <Layout back={{ to: `/orgs/${orgId}`, label: 'Badges' }} title="New Badge">
        <h1 className="text-2xl font-bold text-white mb-2">New Badge</h1>
        <p className="text-gray-400 text-sm mb-8">Choose the type of badge you want to create.</p>

        <div className="max-w-lg space-y-3">
          {(Object.keys(TYPE_META) as BadgeType[]).map((type) => {
            const { label, description, Icon } = TYPE_META[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => selectType(type)}
                className="w-full bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl px-5 py-4 flex items-center gap-4 text-left transition-colors group"
              >
                <div className={`shrink-0 ${TYPE_COLORS[type]}`}>
                  <Icon className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white">{label}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{description}</p>
                </div>
                <span className="text-gray-600 group-hover:text-gray-400 transition-colors shrink-0">→</span>
              </button>
            );
          })}
        </div>
      </Layout>
    );
  }

  // ── Form step ─────────────────────────────────────────────────────────────────

  const selectedType = form.badge_type as BadgeType;
  const { label: typeLabel, Icon: TypeIcon } = TYPE_META[selectedType];

  return (
    <Layout back={{ to: `/orgs/${orgId}`, label: 'Badges' }} title={isEdit ? 'Edit Badge' : 'New Badge'}>
      <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? 'Edit Badge' : 'New Badge'}</h1>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Type indicator */}
        <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5">
          <div className={`flex items-center gap-2 ${TYPE_COLORS[selectedType]}`}>
            <TypeIcon className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium text-white">{typeLabel}</span>
          </div>
          {!isEdit && (
            <button
              type="button"
              onClick={() => setStep('pick-type')}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Change
            </button>
          )}
          {isEdit && (
            <span className="text-xs text-gray-600">Type locked</span>
          )}
        </div>

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

        {/* Centerpiece — shared across all tiers for tiered badges */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">
            Centerpiece image
            {selectedType === 'tiered' && (
              <span className="text-gray-600 font-normal ml-2">· shared across all stages</span>
            )}
          </label>
          <div className="flex items-start gap-4">
            <CenterpieceSelector orgId={orgId!} value={centerpieceUrl} onChange={setCenterpieceUrl} />
            {centerpieceUrl && (
              <BadgePreview
                centerpieceUrl={centerpieceUrl}
                badgeType={selectedType}
                tierLevel={1}
                className="w-20 h-20"
                title="Badge preview"
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

        {/* ── Tiered: tier/stage configuration ────────────────────────────────── */}
        {selectedType === 'tiered' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Stages &amp; levels</span>
              {tiers.length < 12 && (
                <button
                  type="button"
                  onClick={addTier}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  + Add level
                </button>
              )}
            </div>

            {tiers.map((tier, i) => {
              const stageIndex = Math.floor(i / 4);
              const level = (i % 4) + 1;
              const stageName = STAGE_NAMES[stageIndex] ?? 'Gold';
              const stageColor = STAGE_COLORS[stageIndex] ?? STAGE_COLORS[2];

              return (
                <div key={i} className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
                  {/* Row header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-300">
                      <span className={stageColor}>{stageName} Stage</span>
                      <span className="text-gray-500 ml-1.5">· Level {level}</span>
                    </span>
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

                  {/* Stage name + awarded text */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Stage name</label>
                      <input
                        className={input}
                        value={tier.name}
                        onChange={(e) => updateTierField(i, 'name', e.target.value)}
                        placeholder={`e.g. ${stageName} Champion`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Awarded text</label>
                      <input
                        className={input}
                        value={tier.text_awarded}
                        onChange={(e) => updateTierField(i, 'text_awarded', e.target.value)}
                        placeholder="Shown when this tier is reached"
                      />
                    </div>
                  </div>

                  {/* Amount + preview */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Milestone amount</label>
                      <input
                        className={`${input} ${tierErrors[i] ? 'border-red-600 focus:border-red-500' : ''}`}
                        type="number"
                        min="1"
                        required
                        value={tier.amount}
                        onChange={(e) => updateTierAmount(i, Number(e.target.value))}
                      />
                      {tierErrors[i] ? (
                        <p className="text-xs text-red-400 mt-1">{tierErrors[i]}</p>
                      ) : i > 0 ? (
                        <p className="text-xs text-gray-600 mt-1">prev: {tiers[i - 1].amount}</p>
                      ) : null}
                    </div>

                    {/* Preview: uses shared centerpieceUrl with this tier's level */}
                    {centerpieceUrl && (
                      <div className="shrink-0">
                        <label className="block text-xs text-gray-500 mb-1">Preview</label>
                        <BadgePreview
                          centerpieceUrl={centerpieceUrl}
                          badgeType="tiered"
                          tierLevel={i + 1}
                          className="w-16 h-16"
                          title={`${stageName} Stage Level ${level}`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {!centerpieceUrl && (
              <p className="text-xs text-gray-600">Select a centerpiece above to preview each stage.</p>
            )}
          </div>
        )}

        {/* ── Collection: badge picker ─────────────────────────────────────────── */}
        {selectedType === 'collection' && (
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
            disabled={submitDisabled}
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
