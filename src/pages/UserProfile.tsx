import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext.tsx';
import {
  ApiError,
  getMe,
  getBadges,
  updateProfile,
  uploadProfileImage,
  deleteProfileImage,
  type UpdateProfileInput,
  type BadgeView,
} from '../api/client.ts';
import Layout from '../components/Layout.tsx';

export default function UserProfile() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe(token),
  });

  const { data: badgesData } = useQuery({
    queryKey: ['my-badges'],
    queryFn: () => getBadges(token),
  });

  const profile = data?.profile;

  // Form state — synced from fetched profile
  const [username, setUsername] = useState('');
  const [showName, setShowName] = useState(true);
  const [showProfileImage, setShowProfileImage] = useState(true);
  const [showBadgeList, setShowBadgeList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? '');
    setShowName(profile.show_name);
    setShowProfileImage(profile.show_profile_image);
    setShowBadgeList(profile.show_badge_list);
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const input: UpdateProfileInput = {};
    const trimmed = username.trim();
    if (trimmed !== (profile?.username ?? '')) input.username = trimmed || undefined;
    if (showName !== profile?.show_name) input.show_name = showName;
    if (showProfileImage !== profile?.show_profile_image) input.show_profile_image = showProfileImage;
    if (showBadgeList !== profile?.show_badge_list) input.show_badge_list = showBadgeList;

    if (Object.keys(input).length === 0) {
      toast('No changes to save');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(token, input);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile saved');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      await uploadProfileImage(token, file);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile image updated');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to upload image');
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleImageRemove() {
    try {
      await deleteProfileImage(token);
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile image removed');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to remove image');
    }
  }

  return (
    <Layout title="Profile">
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-[--color-dp-1400] mb-6">Profile</h1>

        {isLoading && <p className="text-[--color-dp-700]">Loading…</p>}

        {data && (
          <div className="space-y-6">
            {/* Profile image */}
            <div className="card px-5 py-4">
              <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider mb-3">Profile Image</h2>
              <div className="flex items-center gap-4">
                {profile?.profile_image_url ? (
                  <img
                    src={profile.profile_image_url}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover bg-[--color-dp-200] shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[--color-dp-200] flex items-center justify-center text-[--color-dp-700] text-xl font-bold shrink-0">
                    {(data.name ?? data.email ?? '?')[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={imageUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUploading ? 'Uploading…' : 'Upload'}
                  </button>
                  {profile?.profile_image_url && (
                    <button
                      type="button"
                      className="btn btn-destructive"
                      onClick={handleImageRemove}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            {/* Profile form */}
            <form onSubmit={handleSave} className="card px-5 py-4 space-y-5">
              <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider">Settings</h2>

              <div>
                <label className="label" htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  className="input mt-1"
                  placeholder="your-handle"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  minLength={3}
                  maxLength={50}
                  pattern="[a-zA-Z0-9_-]+"
                />
                <p className="text-xs text-[--color-dp-700] mt-1">Letters, numbers, underscores and hyphens. Used for your public profile URL.</p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={showName}
                    onChange={e => setShowName(e.target.checked)}
                  />
                  <span className="text-sm text-[--color-dp-1400]">Show my name on public profile</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={showProfileImage}
                    onChange={e => setShowProfileImage(e.target.checked)}
                  />
                  <span className="text-sm text-[--color-dp-1400]">Show my profile image publicly</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={showBadgeList}
                    onChange={e => setShowBadgeList(e.target.checked)}
                  />
                  <span className="text-sm text-[--color-dp-1400]">Make my badge list public</span>
                </label>
              </div>

              <div className="pt-1">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>

            {/* Account info (read-only) */}
            <div className="card px-5 py-4">
              <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider mb-3">Account</h2>
              <div className="space-y-1 text-sm text-[--color-dp-800]">
                {data.name && <p><span className="text-[--color-dp-600]">Name: </span>{data.name}</p>}
                {data.email && <p><span className="text-[--color-dp-600]">Email: </span>{data.email}</p>}
              </div>
            </div>

            {/* Badge list */}
            {badgesData && (
              <div className="card px-5 py-4">
                <h2 className="text-sm font-semibold text-[--color-dp-800] uppercase tracking-wider mb-3">
                  Badges · {badgesData.total_points} pts
                </h2>
                {badgesData.badges.filter((b: BadgeView) => b.earned).length === 0 ? (
                  <p className="text-[--color-dp-700] text-sm">No badges earned yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {badgesData.badges.filter((b: BadgeView) => b.earned).map((b: BadgeView) => (
                      <li key={b.template_id} className="flex items-center gap-3 text-sm">
                        {b.image_url ? (
                          <img src={b.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[--color-dp-200] shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[--color-dp-1400] font-medium truncate">{b.name}</p>
                          <p className="text-[--color-dp-600] text-xs truncate">{b.org.name ?? b.org.id}</p>
                          {b.type === 'tiered' && b.tiers && (() => {
                            const current = b.tiers.find(t => t.is_current);
                            const next = b.tiers.find(t => t.is_next);
                            return (
                              <p className="text-xs text-[--color-dp-700] mt-0.5">
                                {current ? `Tier ${current.level}${current.name ? ` · ${current.name}` : ''}` : 'Not started'}
                                {next ? ` · next at ${next.amount}` : b.earned ? ' · complete' : ''}
                              </p>
                            );
                          })()}
                          {b.type === 'collection' && b.components && (
                            <p className="text-xs text-[--color-dp-700] mt-0.5">
                              {b.components.filter(c => c.earned).length}/{b.components.length} collected
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {b.earned && <span className="badge badge-primary">earned</span>}
                          {b.points && <span className="text-xs text-[--color-mango-900] font-medium">{b.points} pts</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
