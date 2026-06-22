/** 상품 필터용 샘플 카테고리 (카테고리 관리 트리의 국가 노드와 별개) */
export const SAMPLE_CATEGORY_ORDER = ['오리지널', '유형화샘플', 'EP샘플', '자사샘플', '중국샘플'] as const;

export const SAMPLE_CATEGORY_FILTER_OPTIONS: string[] = [...SAMPLE_CATEGORY_ORDER];

export const SAMPLE_CATEGORIES_BY_COUNTRY: Record<string, string[]> = {
  한국: ['오리지널', '유형화샘플', 'EP샘플', '자사샘플'],
  중국: ['중국샘플'],
};

export function sortSampleCategories(arr: string[]): string[] {
  return [...arr].sort((a, b) => {
    const ia = SAMPLE_CATEGORY_ORDER.indexOf(a as (typeof SAMPLE_CATEGORY_ORDER)[number]);
    const ib = SAMPLE_CATEGORY_ORDER.indexOf(b as (typeof SAMPLE_CATEGORY_ORDER)[number]);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

export function categoryFilterOptionsForCountries(selectedCountries: string[]): string[] {
  if (selectedCountries.length === 0) return SAMPLE_CATEGORY_FILTER_OPTIONS;
  const set = new Set<string>();
  for (const country of selectedCountries) {
    for (const cat of SAMPLE_CATEGORIES_BY_COUNTRY[country] || []) set.add(cat);
  }
  return sortSampleCategories(Array.from(set));
}
