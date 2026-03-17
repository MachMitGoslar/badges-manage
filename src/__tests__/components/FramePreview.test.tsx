/**
 * FramePreview component tests
 *
 * Covers:
 *   - Loading skeleton shown while fetch is in progress
 *   - <img> rendered with object URL after a successful fetch
 *   - Stays in skeleton state when fetch returns a non-ok response
 *   - Module-level cache: same (centerpieceUrl, tier, level) combination
 *     only triggers one fetch, no matter how many times the component mounts
 *   - Different prop combinations each trigger their own fetch
 *   - Authorization header is sent when a token is present
 *   - milestone and templateId are appended to the preview URL
 *
 * Note on cache isolation: the module-level `cache` Map in FramePreview
 * persists for the lifetime of the module instance. Each test uses a unique
 * centerpieceUrl so tests never accidentally share cache entries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ── Stable mock for useAuth, configured per-test via mockUseAuth ──────────────

const mockUseAuth = vi.hoisted(() => vi.fn());

vi.mock('../../auth/AuthContext.tsx', () => ({
  useAuth: mockUseAuth,
}));

import FramePreview from '../../components/FramePreview.tsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

let urlCounter = 0;
/** Returns a unique URL so every test starts with a cold cache entry. */
function uniqueUrl() {
  return `http://test.example/cp-${++urlCounter}.png`;
}

function mockFetchSuccess() {
  const blob = new Blob(['png-data'], { type: 'image/png' });
  global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) });
}

function mockFetchFailure() {
  global.fetch = vi.fn().mockResolvedValue({ ok: false });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FramePreview', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ token: 'test-token' });
    vi.clearAllMocks();
  });

  it('renders a loading skeleton before the fetch resolves', () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <FramePreview centerpieceUrl={uniqueUrl()} tier={1} level={1} />,
    );

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders an <img> with the object URL after a successful fetch', async () => {
    mockFetchSuccess();

    render(<FramePreview centerpieceUrl={uniqueUrl()} tier={1} level={2} />);

    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:mock-object-url');
  });

  it('stays in skeleton state when the fetch returns a non-ok response', async () => {
    mockFetchFailure();

    const { container } = render(
      <FramePreview centerpieceUrl={uniqueUrl()} tier={2} level={1} />,
    );

    await new Promise((r) => setTimeout(r, 30));

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('fetches only once for the same props (module-level cache hit)', async () => {
    mockFetchSuccess();
    const url = uniqueUrl();

    // First mount — triggers fetch
    const { unmount } = render(<FramePreview centerpieceUrl={url} tier={1} level={1} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
    const callsAfterFirst = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    unmount();

    // Second mount with identical props — must hit cache, no new fetch
    render(<FramePreview centerpieceUrl={url} tier={1} level={1} />);
    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterFirst);
  });

  it('fetches independently for different (tier, level) combinations', async () => {
    mockFetchSuccess();
    const url = uniqueUrl();

    render(<FramePreview centerpieceUrl={url} tier={1} level={1} />);
    render(<FramePreview centerpieceUrl={url} tier={2} level={3} />);

    await waitFor(() => expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2));
  });

  it('sends the Authorization header when a token is present', async () => {
    mockUseAuth.mockReturnValue({ token: 'my-jwt' });
    mockFetchSuccess();

    render(<FramePreview centerpieceUrl={uniqueUrl()} tier={3} level={4} />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer my-jwt');
  });

  it('encodes milestone and templateId in the preview request URL', async () => {
    mockFetchSuccess();

    render(
      <FramePreview
        centerpieceUrl={uniqueUrl()}
        tier={2}
        level={3}
        milestone={500}
        templateId="gold-frame"
      />,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain('milestone=500');
    expect(url).toContain('template_id=gold-frame');
  });
});
