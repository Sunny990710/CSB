import { Sample, sampleStatusLabel } from '@/types';

export interface SampleFilters {
  query: string;
  brand: string;
  category: string;
  country: string;
  gender: string;
  season: string;
  status: string;
}

export const DEFAULT_FILTERS: SampleFilters = {
  query: '',
  brand: '전체',
  category: '전체',
  country: '전체',
  gender: '전체',
  season: '전체',
  status: '전체',
};

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
    if (filters.brand !== '전체' && s.brand !== filters.brand) return false;
    if (filters.category !== '전체' && s.category !== filters.category) return false;
    if (filters.country !== '전체' && s.country !== filters.country) return false;
    if (filters.gender !== '전체' && s.gender !== filters.gender) return false;
    if (filters.season !== '전체' && s.season !== filters.season) return false;
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
