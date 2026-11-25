import React, { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';

export function PlantPhoto({ src, alt, className, loading }: { src: string; alt: string; className?: string; loading?: 'lazy' | 'eager' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed) return (
    <div role="img" aria-label={`${alt}: foto indisponível`} className={`flex flex-col items-center justify-center gap-2 bg-stone-100 text-stone-500 ${className ?? ''}`}>
      <Leaf className="w-8 h-8" />
      <span className="text-xs">Foto indisponível</span>
    </div>
  );
  return <img src={src} alt={alt} className={className} loading={loading} onError={() => setFailed(true)} />;
}
