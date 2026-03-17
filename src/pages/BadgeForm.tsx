import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext.tsx';
import { api, ApiError, type BadgeTemplate, type CreateBadgeInput, type FrameTemplateInfo } from '../api/client.ts';
import Layout from '../components/Layout.tsx';
import CenterpieceSelector from '../components/CenterpieceSelector.tsx';
import FramePreview from '../components/FramePreview.tsx';

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
  normal:     'text-[--color-info-1000]',
  tiered:     'text-[--color-mango-900]',
  collection: 'text-purple-700',
};

// Stage labels and colours for tiered tiers (3 stages × 4 levels = 12 max)
const STAGE_NAMES = ['Bronze', 'Silver', 'Gold'];
const STAGE_COLORS = ['text-yellow-700', 'text-[--color-dp-600]', 'text-[--color-mango-900]'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function BadgeForm() {
  const { orgId, badgeId } = useParams<{ orgId: string; badgeId?: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  const { data: frameTemplatesData } = useQuery({
    queryKey: ['frame-templates'],
    queryFn: () => api.get<{ templates: FrameTemplateInfo[] }>('/api/v1/badges/frame-templates', token),
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
  const [frameTier, setFrameTier] = useState<number | null>(null);
  const [frameLevel, setFrameLevel] = useState<number | null>(null);
  const [categoryInput, setCategoryInput] = useState('');
  const [frameTemplateId, setFrameTemplateId] = useState<string>('default');
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
    setFrameTier(b.frame_tier ?? null);
    setFrameLevel(b.frame_level ?? null);
    if (b.badge_type === 'tiered' && b.tiers?.length) {
      setTiers(b.tiers.map((t) => ({
        amount: t.amount,
        imageURL: t.imageURL ?? '',
        name: t.name ?? '',
        text_awarded: (t.text_awarded_template ?? t.text_awarded) ?? '',
      })));
    }
    setFrameTemplateId(b.frame_template_id ?? 'default');
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
    setFrameTier(null);
    setFrameLevel(null);
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
      frame_tier: frameTier ?? null,
      frame_level: frameLevel ?? null,
      frame_template_id: frameTemplateId || null,
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
        queryClient.invalidateQueries({ queryKey: ['badge', orgId, badgeId] });
        toast.success('Badge updated');
      } else {
        await api.post(`/api/v1/orgs/${orgId}/badges`, token, payload);
        toast.success('Badge created');
      }
      queryClient.invalidateQueries({ queryKey: ['badges', orgId] });
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
        <h1 className="text-2xl font-bold text-[--color-dp-1400] mb-2">New Badge</h1>
        <p className="text-[--color-dp-800] text-sm mb-8">Choose the type of badge you want to create.</p>

        <div className="max-w-lg space-y-3">
          {(Object.keys(TYPE_META) as BadgeType[]).map((type) => {
            const { label, description, Icon } = TYPE_META[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => selectType(type)}
                className="w-full card px-5 py-4 flex items-center gap-4 text-left group cursor-pointer"
              >
                <div className={`shrink-0 ${TYPE_COLORS[type]}`}>
                  <Icon className="w-8 h-8" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[--color-dp-1400]">{label}</p>
                  <p className="text-sm text-[--color-dp-800] mt-0.5">{description}</p>
                </div>
                <span className="text-[--color-dp-400] group-hover:text-[--color-dp-800] transition-colors shrink-0">→</span>
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
      <h1 className="text-2xl font-bold text-[--color-dp-1400] mb-6">{isEdit ? 'Edit Badge' : 'New Badge'}</h1>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        {error && (
          <div className="alert-error">{error}</div>
        )}

        {/* Type indicator */}
        <div className="card px-4 py-2.5 flex items-center justify-between">
          <div className={`flex items-center gap-2 ${TYPE_COLORS[selectedType]}`}>
            <TypeIcon className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium text-[--color-dp-1400]">{typeLabel}</span>
          </div>
          {!isEdit && (
            <button
              type="button"
              onClick={() => setStep('pick-type')}
              className="btn btn-sm btn-tertiary"
            >
              Change
            </button>
          )}
          {isEdit && (
            <span className="text-xs text-[--color-dp-600]">Type locked</span>
          )}
        </div>

        <Field label="Name" required>
          <input
            className="input input-sm"
            value={form.name}
            onChange={(e) => field('name', e.target.value)}
            placeholder="e.g. First Hackathon"
            required
          />
        </Field>

        <Field label="Condition" required>
          <input
            className="input input-sm"
            value={form.text_condition}
            onChange={(e) => field('text_condition', e.target.value)}
            placeholder="e.g. Attended first hackathon"
            required
          />
        </Field>

        {selectedType !== 'tiered' && (
          <Field label="Awarded text">
            <input
              className="input input-sm"
              value={form.text_awarded}
              onChange={(e) => field('text_awarded', e.target.value)}
              placeholder="e.g. Congratulations on attending!"
            />
          </Field>
        )}

        {/* Centerpiece — shared across all tiers for tiered badges */}
        <div>
          <label className="label">
            Centerpiece image
            {selectedType === 'tiered' && (
              <span className="text-[--color-dp-600] font-normal ml-2">· shared across all stages</span>
            )}
          </label>
          <div className="flex items-start gap-4">
            <CenterpieceSelector orgId={orgId!} value={centerpieceUrl} onChange={setCenterpieceUrl} />
            {centerpieceUrl && (
              selectedType === 'tiered' ? (
                <FramePreview centerpieceUrl={centerpieceUrl} tier={1} level={1} className="w-20 h-20" />
              ) : frameTier && frameLevel ? (
                <FramePreview centerpieceUrl={centerpieceUrl} tier={frameTier as 1|2|3} level={frameLevel as 1|2|3|4} className="w-20 h-20" />
              ) : (
                <img src={centerpieceUrl} alt="" className="w-20 h-20 rounded-lg object-contain bg-[--color-dp-100]" />
              )
            )}
          </div>
        </div>

        {/* ── Frame picker — normal & collection badges ──────────────────────── */}
        {(selectedType === 'normal' || selectedType === 'collection') && (
          <div>
            <label className="label mb-2">Badge frame</label>
            <div className="space-y-3">
              {/* Plain / no frame */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setFrameTier(null); setFrameLevel(null); }}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-colors ${frameTier === null ? 'border-[--color-mango-900] bg-[--color-mango-100]' : 'border-[--color-border] hover:border-[--color-dp-400]'}`}
                >
                  {centerpieceUrl ? (
                    <img src={centerpieceUrl} alt="" className="w-12 h-12 rounded-lg object-contain bg-[--color-dp-100]" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[--color-dp-200] border border-[--color-border] flex items-center justify-center text-[--color-dp-600] text-xs">—</div>
                  )}
                  <span className="text-[10px] text-[--color-dp-700]">Plain</span>
                </button>
              </div>

              {/* 3 stages × 4 levels */}
              {STAGE_NAMES.map((stageName, stageIdx) => (
                <div key={stageIdx}>
                  <p className={`text-xs font-medium mb-1.5 ${STAGE_COLORS[stageIdx]}`}>{stageName} Stage</p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4].map((lvl) => {
                      const tier = stageIdx + 1;
                      const selected = frameTier === tier && frameLevel === lvl;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => { setFrameTier(tier); setFrameLevel(lvl); }}
                          className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-colors ${selected ? 'border-[--color-mango-900] bg-[--color-mango-100]' : 'border-[--color-border] hover:border-[--color-dp-400]'}`}
                        >
                          {centerpieceUrl ? (
                            <FramePreview centerpieceUrl={centerpieceUrl} tier={tier as 1|2|3} level={lvl as 1|2|3|4} className="w-12 h-12" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-[--color-dp-200] border border-[--color-border]" />
                          )}
                          <span className="text-[10px] text-[--color-dp-700]">L{lvl}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {frameTier && (
              <p className="text-xs text-[--color-dp-600] mt-2">
                Selected: {STAGE_NAMES[frameTier - 1]} Stage · Level {frameLevel} — badge will be rendered on save
              </p>
            )}
          </div>
        )}

        <Field label="Categories (comma-separated)">
          <input
            className="input input-sm"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            placeholder="e.g. event, achievement"
          />
        </Field>

        <Field label="Points">
          <input
            className="input input-sm"
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
            {/* Frame template selector */}
            {(frameTemplatesData?.templates?.length ?? 0) > 1 && (
              <Field label="Badge template">
                <select
                  className="input input-sm"
                  value={frameTemplateId}
                  onChange={(e) => setFrameTemplateId(e.target.value)}
                >
                  {frameTemplatesData!.templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {frameTemplatesData?.templates.find((t) => t.id === frameTemplateId)?.description && (
                  <p className="text-xs text-[--color-dp-600] mt-1">
                    {frameTemplatesData!.templates.find((t) => t.id === frameTemplateId)!.description}
                  </p>
                )}
              </Field>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-[--color-dp-800]">Stages &amp; levels</span>
              {tiers.length < 12 && (
                <button
                  type="button"
                  onClick={addTier}
                  className="btn btn-sm btn-tertiary"
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
                <div key={i} className="card p-4 space-y-3">
                  {/* Row header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[--color-dp-1200]">
                      <span className={stageColor}>{stageName} Stage</span>
                      <span className="text-[--color-dp-600] ml-1.5">· Level {level}</span>
                    </span>
                    {tiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTier(i)}
                        className="text-xs text-[--color-ferocious-800] hover:underline transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Stage name + awarded text */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[--color-dp-700] mb-1">Stage name</label>
                      <input
                        className="input input-sm"
                        value={tier.name}
                        onChange={(e) => updateTierField(i, 'name', e.target.value)}
                        placeholder={`e.g. ${stageName} Champion`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[--color-dp-700] mb-1">Awarded text</label>
                      <input
                        className="input input-sm"
                        value={tier.text_awarded}
                        onChange={(e) => updateTierField(i, 'text_awarded', e.target.value)}
                        placeholder={`e.g. You reached {amount} steps!`}
                      />
                      <p className="text-[10px] text-[--color-dp-500] mt-0.5">
                        Use <code className="bg-[--color-dp-100] px-0.5 rounded font-mono">{'{amount}'}</code> to embed the milestone number.
                      </p>
                      {tier.text_awarded.includes('{amount}') && (
                        <p className="text-[10px] text-[--color-dp-700] mt-0.5">
                          Preview: {tier.text_awarded.replace(/\{amount\}/g, String(tier.amount))}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Amount + preview */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-[--color-dp-700] mb-1">Milestone amount</label>
                      <input
                        className={`input input-sm ${tierErrors[i] ? 'input-error' : ''}`}
                        type="number"
                        min="1"
                        required
                        value={tier.amount}
                        onChange={(e) => updateTierAmount(i, Number(e.target.value))}
                      />
                      {tierErrors[i] ? (
                        <p className="field-error">{tierErrors[i]}</p>
                      ) : i > 0 ? (
                        <p className="text-xs text-[--color-dp-600] mt-1">Must exceed tier {i} ({tiers[i - 1].amount})</p>
                      ) : null}
                    </div>

                    {/* Preview: server-rendered frame for this exact stage/level */}
                    {centerpieceUrl && (
                      <div className="shrink-0">
                        <label className="block text-xs text-[--color-dp-700] mb-1">Preview</label>
                        <FramePreview
                          centerpieceUrl={centerpieceUrl}
                          tier={(stageIndex + 1) as 1|2|3}
                          level={level as 1|2|3|4}
                          milestone={tier.amount}
                          templateId={frameTemplateId || undefined}
                          className="w-16 h-16"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {!centerpieceUrl && (
              <p className="text-xs text-[--color-dp-600]">Select a centerpiece above to preview each stage.</p>
            )}
          </div>
        )}

        {/* ── Collection: badge picker ─────────────────────────────────────────── */}
        {selectedType === 'collection' && (
          <div className="space-y-2">
            <span className="label">Required badges</span>
            {availableBadges.length === 0 ? (
              <p className="text-xs text-[--color-dp-700]">No other badges in this organisation yet.</p>
            ) : (
              <div className="bg-white border border-[--color-border] rounded-lg divide-y divide-[--color-dp-200] max-h-56 overflow-y-auto">
                {availableBadges.map((b) => (
                  <label key={b.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[--color-dp-25] transition-colors">
                    <input
                      type="checkbox"
                      checked={requiredBadgeIds.includes(b.id)}
                      onChange={() => toggleBadge(b.id)}
                      className="checkbox shrink-0"
                    />
                    {b.imageURL && (
                      <img src={b.imageURL} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                    )}
                    <span className="text-sm text-[--color-dp-1400] truncate">{b.name}</span>
                  </label>
                ))}
              </div>
            )}
            {requiredBadgeIds.length > 0 && (
              <p className="text-xs text-[--color-dp-700]">{requiredBadgeIds.length} badge{requiredBadgeIds.length !== 1 ? 's' : ''} selected</p>
            )}
          </div>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.visible_for_users}
            onChange={(e) => field('visible_for_users', e.target.checked)}
            className="checkbox"
          />
          <span className="text-sm text-[--color-dp-1200]">Visible to users</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitDisabled}
            className="btn btn-primary btn-rounded"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create badge'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/orgs/${orgId}`)}
            className="btn btn-secondary btn-rounded"
          >
            Cancel
          </button>
        </div>
      </form>
    </Layout>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="label">
        {label}{required && <span className="text-[--color-ferocious-800] ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
