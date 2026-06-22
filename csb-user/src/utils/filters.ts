import { Sample, Rental, sampleStatusLabel } from '@/types';
import { sampleMatchesColor } from './colorPalette';
import { sampleMatchesSeason } from './seasonFilter';
import { matchesMultiFilter, matchesMultiFilterExact } from './filterMultiSelect';
import { sampleMatchesOriginalSubCategory } from './originalSubCategory';
import { DetailOptionFilters, EMPTY_DETAIL_OPTION_FILTERS, sampleMatchesDetailOptions } from './detailOptions';

export interface SampleFilters {
  query: string;
  regDateFrom: string;
  regDateTo: string;
  brand: string[];
  category: string[];
  originalSubCategory: string | null;
  originalSubCategoryItem: string | null;
  color: string[];
  gender: string[];
  season: string[];
  registerer: string[];
  status: string;
  detailOptions: DetailOptionFilters;
}

export const DEFAULT_FILTERS: SampleFilters = {
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
};

function getRegDateKey(regDate?: string) {
  return (regDate || '').substring(0, 10);
}

export function uniqueValues(samples: Sample[], key: keyof Sample): string[] {
  const set = new Set<string>();
  for (const s of samples) {
    const v = s[key];
    if (typeof v === 'string' && v.trim()) set.add(v.trim());
  }
  return ['전체', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))];
}

export function filterSamples(samples: Sample[], filters: SampleFilters): Sample[] {
  const q = filters.query.trim().toLowerCase();
  return samples.filter((s) => {
    if (s.useYn !== '사용') return false;
    if (filters.status !== '전체' && s.status !== filters.status) return false;
    if (!matchesMultiFilterExact(filters.brand, s.brand)) return false;
    if (!matchesMultiFilterExact(filters.category, s.category)) return false;
    if (
      filters.originalSubCategory &&
      s.category === '오리지널' &&
      !sampleMatchesOriginalSubCategory(s, [filters.originalSubCategory])
    ) {
      return false;
    }
    if (
      filters.originalSubCategoryItem &&
      s.category === '오리지널' &&
      !sampleMatchesOriginalSubCategory(s, [filters.originalSubCategoryItem])
    ) {
      return false;
    }
    if (!matchesMultiFilter(filters.color, (c) => sampleMatchesColor(s.color, c))) return false;
    if (!matchesMultiFilterExact(filters.gender, s.gender)) return false;
    if (!matchesMultiFilter(filters.season, (season) => sampleMatchesSeason(s.season, season))) return false;
    if (!matchesMultiFilterExact(filters.registerer, s.registerer)) return false;
    const sampleDate = getRegDateKey(s.regDate);
    if (filters.regDateFrom && (!sampleDate || sampleDate < filters.regDateFrom)) return false;
    if (filters.regDateTo && (!sampleDate || sampleDate > filters.regDateTo)) return false;
    if (!sampleMatchesDetailOptions(s, filters.detailOptions)) return false;
    if (!q) return true;
    const hay = [
      s.code,
      s.name,
      s.brand,
      s.color,
      s.material,
      s.category,
      s.specialBrand,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function statusCounts(samples: Sample[]): Record<string, number> {
  const counts: Record<string, number> = { 전체: samples.length };
  for (const s of samples) {
    const label = sampleStatusLabel(s.status);
    counts[label] = (counts[label] || 0) + 1;
    counts[s.status] = (counts[s.status] || 0) + 1;
  }
  return counts;
}

function hasActiveSampleFilters(filters: SampleFilters): boolean {
  return (
    !!filters.query.trim() ||
    !!filters.regDateFrom ||
    !!filters.regDateTo ||
    filters.brand.length > 0 ||
    filters.category.length > 0 ||
    !!filters.originalSubCategory ||
    !!filters.originalSubCategoryItem ||
    filters.color.length > 0 ||
    filters.gender.length > 0 ||
    filters.season.length > 0 ||
    filters.registerer.length > 0
  );
}

/** 대여 건 목록 — 연결된 샘플 기준으로 SearchFilterBar 필터 적용 */
export function filterRentalsBySampleFilters(
  rentals: Rental[],
  sampleByCode: Map<string, Sample>,
  filters: SampleFilters
): Rental[] {
  const sampleFilters: SampleFilters = { ...filters, status: '전체' };
  return rentals.filter((rental) => {
    const sample = sampleByCode.get(rental.sampleCode);
    if (sample) {
      return filterSamples([sample], sampleFilters).length > 0;
    }
    if (!hasActiveSampleFilters(filters)) return true;
    const q = filters.query.trim().toLowerCase();
    if (!q) return false;
    const hay = [rental.sampleCode, rental.sampleName, rental.sampleBrand].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
}
