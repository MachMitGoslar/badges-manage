/**
 * Server-rendered badge frame preview.
 * Calls GET /api/v1/badges/preview with auth and displays the resulting PNG.
 * Fetches once per (centerpieceUrl, tier, level) combination; result is cached
 * in React Query for the session.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.tsx';

interface Props {
  centerpieceUrl: string;
  tier: 1 | 2 | 3;
  level: 1 | 2 | 3 | 4;
  milestone?: number;
  templateId?: string;
  className?: string;
}

// Module-level cache: key → object URL (persists for session, avoids re-fetching)
const cache = new Map<string, string>();

export default function FramePreview({ centerpieceUrl, tier, level, milestone, templateId, className = 'w-12 h-12' }: Props) {
  const { token } = useAuth();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const key = `${centerpieceUrl}|${tier}|${level}|${milestone ?? ''}|${templateId ?? ''}`;
    if (cache.has(key)) {
      setSrc(cache.get(key)!);
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams({
      centerpiece_url: centerpieceUrl,
      tier: String(tier),
      level: String(level),
    });
    if (milestone !== undefined) params.set('milestone', String(milestone));
    if (templateId) params.set('template_id', templateId);
    const url = `/api/v1/badges/preview?${params}`;

    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        const objUrl = URL.createObjectURL(blob);
        cache.set(key, objUrl);
        setSrc(objUrl);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [centerpieceUrl, tier, level, milestone, templateId, token]);

  if (!src) {
    return <div className={`rounded-lg bg-[--color-dp-200] animate-pulse ${className}`} />;
  }

  return (
    <img
      src={src}
      alt={`Tier ${tier} Level ${level} preview`}
      className={`rounded-lg object-cover ${className}`}
    />
  );
}
