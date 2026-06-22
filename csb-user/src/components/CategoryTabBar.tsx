import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Sample } from '@/types';
import { ORIGINAL_SUB_CATEGORIES, getOriginalSubCategoryChildren } from '../utils/constants';
import {
  DETAIL_OPTION_KEYS,
  DETAIL_OPTION_LABELS,
  DetailOptionFilters,
  DetailOptionKey,
  collectDetailOptionValues,
} from '../utils/detailOptions';
import FilterDropdown from './FilterDropdown';

const CATEGORY_ORDER = ['오리지널', '유형화샘플', 'EP샘플', '자사샘플', '중국샘플'];
const TAB_GAP = 'gap-x-6';
const ROW_H = 'h-9';

interface CategoryTabBarProps {
  categories: string[];
  activeCategory: string | null;
  originalSubCategory: string | null;
  originalSubCategoryItem: string | null;
  detailOptions: DetailOptionFilters;
  samples: Sample[];
  onCategoryChange: (category: string | null) => void;
  onSubCategoryChange: (sub: string | null) => void;
  onSubCategoryItemChange: (item: string | null) => void;
  onDetailOptionsChange: (next: DetailOptionFilters) => void;
}

function sortCategories(names: string[]): string[] {
  const set = new Set(names.filter((n) => n && n !== '전체'));
  return [...set].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b, 'ko');
  });
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center ${ROW_H} shrink-0 text-sm whitespace-nowrap cursor-pointer transition-colors ${
        active ? 'text-slate-900 font-semibold' : 'text-slate-500 font-medium hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

function DetailOptionsTab({
  open,
  highlighted,
  onClick,
}: {
  open: boolean;
  highlighted: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 ${ROW_H} shrink-0 text-sm whitespace-nowrap cursor-pointer transition-colors ${
        open || highlighted
          ? 'text-slate-900 font-semibold'
          : 'text-slate-500 font-medium hover:text-slate-700'
      }`}
    >
      상세 옵션
      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

function TabRow({ children }: { children: React.ReactNode }) {
  return <div className={`flex items-center ${TAB_GAP} ${ROW_H}`}>{children}</div>;
}

export default function CategoryTabBar({
  categories,
  activeCategory,
  originalSubCategory,
  originalSubCategoryItem,
  detailOptions,
  samples,
  onCategoryChange,
  onSubCategoryChange,
  onSubCategoryItemChange,
  onDetailOptionsChange,
}: CategoryTabBarProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const mainItems = sortCategories(categories);
  const showSubRow = activeCategory === '오리지널';
  const subCategoryItems = getOriginalSubCategoryChildren(originalSubCategory);
  const showItemRow = showSubRow && originalSubCategory === '소품' && subCategoryItems.length > 0;

  useEffect(() => {
    setDetailOpen(false);
  }, [activeCategory, originalSubCategory, originalSubCategoryItem]);

  const optionChoices = useMemo(
    () =>
      Object.fromEntries(
        DETAIL_OPTION_KEYS.map((key) => [key, collectDetailOptionValues(samples, key)])
      ) as Record<DetailOptionKey, string[]>,
    [samples]
  );

  const hasActiveDetailFilters = DETAIL_OPTION_KEYS.some((key) => detailOptions[key].length > 0);

  const patchDetail = (key: DetailOptionKey, values: string[]) => {
    onDetailOptionsChange({ ...detailOptions, [key]: values });
  };

  const toggleDetailOpen = () => setDetailOpen((prev) => !prev);

  const detailOptionsTab = (
    <DetailOptionsTab
      open={detailOpen}
      highlighted={hasActiveDetailFilters}
      onClick={toggleDetailOpen}
    />
  );

  const detailFilterRow = detailOpen && (showSubRow || showItemRow) && (
    <TabRow>
      <span
        className={`inline-flex items-center ${ROW_H} shrink-0 text-sm font-semibold text-slate-900 whitespace-nowrap`}
      >
        상세 옵션
      </span>
      {DETAIL_OPTION_KEYS.map((key) => (
        <FilterDropdown
          key={key}
          variant="inline"
          label={DETAIL_OPTION_LABELS[key]}
          value={detailOptions[key]}
          options={optionChoices[key]}
          onChange={(values) => patchDetail(key, values)}
          popoverWidth={220}
        />
      ))}
    </TabRow>
  );

  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto">
        <div className="inline-block min-w-full align-top space-y-0">
          <TabRow>
            <TabButton label="전체" active={!activeCategory} onClick={() => onCategoryChange(null)} />
            {mainItems.map((name) => (
              <TabButton
                key={name}
                label={name}
                active={activeCategory === name}
                onClick={() => onCategoryChange(name)}
              />
            ))}
          </TabRow>

          {showSubRow && (
            <TabRow>
              <TabButton label="전체" active={!originalSubCategory} onClick={() => onSubCategoryChange(null)} />
              {ORIGINAL_SUB_CATEGORIES.map((name) => (
                <TabButton
                  key={name}
                  label={name}
                  active={originalSubCategory === name}
                  onClick={() => onSubCategoryChange(name)}
                />
              ))}
              {detailOptionsTab}
            </TabRow>
          )}

          {showItemRow && (
            <TabRow>
              <TabButton
                label="전체"
                active={!originalSubCategoryItem}
                onClick={() => onSubCategoryItemChange(null)}
              />
              {subCategoryItems.map((name) => (
                <TabButton
                  key={name}
                  label={name}
                  active={originalSubCategoryItem === name}
                  onClick={() => onSubCategoryItemChange(name)}
                />
              ))}
              {detailOptionsTab}
            </TabRow>
          )}

          {detailFilterRow}
        </div>
      </div>
    </div>
  );
}
