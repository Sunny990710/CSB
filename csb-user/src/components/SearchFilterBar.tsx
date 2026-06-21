import React from 'react';
import { Search, LayoutGrid, List, RotateCcw, CheckCircle, ChevronDown, X } from 'lucide-react';
import { SampleStatus } from '@/types';
import { SampleFilters } from '../utils/filters';
import StatusChipBar from './StatusChipBar';
import { STATUS_CHIP_OPTIONS } from '../utils/constants';

interface SearchFilterBarProps {
  filters: SampleFilters;
  onChange: (next: SampleFilters) => void;
  brands: string[];
  categories: string[];
  countries: string[];
  genders: string[];
  seasons: string[];
  resultCount: number;
  statusCounts: Record<string, number>;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  searchPlaceholder?: string;
  countLabel?: string;
  headerAction?: React.ReactNode;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === '전체' ? `${label}: 전체` : o}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
    </div>
  );
}

export default function SearchFilterBar({
  filters,
  onChange,
  brands,
  categories,
  countries,
  genders,
  seasons,
  resultCount,
  statusCounts,
  viewMode,
  onViewModeChange,
  searchPlaceholder = '검색어를 입력하세요 (상품코드, 상품명, 브랜드, 색상, 소재)',
  countLabel = '상품 수',
  headerAction,
}: SearchFilterBarProps) {
  const patch = (partial: Partial<SampleFilters>) => onChange({ ...filters, ...partial });

  const resetFilters = () =>
    onChange({
      query: '',
      brand: '전체',
      category: '전체',
      country: '전체',
      gender: '전체',
      season: '전체',
      status: '전체',
    });

  return (
    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm" id="user-filter-panel">
      <div className="flex gap-3 justify-between items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100/70 border-0 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1.5 focus:ring-violet-500 rounded-xl text-xs font-medium placeholder:text-slate-400 transition-all"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => patch({ query: '' })}
              className="absolute right-3 top-2.5 p-0.5 hover:bg-slate-200 rounded-full cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
        {headerAction}
      </div>

      <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:justify-between items-stretch lg:items-center gap-x-3 gap-y-2.5">
          <div className="flex flex-nowrap gap-x-2 items-center overflow-x-auto min-w-0 shrink">
            <button
              type="button"
              onClick={resetFilters}
              className="bg-[#1e293b] hover:bg-[#0f172a] text-white text-xs font-bold py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <CheckCircle className="w-3.5 h-3.5 text-white" />
              <span>필터 초기화</span>
            </button>
            <FilterSelect label="브랜드" value={filters.brand} options={brands} onChange={(v) => patch({ brand: v })} />
            <FilterSelect label="카테고리" value={filters.category} options={categories} onChange={(v) => patch({ category: v })} />
            <FilterSelect label="국가" value={filters.country} options={countries} onChange={(v) => patch({ country: v })} />
            <FilterSelect label="성별" value={filters.gender} options={genders} onChange={(v) => patch({ gender: v })} />
            <FilterSelect label="시즌" value={filters.season} options={seasons} onChange={(v) => patch({ season: v })} />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 lg:self-center shrink-0 self-end justify-end w-full lg:w-auto">
            <span className="text-[11px] text-slate-400 font-extrabold font-mono uppercase tracking-wide whitespace-nowrap">
              {countLabel}: {resultCount.toLocaleString()}개
            </span>
            <div className="flex border border-slate-200/85 rounded-lg p-0.5 bg-slate-50 gap-0.5">
              <button
                type="button"
                onClick={() => onViewModeChange('grid')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
                aria-label="그리드 보기"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('list')}
                className={`p-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
                aria-label="표 보기"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <StatusChipBar
          options={STATUS_CHIP_OPTIONS.map(({ key, label }) => ({ key, label }))}
          active={filters.status}
          counts={statusCounts}
          onChange={(status) => patch({ status: status as SampleFilters['status'] })}
        />
      </div>
    </div>
  );
}
