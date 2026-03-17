/**
 * OrgDetail page tests
 *
 * Focuses on the badge list rendering logic — particularly the tiered-badge
 * "show highest tier" rule introduced in the display refactor:
 *
 *   - Normal badges display badge.imageURL and badge.text_awarded
 *   - Tiered badges display the last tier's imageURL and text_awarded
 *   - Falls back to parent badge values when tier fields are null
 *   - Tiered badges with an empty tiers array fall back to parent values
 *   - Admin controls (edit/delete) visible only for admins
 *   - Non-admin users do not see management buttons
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { BadgeTemplate } from '../../api/client.ts';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// vi.hoisted() ensures these are available inside the vi.mock() factories,
// which are hoisted to the top of the file before any other declarations.
const { mockUseQuery, mockIsAdmin, mockIsOwner } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockIsAdmin: vi.fn().mockReturnValue(false),
  mockIsOwner: vi.fn().mockReturnValue(false),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: vi.fn().mockReturnValue({ orgId: 'org-1' }),
    useNavigate: vi.fn().mockReturnValue(vi.fn()),
    Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
      <a href={to} className={className}>{children}</a>
    ),
  };
});

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: mockUseQuery,
    useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  };
});

vi.mock('../../auth/AuthContext.tsx', () => ({
  useAuth: vi.fn().mockReturnValue({
    token: 'test-token',
    isAdmin: mockIsAdmin,
    isOwner: mockIsOwner,
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import OrgDetail from '../../pages/OrgDetail.tsx';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const orgFixture = {
  id: 'org-1',
  name: 'Test Org',
  city: 'Berlin',
  street: null,
  number: null,
  postcode: null,
  description: null,
  logoFileUrl: null,
  websiteUrl: null,
  contactEmail: null,
};

function makeNormalBadge(overrides: Partial<BadgeTemplate> = {}): BadgeTemplate {
  return {
    id: 'badge-normal',
    name: 'Normal Badge',
    badge_type: 'normal',
    text_condition: 'Do the thing',
    text_awarded: 'You did it!',
    imageURL: 'http://example.com/normal.png',
    category: ['event'],
    points: 10,
    visible_for_users: true,
    centerpiece_url: null,
    frame_tier: null,
    frame_level: null,
    frame_template_id: null,
    organisation: { id: 'org-1', name: 'Test Org' },
    ...overrides,
  };
}

function makeTieredBadge(
  tiers: { imageURL: string | null; text_awarded: string | null }[],
  overrides: Partial<BadgeTemplate> = {},
): BadgeTemplate {
  return {
    id: 'badge-tiered',
    name: 'Tiered Badge',
    badge_type: 'tiered',
    text_condition: 'Reach milestones',
    text_awarded: 'Parent awarded text',
    imageURL: 'http://example.com/parent.png',
    category: [],
    points: null,
    visible_for_users: true,
    centerpiece_url: null,
    frame_tier: null,
    frame_level: null,
    frame_template_id: null,
    organisation: { id: 'org-1', name: 'Test Org' },
    tiers: tiers.map((t, i) => ({
      level: i + 1,
      amount: (i + 1) * 10,
      imageURL: t.imageURL,
      name: null,
      text_awarded: t.text_awarded,
    })),
    ...overrides,
  };
}

/** Sets up useQuery to return org data and a given badge list. */
function setupQueries(badges: BadgeTemplate[]) {
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
    if ((queryKey as string[])[0] === 'org') {
      return { data: { organisation: orgFixture }, isLoading: false };
    }
    if ((queryKey as string[])[0] === 'org-badges') {
      return { data: { badges }, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OrgDetail badge list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin.mockReturnValue(false);
    mockIsOwner.mockReturnValue(false);
  });

  it('displays a normal badge with its own imageURL', () => {
    const badge = makeNormalBadge({ imageURL: 'http://example.com/normal.png' });
    setupQueries([badge]);
    // alt="" makes badge thumbnails role="presentation"; use DOM query
    const { container } = render(<OrgDetail />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'http://example.com/normal.png');
  });

  it('displays a normal badge with its own text_awarded', () => {
    const badge = makeNormalBadge({ text_awarded: 'Congratulations!' });
    setupQueries([badge]);
    render(<OrgDetail />);

    expect(screen.getByText('Congratulations!')).toBeInTheDocument();
  });

  it("displays the highest tier's imageURL for a tiered badge", () => {
    const badge = makeTieredBadge([
      { imageURL: 'http://example.com/bronze.png', text_awarded: 'Bronze!' },
      { imageURL: 'http://example.com/silver.png', text_awarded: 'Silver!' },
      { imageURL: 'http://example.com/gold.png', text_awarded: 'Gold!' },
    ]);
    setupQueries([badge]);
    const { container } = render(<OrgDetail />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'http://example.com/gold.png');
    expect(img).not.toHaveAttribute('src', 'http://example.com/parent.png');
  });

  it("displays the highest tier's text_awarded for a tiered badge", () => {
    const badge = makeTieredBadge([
      { imageURL: null, text_awarded: 'Bronze reached' },
      { imageURL: null, text_awarded: 'Gold reached' },
    ]);
    setupQueries([badge]);
    render(<OrgDetail />);

    expect(screen.getByText('Gold reached')).toBeInTheDocument();
    expect(screen.queryByText('Bronze reached')).not.toBeInTheDocument();
    expect(screen.queryByText('Parent awarded text')).not.toBeInTheDocument();
  });

  it('falls back to parent imageURL when the highest tier has imageURL: null', () => {
    const badge = makeTieredBadge([
      { imageURL: 'http://example.com/bronze.png', text_awarded: null },
      { imageURL: null, text_awarded: null },          // highest tier has no image
    ], { imageURL: 'http://example.com/parent.png' });
    setupQueries([badge]);
    const { container } = render(<OrgDetail />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'http://example.com/parent.png');
  });

  it('falls back to parent text_awarded when highest tier text_awarded is null', () => {
    const badge = makeTieredBadge([
      { imageURL: null, text_awarded: 'Bronze' },
      { imageURL: null, text_awarded: null },  // highest tier has no text
    ], { text_awarded: 'Parent text fallback' });
    setupQueries([badge]);
    render(<OrgDetail />);

    expect(screen.getByText('Parent text fallback')).toBeInTheDocument();
  });

  it('falls back to parent values when tiers array is empty', () => {
    const badge = makeTieredBadge([], {
      imageURL: 'http://example.com/parent.png',
      text_awarded: 'Parent text',
    });
    setupQueries([badge]);
    const { container } = render(<OrgDetail />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'http://example.com/parent.png');
    expect(screen.getByText('Parent text')).toBeInTheDocument();
  });

  it('shows edit/delete controls for admin users', async () => {
    mockIsAdmin.mockReturnValue(true);
    setupQueries([makeNormalBadge()]);
    render(<OrgDetail />);

    await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides edit/delete controls for non-admin users', () => {
    mockIsAdmin.mockReturnValue(false);
    setupQueries([makeNormalBadge()]);
    render(<OrgDetail />);

    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('shows an empty state when the org has no badges', () => {
    setupQueries([]);
    render(<OrgDetail />);
    expect(screen.getByText(/no badges yet/i)).toBeInTheDocument();
  });

  it('marks hidden badges with a "hidden" label', () => {
    const badge = makeNormalBadge({ visible_for_users: false });
    setupQueries([badge]);
    render(<OrgDetail />);
    expect(screen.getByText('hidden')).toBeInTheDocument();
  });
});
