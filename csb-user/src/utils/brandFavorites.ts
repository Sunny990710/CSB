import { BRAND_FAVORITES_KEY } from './constants';

export function getBrandFavorites(): string[] {
  try {
    const raw = localStorage.getItem(BRAND_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((b) => typeof b === 'string') : [];
  } catch {
    return [];
  }
}

export function saveBrandFavorites(brands: string[]): void {
  localStorage.setItem(BRAND_FAVORITES_KEY, JSON.stringify(brands));
}

export function toggleBrandFavorite(brand: string): string[] {
  const current = getBrandFavorites();
  const next = current.includes(brand) ? current.filter((b) => b !== brand) : [...current, brand];
  saveBrandFavorites(next);
  return next;
}

export function mergeBrandOptions(fromSamples: string[]): string[] {
  const set = new Set<string>();
  for (const b of fromSamples) {
    if (b && b !== '전체') set.add(b.trim());
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
}
