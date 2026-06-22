const SEASON_ALIASES: Record<string, string[]> = {
  봄: ['봄', 'spring', 'sp'],
  여름: ['여름', 'summer', 'su'],
  가을: ['가을', 'fall', 'autumn', 'fa'],
  겨울: ['겨울', 'winter', 'wi', 'w'],
  사계절: ['사계절', 'all', 'all season', '4season', 'four season', '연중', 'year round', 'year-round'],
};

/** SS/FW 등 패션 시즌 코드 */
const SEASON_CODES: Record<string, string[]> = {
  봄: ['ss'],
  여름: ['ss'],
  가을: ['fw'],
  겨울: ['fw'],
};

export function sampleMatchesSeason(sampleSeason: string | undefined, filterSeason: string): boolean {
  if (filterSeason === '전체') return true;
  const raw = (sampleSeason || '').trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();

  if (raw === filterSeason || lower === filterSeason.toLowerCase()) return true;

  const aliases = SEASON_ALIASES[filterSeason] ?? [filterSeason];
  if (aliases.some((a) => lower === a.toLowerCase() || raw.includes(a))) return true;

  const codes = SEASON_CODES[filterSeason] ?? [];
  if (codes.some((c) => lower === c)) return true;

  return false;
}
