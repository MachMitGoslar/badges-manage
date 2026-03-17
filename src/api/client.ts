export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  token: string | null,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.message ?? message;
    } catch { /* ignore */ }
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, token: string | null) => request<T>('GET', path, token),
  post: <T>(path: string, token: string | null, body: unknown) => request<T>('POST', path, token, body),
  patch: <T>(path: string, token: string | null, body: unknown) => request<T>('PATCH', path, token, body),
  delete: <T>(path: string, token: string | null) => request<T>('DELETE', path, token),
};

// ── Typed API helpers ────────────────────────────────────────────────────────

export interface Organisation {
  id: string;
  name: string | null;
  street: string | null;
  number: string | null;
  postcode: string | null;
  city: string | null;
  logoFileUrl: string | null;
  description: string | null;
  websiteUrl: string | null;
  contactEmail: string | null;
}

export interface BadgeTemplate {
  id: string;
  name: string;
  text_condition: string;
  text_awarded: string;
  imageURL: string | null;
  category: string[];
  points: number | null;
  visible_for_users: boolean;
  badge_type: 'normal' | 'tiered' | 'collection';
  centerpiece_url: string | null;
  frame_tier: number | null;
  frame_level: number | null;
  frame_template_id: string | null;
  organisation: { id: string; name: string | null } | null;
  // type-specific (present when badge_type matches)
  tiers?: { level: number; amount: number; imageURL: string | null; name: string | null; text_awarded: string | null; text_awarded_template?: string | null }[];
  collection_badges?: { id: string; text_condition: string; imageURL: string | null }[];
}

export interface GrantToken {
  id: string;
  token: string;
  badge_template_id: string;
  organisation_id: string;
  created_by: string | null;
  expires_at: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  grant_url: string;
}

export interface CreateBadgeInput {
  name: string;
  text_condition: string;
  text_awarded: string;
  imageURL?: string;
  category?: string[];
  points?: number;
  visible_for_users?: boolean;
  badge_type?: 'normal' | 'tiered' | 'collection';
  centerpiece_url?: string;
  frame_tier?: number | null;
  frame_level?: number | null;
  frame_template_id?: string | null;
  // type-specific
  tiers?: { level: number; amount: number; imageURL?: string; name?: string | null; text_awarded?: string | null }[];
  required_badge_ids?: string[];
}

export interface GrantLogEntry {
  id: string;
  user_id: string;
  user_name: string | null;
  granted_at: string;
  status: 'success' | 'failed' | 'already_earned' | 'token_expired' | 'token_exhausted';
  error_message: string | null;
}

export interface CreateTokenInput {
  badge_template_id: string;
  note?: string;
  max_uses?: number;
  expires_at?: string;
}

export interface FrameTemplateInfo {
  id: string;
  name: string;
  description: string;
  maxTiers: number;
  levelsPerTier: number;
}

export interface OrgMember {
  user_id: string;
  role: 'member' | 'admin' | 'owner';
  name: string | null;
  email: string | null;
}

export interface UserMe {
  id: string;
  email: string | null;
  name: string | null;
  organisations: { organisation_id: string; role: string }[];
  profile: {
    username: string | null;
    show_name: boolean;
    show_profile_image: boolean;
    show_badge_list: boolean;
    profile_image_url: string | null;
    showcase: unknown[];
  };
}

export interface UpdateProfileInput {
  username?: string;
  show_name?: boolean;
  show_profile_image?: boolean;
  show_badge_list?: boolean;
}

export interface BadgeTierView {
  level: number;
  name: string | null;
  image_url: string | null;
  amount: number;
  earned: boolean;
  earned_at: string | null;
  is_current: boolean;
  is_next: boolean;
}

export interface BadgeComponentView {
  template_id: string;
  name: string;
  image_url: string | null;
  earned: boolean;
  earned_at: string | null;
}

export interface BadgeView {
  id: string | null;
  template_id: string;
  type: 'normal' | 'tiered' | 'collection';
  name: string;
  description: string;
  image_url: string | null;
  org: { id: string; name: string | null };
  earned: boolean;
  earned_at: string | null;
  points: number | null;
  tiers: BadgeTierView[] | null;
  components: BadgeComponentView[] | null;
}

export interface BadgePortfolio {
  user_id: string;
  total_points: number;
  badges: BadgeView[];
}

export interface Centerpiece {
  name: string;
  url: string;
}

export function listCenterpieces(orgId: string, token: string | null): Promise<{ centerpieces: Centerpiece[] }> {
  return api.get(`/api/v1/orgs/${orgId}/centerpieces`, token);
}

export async function uploadCenterpiece(orgId: string, token: string | null, file: File): Promise<{ url: string; name: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`/api/v1/orgs/${orgId}/centerpieces`, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    let message = res.statusText;
    try { const d = await res.json(); message = d.message ?? message; } catch { /**/ }
    throw new ApiError(res.status, message);
  }
  return res.json();
}

export function deleteCenterpiece(orgId: string, token: string | null, filename: string): Promise<void> {
  return api.delete(`/api/v1/orgs/${orgId}/centerpieces/${filename}`, token);
}

export function getMe(token: string | null): Promise<UserMe> {
  return api.get<UserMe>('/api/v1/users/me', token);
}

export function getBadges(token: string | null): Promise<BadgePortfolio> {
  return api.get<BadgePortfolio>('/api/v1/users/me/badges', token);
}

export function updateProfile(token: string | null, input: UpdateProfileInput): Promise<{ profile: UserMe['profile'] }> {
  return api.patch<{ profile: UserMe['profile'] }>('/api/v1/users/me/profile', token, input);
}

export async function uploadProfileImage(token: string | null, file: File): Promise<{ profile_image_url: string }> {
  const formData = new FormData();
  formData.append('image', file);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch('/api/v1/users/me/profile/image', { method: 'POST', headers, body: formData });
  if (!res.ok) {
    let message = res.statusText;
    try { const d = await res.json(); message = d.message ?? message; } catch { /**/ }
    throw new ApiError(res.status, message);
  }
  return res.json();
}

export function deleteProfileImage(token: string | null): Promise<void> {
  return api.delete<void>('/api/v1/users/me/profile/image', token);
}

/**
 * Build an imgproxy compose URL client-side (mirrors imageService.buildComposeUrl on the server).
 * Uses VITE_IMGPROXY_PUBLIC_URL and VITE_IMGPROXY_SOURCE_BASE_URL env vars.
 */
function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function buildBadgePreviewUrl(
  centerpieceUrl: string,
  badgeType: 'normal' | 'tiered' | 'collection',
  tierLevel = 1
): string {
  const publicUrl = import.meta.env.VITE_IMGPROXY_PUBLIC_URL ?? 'http://localhost:5001';
  const sourceBase = import.meta.env.VITE_IMGPROXY_SOURCE_BASE_URL ?? 'http://kong:8000';

  const bgName = badgeType === 'tiered' ? `tier-${Math.min(tierLevel, 3)}` : 'normal';
  const bgUrl = `${sourceBase}/storage/v1/object/public/badges/_backgrounds/${bgName}.png`;
  // Rewrite the centerpiece URL so imgproxy can fetch it from the internal network
  const cpUrl = centerpieceUrl.replace(/^https?:\/\/[^/]+/, sourceBase);

  const b64bg = toBase64Url(bgUrl);
  const b64cp = toBase64Url(cpUrl);

  return `${publicUrl}/insecure/rs:fill:400:400/wm:1:ce:0:0:0.75/wmurl:${b64cp}/${b64bg}`;
}
