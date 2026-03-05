import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.tsx';
import { api, ApiError, type BadgeTemplate, type CreateBadgeInput } from '../api/client.ts';
import Layout from '../components/Layout.tsx';

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

  const [form, setForm] = useState<CreateBadgeInput>({
    text_condition: '',
    text_awarded: '',
    imageURL: '',
    category: [],
    points: undefined,
    visible_for_users: true,
    badge_type: 'normal',
  });
  const [categoryInput, setCategoryInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing?.badge) {
      const b = existing.badge;
      setForm({
        text_condition: b.text_condition,
        text_awarded: b.text_awarded,
        imageURL: b.imageURL ?? '',
        category: b.category,
        points: b.points ?? undefined,
        visible_for_users: b.visible_for_users,
        badge_type: b.badge_type,
      });
      setCategoryInput(b.category.join(', '));
    }
  }, [existing]);

  function field(key: keyof CreateBadgeInput, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload: CreateBadgeInput = {
      ...form,
      imageURL: form.imageURL || undefined,
      category: categoryInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

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

  return (
    <Layout
      back={{ to: `/orgs/${orgId}`, label: 'Badges' }}
      title={isEdit ? 'Edit Badge' : 'New Badge'}
    >
      <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? 'Edit Badge' : 'New Badge'}</h1>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <Field label="Condition (name)" required>
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

        <Field label="Image URL">
          <input
            className={input}
            value={form.imageURL}
            onChange={(e) => field('imageURL', e.target.value)}
            placeholder="https://…"
            type="url"
          />
        </Field>

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
            onChange={(e) => field('badge_type', e.target.value as CreateBadgeInput['badge_type'])}
          >
            <option value="normal">Normal</option>
            <option value="tiered">Tiered</option>
            <option value="collection">Collection</option>
          </select>
        </Field>

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
            disabled={saving}
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
