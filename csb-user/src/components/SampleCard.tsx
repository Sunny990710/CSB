import React from 'react';
import { Plus, Check } from 'lucide-react';
import { Sample } from '@/types';
import SampleImage from './SampleImage';
import { StatusBadge } from './StatusChipBar';
import { getDisplayRentalFee } from '../utils/constants';
import { canAddSampleToLocker } from '../utils/lockerHelpers';

interface SampleCardProps {
  sample: Sample;
  inLocker: boolean;
  onOpen: () => void;
  onToggleLocker: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export default function SampleCard({
  sample,
  inLocker,
  onOpen,
  onToggleLocker,
  selectable,
  selected,
  onToggleSelect,
}: SampleCardProps) {
  const feeLabel = getDisplayRentalFee(sample).toLocaleString();

  return (
    <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow group">
      <button type="button" onClick={onOpen} className="w-full text-left cursor-pointer">
        <div className="relative aspect-[4/5]">
          <SampleImage sample={sample} className="w-full h-full" />
          <div className="absolute top-2 left-2">
            <StatusBadge status={sample.status} />
          </div>
          {selectable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.();
              }}
              className={`absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer ${
                selected ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white/90 border-slate-300'
              }`}
            >
              {selected && <Check className="w-3 h-3" />}
            </button>
          )}
        </div>
      </button>

      <div className="p-3.5 space-y-1">
        <p className="text-[10px] font-mono text-slate-400">{sample.code}</p>
        <h3
          className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug cursor-pointer hover:text-violet-700"
          onClick={onOpen}
        >
          {sample.name}
        </h3>
        <p className="text-[10px] text-slate-400">
          {sample.regDate} · {sample.registerer}
        </p>
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-black text-slate-900">₩{feeLabel}</span>
          <button
            type="button"
            onClick={onToggleLocker}
            disabled={!canAddSampleToLocker(sample.status) && !inLocker}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              inLocker
                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                : 'bg-violet-600 hover:bg-violet-700 text-white'
            }`}
          >
            {inLocker ? (
              <>
                <Check className="w-3.5 h-3.5" /> 담음
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" /> 담기
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
