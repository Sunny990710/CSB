import React from 'react';
import { SampleStatus, sampleStatusLabel, Rental, rentalStatusLabel } from '@/types';

const STATUS_STYLE: Record<SampleStatus, string> = {
  대여가능: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  대여중: 'bg-blue-50 text-blue-700 border-blue-100',
  연체중: 'bg-rose-50 text-rose-700 border-rose-100',
  부평보관: 'bg-amber-50 text-amber-700 border-amber-100',
  분실: 'bg-slate-100 text-slate-700 border-slate-200',
};

interface StatusBadgeProps {
  status: SampleStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${style} ${className}`}
    >
      {sampleStatusLabel(status)}
    </span>
  );
}

const RENTAL_STATUS_STYLE: Record<Rental['status'], string> = {
  대여중: 'bg-blue-50 text-blue-700 border-blue-100',
  연체중: 'bg-rose-50 text-rose-700 border-rose-100',
  반납완료: 'bg-sky-50 text-sky-700 border-sky-100',
};

export function RentalStatusBadge({ status, className = '' }: { status: Rental['status']; className?: string }) {
  const style = RENTAL_STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[4.25rem] text-[11px] font-bold py-1 px-2.5 rounded-full border whitespace-nowrap ${style} ${className}`}
    >
      {rentalStatusLabel(status)}
    </span>
  );
}

const STATUS_FILTER_CHIPS: { id: SampleStatus; label: string; active: string; idle: string }[] = [
  { id: '대여가능', label: '대여가능', active: 'bg-emerald-600 text-white', idle: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { id: '대여중', label: '대여중', active: 'bg-blue-600 text-white', idle: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { id: '연체중', label: '연체', active: 'bg-rose-600 text-white', idle: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
  { id: '부평보관', label: '보관', active: 'bg-amber-600 text-white', idle: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { id: '분실', label: '분실', active: 'bg-slate-600 text-white', idle: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
];

interface StatusChipBarProps {
  options: { key: string; label: string }[];
  active: string;
  counts: Record<string, number>;
  onChange: (key: string) => void;
  showTopBorder?: boolean;
}

export default function StatusChipBar({ active, counts, onChange, showTopBorder = true }: StatusChipBarProps) {
  const allCount = counts['전체'] ?? 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 min-h-[36px] w-full ${
        showTopBorder ? 'pt-3 border-t border-slate-100' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onChange('전체')}
        className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
          active === '전체' ? 'bg-black text-white' : 'bg-black/85 text-white hover:bg-black'
        }`}
      >
        전체 {allCount}
      </button>
      <div className="hidden sm:block w-px h-5 bg-slate-200 mx-1 shrink-0" aria-hidden="true" />
      {STATUS_FILTER_CHIPS.map((chip) => {
        const count = counts[chip.id] ?? counts[chip.label] ?? 0;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onChange(chip.id)}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              active === chip.id ? chip.active : chip.idle
            }`}
          >
            {chip.label} {count}
          </button>
        );
      })}
    </div>
  );
}
