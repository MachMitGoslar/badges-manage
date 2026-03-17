/**
 * AuthContext tests
 *
 * Covers:
 *   - Initial state: reads persisted token from localStorage
 *   - login() — stores token, triggers org fetch
 *   - logout() — clears storage, resets state
 *   - Role helpers: isAdmin, isOwner, isMember, getRole, getOrgName
 *   - Proactive expiry: expired token on mount triggers immediate logout
 *   - Reactive expiry: auth:unauthorized event triggers logout
 *   - Org data fetch: populates orgIds, roles, and names
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../auth/AuthContext.tsx';

// ── PKCE mock ─────────────────────────────────────────────────────────────────

vi.mock('../../auth/pkce.ts', () => ({
  startLogin: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'badges_manage_token';

/** Build a minimal JWT with the given exp timestamp (seconds). */
function makeJwt(exp: number): string {
  const payload = btoa(JSON.stringify({ sub: 'u-1', exp }));
  return `header.${payload}.sig`;
}

function mockOrgFetch(orgs: { organisation_id: string; role: string; organisation_name: string }[]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ organisations: orgs }),
  });
}

/** Consumer component that exposes auth state via test IDs. */
function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="token">{auth.token ?? 'null'}</span>
      <span data-testid="orgIds">{auth.orgIds.join(',')}</span>
      <span data-testid="isAdmin">{String(auth.isAdmin('org-1'))}</span>
      <span data-testid="isOwner">{String(auth.isOwner('org-1'))}</span>
      <span data-testid="isMember">{String(auth.isMember('org-1'))}</span>
      <span data-testid="getRole">{auth.getRole('org-1') ?? 'null'}</span>
      <span data-testid="orgName">{auth.getOrgName('org-1') ?? 'null'}</span>
      <span data-testid="isLoading">{String(auth.isLoading)}</span>
      <button onClick={() => auth.login({ access_token: 'new-tok' })}>login</button>
      <button onClick={() => auth.logout()}>logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // Default: org fetch returns empty list
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ organisations: [] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('starts with null token when localStorage is empty', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'));
    expect(screen.getByTestId('token').textContent).toBe('null');
  });

  it('reads an existing token from localStorage on mount', async () => {
    localStorage.setItem(TOKEN_KEY, 'existing-tok');
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'));
    expect(screen.getByTestId('token').textContent).toBe('existing-tok');
  });

  it('login() stores the access token and triggers an org fetch', async () => {
    mockOrgFetch([{ organisation_id: 'org-1', role: 'admin', organisation_name: 'ACME' }]);
    renderWithProvider();

    await act(async () => {
      screen.getByText('login').click();
    });

    await waitFor(() => expect(screen.getByTestId('token').textContent).toBe('new-tok'));
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-tok');
    await waitFor(() => expect(screen.getByTestId('orgIds').textContent).toBe('org-1'));
  });

  it('logout() clears the token and org state', async () => {
    localStorage.setItem(TOKEN_KEY, 'existing-tok');
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'));

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(screen.getByTestId('orgIds').textContent).toBe('');
  });

  it('populates role helpers after org fetch', async () => {
    mockOrgFetch([{ organisation_id: 'org-1', role: 'admin', organisation_name: 'ACME' }]);
    localStorage.setItem(TOKEN_KEY, 'tok');
    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('isAdmin').textContent).toBe('true'));
    expect(screen.getByTestId('isOwner').textContent).toBe('false');
    expect(screen.getByTestId('isMember').textContent).toBe('true');
    expect(screen.getByTestId('getRole').textContent).toBe('admin');
    expect(screen.getByTestId('orgName').textContent).toBe('ACME');
  });

  it('isOwner and isAdmin both return true for owner role', async () => {
    mockOrgFetch([{ organisation_id: 'org-1', role: 'owner', organisation_name: 'ACME' }]);
    localStorage.setItem(TOKEN_KEY, 'tok');
    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('isOwner').textContent).toBe('true'));
    expect(screen.getByTestId('isAdmin').textContent).toBe('true');
  });

  it('isMember returns false for an org the user does not belong to', async () => {
    mockOrgFetch([{ organisation_id: 'org-2', role: 'member', organisation_name: 'Other' }]);
    localStorage.setItem(TOKEN_KEY, 'tok');
    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'));
    expect(screen.getByTestId('isMember').textContent).toBe('false');
  });

  it('auth:unauthorized event triggers logout', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok');
    // Suppress jsdom navigation warning for window.location.href
    const originalHref = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('isLoading').textContent).toBe('false'));

    await act(async () => {
      window.dispatchEvent(new Event('auth:unauthorized'));
    });

    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();

    if (originalHref) Object.defineProperty(window, 'location', originalHref);
  });

  it('immediately logs out if the token is already expired on mount', async () => {
    const expiredJwt = makeJwt(Math.floor(Date.now() / 1000) - 60); // expired 60s ago
    localStorage.setItem(TOKEN_KEY, expiredJwt);
    renderWithProvider();

    await waitFor(() => expect(screen.getByTestId('token').textContent).toBe('null'));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});
