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
  className?: string;
}

// Module-level cache: key → object URL (persists for session, avoids re-fetching)
const cache = new Map<string, string>();

export default function FramePreview({ centerpieceUrl, tier, level, className = 'w-12 h-12' }: Props) {
  const { token } = useAuth();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const key = `${centerpieceUrl}|${tier}|${level}`;
    if (cache.has(key)) {
      setSrc(cache.get(key)!);
      return;
    }

    let cancelled = false;
    const url = `/api/v1/badges/preview?centerpiece_url=${encodeURIComponent(centerpieceUrl)}&tier=${tier}&level=${level}`;

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
  }, [centerpieceUrl, tier, level, token]);

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
