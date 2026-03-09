import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext.tsx';
import { listCenterpieces, uploadCenterpiece, type Centerpiece } from '../api/client.ts';

interface Props {
  orgId: string;
  value: string | null;        // currently selected centerpiece URL
  onChange: (url: string | null) => void;
}

export default function CenterpieceSelector({ orgId, value, onChange }: Props) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const { data } = useQuery({
    queryKey: ['centerpieces', orgId],
    queryFn: () => listCenterpieces(orgId, token),
  });

  const centerpieces: Centerpiece[] = data?.centerpieces ?? [];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const result = await uploadCenterpiece(orgId, token, file);
      await queryClient.invalidateQueries({ queryKey: ['centerpieces', orgId] });
      onChange(result.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* None option */}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center text-xs transition-colors ${
            value === null
              ? 'border-blue-500 bg-blue-950 text-blue-300'
              : 'border-gray-700 bg-gray-900 text-gray-500 hover:border-gray-500'
          }`}
        >
          None
        </button>

        {/* Existing centerpieces */}
        {centerpieces.map((cp) => (
          <button
            key={cp.url}
            type="button"
            onClick={() => onChange(cp.url)}
            title={cp.name}
            className={`w-14 h-14 rounded-lg border-2 overflow-hidden transition-colors ${
              value === cp.url
                ? 'border-blue-500 ring-1 ring-blue-500'
                : 'border-gray-700 hover:border-gray-500'
            }`}
          >
            <img src={cp.url} alt={cp.name} className="w-full h-full object-contain bg-gray-900" />
          </button>
        ))}

        {/* Upload button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-600 hover:border-gray-400 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <span className="text-xs">…</span>
          ) : (
            <span className="text-xl leading-none">+</span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadError && (
        <p className="text-xs text-red-400">{uploadError}</p>
      )}
    </div>
  );
}
