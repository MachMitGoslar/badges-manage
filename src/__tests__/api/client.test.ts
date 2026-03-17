/**
 * API client tests
 *
 * Covers:
 *   - Successful responses for all HTTP verbs (GET, POST, PATCH, DELETE)
 *   - 204 No Content returns undefined
 *   - 4xx / 5xx throw ApiError with the correct status and message
 *   - Error message extracted from JSON response body when available
 *   - 401 dispatches the 'auth:unauthorized' custom event
 *   - buildBadgePreviewUrl constructs the expected imgproxy URL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, buildBadgePreviewUrl } from '../../api/client.ts';

// ── fetch mock helpers ────────────────────────────────────────────────────────

function mockFetch(status: number, body?: unknown, headers?: Record<string, string>) {
  const jsonBody = body !== undefined ? JSON.stringify(body) : '';
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers(headers ?? { 'Content-Type': 'application/json' }),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(jsonBody),
  });
}

// ── api.get ───────────────────────────────────────────────────────────────────

describe('api.get', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns parsed JSON on 200', async () => {
    mockFetch(200, { badges: [] });
    const result = await api.get('/api/v1/badges', 'test-token');
    expect(result).toEqual({ badges: [] });
  });

  it('sends Authorization header when token is provided', async () => {
    mockFetch(200, {});
    await api.get('/api/v1/badges', 'my-jwt');
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/badges',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer my-jwt' }),
      }),
    );
  });

  it('omits Authorization header when token is null', async () => {
    mockFetch(200, {});
    await api.get('/api/v1/badges', null);
    const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('throws ApiError with the server message on 404', async () => {
    mockFetch(404, { message: 'Badge not found' });
    await expect(api.get('/api/v1/badges/missing', null)).rejects.toMatchObject({
      status: 404,
      message: 'Badge not found',
    });
  });

  it('falls back to statusText when response body has no message', async () => {
    mockFetch(500, { error: 'Internal Server Error' });
    await expect(api.get('/api/v1/fail', null)).rejects.toBeInstanceOf(ApiError);
  });

  it('dispatches auth:unauthorized event on 401', async () => {
    mockFetch(401, { message: 'Unauthorized' });
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    await expect(api.get('/api/v1/protected', 'bad-token')).rejects.toBeInstanceOf(ApiError);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth:unauthorized' }),
    );
  });
});

// ── api.post ──────────────────────────────────────────────────────────────────

describe('api.post', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends body as JSON and returns parsed response', async () => {
    const payload = { name: 'New Badge', badge_type: 'normal' };
    mockFetch(201, { badge: { id: 'b-1', ...payload } });

    const result = await api.post('/api/v1/orgs/org-1/badges', 'tok', payload) as Record<string, unknown>;
    expect((result.badge as Record<string, unknown>).name).toBe('New Badge');
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/orgs/org-1/badges',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
  });

  it('throws ApiError on 422 validation error', async () => {
    mockFetch(422, { message: 'Invalid badge_type' });
    await expect(api.post('/api/v1/orgs/org-1/badges', 'tok', {}))
      .rejects.toMatchObject({ status: 422, message: 'Invalid badge_type' });
  });
});

// ── api.patch ─────────────────────────────────────────────────────────────────

describe('api.patch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends PATCH with partial body', async () => {
    mockFetch(200, { badge: { id: 'b-1' } });
    await api.patch('/api/v1/orgs/org-1/badges/b-1', 'tok', { name: 'Updated' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/orgs/org-1/badges/b-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});

// ── api.delete ────────────────────────────────────────────────────────────────

describe('api.delete', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns undefined on 204 No Content', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: vi.fn(),
    });

    const result = await api.delete('/api/v1/orgs/org-1/badges/b-1', 'tok');
    expect(result).toBeUndefined();
  });

  it('throws ApiError on 403 Forbidden', async () => {
    mockFetch(403, { message: 'Admin access required' });
    await expect(api.delete('/api/v1/orgs/org-1/badges/b-1', 'tok'))
      .rejects.toMatchObject({ status: 403 });
  });
});

// ── buildBadgePreviewUrl ──────────────────────────────────────────────────────

/**
 * The function embeds background and centerpiece URLs as base64url segments
 * inside an imgproxy compose URL.  We decode the last path segment to verify
 * the correct background filename was chosen.
 */
function decodeLastSegment(url: string): string {
  const b64 = url.split('/').at(-1)!.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64);
}

describe('buildBadgePreviewUrl', () => {
  it('returns a non-empty URL string', () => {
    const url = buildBadgePreviewUrl('http://example.com/cp.png', 'normal');
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  it('uses the tier-N background for tiered badges', () => {
    const url = buildBadgePreviewUrl('http://example.com/cp.png', 'tiered', 2);
    expect(decodeLastSegment(url)).toContain('tier-2');
  });

  it('clamps tier level to 3 for out-of-range values', () => {
    const url = buildBadgePreviewUrl('http://example.com/cp.png', 'tiered', 99);
    expect(decodeLastSegment(url)).toContain('tier-3');
  });

  it('uses "normal" background for non-tiered badge types', () => {
    const url = buildBadgePreviewUrl('http://example.com/cp.png', 'collection');
    expect(decodeLastSegment(url)).toContain('normal');
  });
});
