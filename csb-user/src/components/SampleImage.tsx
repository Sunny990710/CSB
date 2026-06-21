import React from 'react';
import { Shirt } from 'lucide-react';
import { Sample } from '@/types';

interface SampleImageProps {
  sample: Sample;
  className?: string;
  label?: string;
}

export default function SampleImage({ sample, className = '', label }: SampleImageProps) {
  const src = sample.imgFrontClean || sample.imgFront || sample.imgFlat;
  return (
    <div className={`relative bg-slate-50 flex items-center justify-center overflow-hidden ${className}`}>
      {label && (
        <span className="absolute top-2 left-2 z-10 text-[10px] font-bold text-slate-500 bg-white/90 px-1.5 py-0.5 rounded">
          {label}
        </span>
      )}
      {src ? (
        <img src={src} alt={sample.name} className="w-full h-full object-cover" />
      ) : (
        <Shirt className="w-10 h-10 text-slate-200" strokeWidth={1.2} />
      )}
    </div>
  );
}
