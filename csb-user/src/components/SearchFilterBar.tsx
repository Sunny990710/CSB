import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, LayoutGrid, List, CheckCircle, ChevronDown, X } from 'lucide-react';
import { Sample } from '@/types';
import { SampleFilters } from '../utils/filters';
import { EMPTY_DETAIL_OPTION_FILTERS } from '../utils/detailOptions';
import StatusChipBar from './StatusChipBar';
import { STATUS_CHIP_OPTIONS, SEASON_FILTER_OPTIONS } from '../utils/constants';
import { DateRangeCalendar } from './DateRangeCalendar';
import BrandFilterDropdown from './BrandFilterDropdown';
import ColorFilterDropdown from './ColorFilterDropdown';
import FilterDropdown from './FilterDropdown';
import CategoryTabBar from './CategoryTabBar';

interface SearchFilterBarProps {
  filters: SampleFilters;
  onChange: (next: SampleFilters) => void;
  brands: string[];
  categories: string[];
  genders: string[];
  registerers: string[];
  resultCount: number;
  statusCounts: Record<string, number>;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  searchPlaceholder?: string;
  countLabel?: string;
  headerAction?: React.ReactNode;
  breadcrumbRootLabel?: string;
  showCategoryNavigation?: boolean;
  catalogSamples?: Sample[];
  showStatusChips?: boolean;
  showViewModeToggle?: boolean;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

function CategoryBreadcrumb({
  rootLabel,
  activeCategory,
  originalSubCategory,
  originalSubCategoryItem,
  onNavigateHome,
  onNavigateCategory,
  onNavigateSubCategory,
}: {
  rootLabel: string;
  activeCategory: string | null;
  originalSubCategory: string | null;
  originalSubCategoryItem: string | null;
  onNavigateHome: () => void;
  onNavigateCategory: () => void;
  onNavigateSubCategory: () => void;
}) {
  const crumbs: { label: string; onClick?: () => void }[] = [{ label: rootLabel, onClick: onNavigateHome }];

  if (activeCategory) {
    crumbs.push({
      label: activeCategory,
      onClick: originalSubCategory ? onNavigateCategory : undefined,
    });
  }
  if (activeCategory === '오리지널' && originalSubCategory) {
    crumbs.push({
      label: originalSubCategory,
      onClick: originalSubCategoryItem ? onNavigateSubCategory : undefined,
    });
  }
  if (originalSubCategoryItem) {
    crumbs.push({ label: originalSubCategoryItem });
  }

  return (
    <nav aria-label="카테고리 경로" className="flex items-center gap-1.5 text-xs text-slate-400 min-h-[18px]">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <React.Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && <span className="text-slate-300 select-none">&gt;</span>}
            {crumb.onClick && !isLast ? (
              <button
                type="button"
                onClick={crumb.onClick}
                className="text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                {crumb.label}
              </button>
            ) : (
              <span className={isLast ? 'text-slate-800 font-semibold' : 'text-slate-500'}>{crumb.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default function SearchFilterBar({
  filters,
  onChange,
  brands,
  categories,
  genders,
  registerers,
  resultCount,
  statusCounts,
  viewMode,
  onViewModeChange,
  searchPlaceholder = '폴리에스터 소재 겨울 장갑',
  countLabel = '상품 수',
  headerAction,
  breadcrumbRootLabel = '홈',
  showCategoryNavigation = true,
  catalogSamples = [],
  showStatusChips = true,
  showViewModeToggle = true,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}: SearchFilterBarProps) {
  const patch = (partial: Partial<SampleFilters>) => onChange({ ...filters, ...partial });

  const activeCategory = filters.category.length === 1 ? filters.category[0] : null;

  const [regDateOpen, setRegDateOpen] = useState(false);
  const regDateFilterRef = useRef<HTMLDivElement>(null);
  const regDatePopoverRef = useRef<HTMLDivElement>(null);
  const [regDatePopoverPos, setRegDatePopoverPos] = useState({ top: 0, left: 0 });

  const regDateFilterLabel =
    !filters.regDateFrom && !filters.regDateTo
      ? '등록일: 전체'
      : filters.regDateFrom && filters.regDateTo && filters.regDateFrom === filters.regDateTo
        ? `등록일: ${filters.regDateFrom}`
        : `등록일: ${filters.regDateFrom || '…'} ~ ${filters.regDateTo || '…'}`;

  useEffect(() => {
    if (!regDateOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (regDateFilterRef.current?.contains(target) || regDatePopoverRef.current?.contains(target)) return;
      setRegDateOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [regDateOpen]);

  const resetFilters = () =>
    onChange({
      query: '',
      regDateFrom: '',
      regDateTo: '',
      brand: [],
      category: [],
      originalSubCategory: null,
      originalSubCategoryItem: null,
      color: [],
      gender: [],
      season: [],
      registerer: [],
      status: '전체',
      detailOptions: { ...EMPTY_DETAIL_OPTION_FILTERS },
    });

  return (
    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm" id="user-filter-panel">
      {showCategoryNavigation && activeCategory && (
        <CategoryBreadcrumb
          rootLabel={breadcrumbRootLabel}
          activeCategory={activeCategory}
          originalSubCategory={filters.originalSubCategory}
          originalSubCategoryItem={filters.originalSubCategoryItem}
          onNavigateHome={() => patch({ category: [], originalSubCategory: null, originalSubCategoryItem: null })}
          onNavigateCategory={() => patch({ originalSubCategory: null, originalSubCategoryItem: null })}
          onNavigateSubCategory={() => patch({ originalSubCategoryItem: null })}
        />
      )}

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

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-nowrap gap-x-2 items-center overflow-x-auto min-w-0 flex-1">
            <button
              type="button"
              onClick={resetFilters}
              className="bg-[#1e293b] hover:bg-[#0f172a] text-white text-xs font-bold py-1.5 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <CheckCircle className="w-3.5 h-3.5 text-white" />
              <span>필터 초기화</span>
            </button>
            <div className="relative shrink-0" ref={regDateFilterRef}>
              <button
                type="button"
                onClick={() => {
                  if (regDateOpen) {
                    setRegDateOpen(false);
                    return;
                  }
                  if (regDateFilterRef.current) {
                    const rect = regDateFilterRef.current.getBoundingClientRect();
                    const popoverWidth = 560;
                    let left = rect.left;
                    if (left + popoverWidth > window.innerWidth - 16) {
                      left = Math.max(16, window.innerWidth - popoverWidth - 16);
                    }
                    setRegDatePopoverPos({ top: rect.bottom + 4, left });
                  }
                  setRegDateOpen(true);
                }}
                className={`bg-white hover:bg-slate-50 border pl-3.5 pr-8 py-1.5 text-xs font-bold text-slate-700 rounded-lg focus:outline-none transition-colors cursor-pointer whitespace-nowrap ${
                  regDateOpen || filters.regDateFrom || filters.regDateTo
                    ? 'border-violet-500'
                    : 'border-slate-200 focus:border-violet-500'
                }`}
              >
                {regDateFilterLabel}
              </button>
              <ChevronDown
                className={`absolute right-2.5 top-2.5 w-3 h-3 text-slate-400 pointer-events-none transition-transform ${regDateOpen ? 'rotate-180' : ''}`}
              />
            </div>
            {regDateOpen &&
              createPortal(
                <div
                  ref={regDatePopoverRef}
                  className="fixed z-[9999]"
                  style={{ top: regDatePopoverPos.top, left: regDatePopoverPos.left }}
                >
                  <DateRangeCalendar
                    initialFrom={filters.regDateFrom}
                    initialTo={filters.regDateTo}
                    onConfirm={(from, to) => {
                      patch({ regDateFrom: from, regDateTo: to });
                      setRegDateOpen(false);
                    }}
                    onCancel={() => setRegDateOpen(false)}
                  />
                </div>,
                document.body
              )}
            <BrandFilterDropdown value={filters.brand} brands={brands} onChange={(v) => patch({ brand: v })} />
            <ColorFilterDropdown value={filters.color} onChange={(v) => patch({ color: v })} />
            <FilterDropdown label="성별" value={filters.gender} options={genders} onChange={(v) => patch({ gender: v })} />
            <FilterDropdown label="시즌" value={filters.season} options={[...SEASON_FILTER_OPTIONS]} onChange={(v) => patch({ season: v })} />
            <FilterDropdown label="등록자" value={filters.registerer} options={registerers} onChange={(v) => patch({ registerer: v })} popoverWidth={240} />
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-[11px] text-slate-400 font-extrabold font-mono uppercase tracking-wide whitespace-nowrap">
              {countLabel}: {resultCount.toLocaleString()}개
            </span>
            {onPageSizeChange && pageSize != null && (
              <div className="relative">
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="appearance-none bg-white hover:bg-slate-50 border border-slate-200 pl-3 pr-7 py-1.5 text-[11px] font-bold text-slate-700 rounded-lg focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                >
                  {pageSizeOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}개씩
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
            )}
            {showViewModeToggle && (
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
            )}
          </div>
        </div>

        {showCategoryNavigation && (
          <CategoryTabBar
            categories={categories}
            activeCategory={activeCategory}
            originalSubCategory={filters.originalSubCategory}
            originalSubCategoryItem={filters.originalSubCategoryItem}
            detailOptions={filters.detailOptions}
            samples={catalogSamples}
            onCategoryChange={(category) =>
              patch({
                category: category ? [category] : [],
                originalSubCategory: category === '오리지널' ? filters.originalSubCategory : null,
                originalSubCategoryItem: category === '오리지널' ? filters.originalSubCategoryItem : null,
                detailOptions: { ...EMPTY_DETAIL_OPTION_FILTERS },
              })
            }
            onSubCategoryChange={(sub) =>
              patch({
                originalSubCategory: sub,
                originalSubCategoryItem: null,
                detailOptions: { ...EMPTY_DETAIL_OPTION_FILTERS },
              })
            }
            onSubCategoryItemChange={(item) =>
              patch({
                originalSubCategory: '소품',
                originalSubCategoryItem: item,
                detailOptions: { ...EMPTY_DETAIL_OPTION_FILTERS },
              })
            }
            onDetailOptionsChange={(detailOptions) => patch({ detailOptions })}
          />
        )}

        {showStatusChips && (
        <StatusChipBar
          options={STATUS_CHIP_OPTIONS.map(({ key, label }) => ({ key, label }))}
          active={filters.status}
          counts={statusCounts}
          onChange={(status) => patch({ status: status as SampleFilters['status'] })}
          showTopBorder={false}
        />
        )}
      </div>
    </div>
  );
}
