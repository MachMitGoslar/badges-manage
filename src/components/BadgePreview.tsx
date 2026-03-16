/**
 * CSS-composite badge preview.
 * Renders the tier/type background from Supabase storage with the
 * centerpiece overlaid at 76% scale — no imgproxy dependency.
 *
 * The Supabase base URL is derived from the centerpieceUrl itself so the
 * component works in any environment without extra env vars.
 */

interface Props {
  centerpieceUrl: string;
  badgeType: 'normal' | 'tiered' | 'collection';
  tierLevel?: number;   // 1-based; determines background variant for tiered badges
  className?: string;   // outer container size, e.g. "w-20 h-20"
  title?: string;
}

function bgUrl(centerpieceUrl: string, badgeType: Props['badgeType'], tierLevel: number): string {
  // Derive the storage origin from the centerpiece URL (works in any env)
  const storageBase = centerpieceUrl.replace(/\/storage\/v1\/.*$/, '');
  const bgName = badgeType === 'tiered' ? `tier-${Math.min(tierLevel, 3)}` : 'normal';
  return `${storageBase}/storage/v1/object/public/badges/_backgrounds/${bgName}.png`;
}

export default function BadgePreview({
  centerpieceUrl,
  badgeType,
  tierLevel = 1,
  className = 'w-20 h-20',
  title,
}: Props) {
  return (
    <div className={`relative rounded-lg overflow-hidden bg-gray-800 shrink-0 ${className}`} title={title}>
      {/* background layer */}
      <img
        src={bgUrl(centerpieceUrl, badgeType, tierLevel)}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* centerpiece layer — centered at ~76% of the container */}
      <img
        src={centerpieceUrl}
        alt=""
        className="absolute inset-[12%] w-[76%] h-[76%] object-contain"
      />
    </div>
  );
}
