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
  text_condition: string;
  text_awarded: string;
  imageURL: string | null;
  category: string[];
  points: number | null;
  visible_for_users: boolean;
  badge_type: 'normal' | 'tiered' | 'collection';
  organisation: { id: string; name: string | null } | null;
}

export interface GrantToken {
  id: string;
  token: string;
  badge_template_id: string;
  created_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
  note: string | null;
}

export interface CreateBadgeInput {
  text_condition: string;
  text_awarded: string;
  imageURL?: string;
  category?: string[];
  points?: number;
  visible_for_users?: boolean;
  badge_type?: 'normal' | 'tiered' | 'collection';
}

export interface CreateTokenInput {
  badge_template_id: string;
  note?: string;
}
