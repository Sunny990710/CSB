/** 다중 선택 필터 라벨 */
export function formatMultiFilterLabel(label: string, values: string[]): string {
  if (values.length === 0) return `${label}: 전체`;
  if (values.length === 1) return values[0];
  return `${label} ${values.length}`;
}

export function toggleMultiFilterValue(current: string[], option: string): string[] {
  if (current.includes(option)) return current.filter((v) => v !== option);
  return [...current, option];
}

export function matchesMultiFilter(values: string[], match: (item: string) => boolean): boolean {
  if (values.length === 0) return true;
  return values.some(match);
}

export function matchesMultiFilterExact(values: string[], sampleValue: string | undefined): boolean {
  if (values.length === 0) return true;
  const v = (sampleValue || '').trim();
  return values.includes(v);
}
