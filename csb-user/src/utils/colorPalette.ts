export type ColorSwatch = {
  name: string;
  hex: string;
  border?: boolean;
};

/** 홈 컬러 필터 팔레트 (2열 레이아웃) */
export const COLOR_PALETTE_ROWS: ColorSwatch[][] = [
  [{ name: '블랙', hex: '#1a1a1a' }, { name: '그레이', hex: '#9ca3af' }],
  [{ name: '아이보리', hex: '#f5f0e8' }, { name: '화이트', hex: '#ffffff', border: true }],
  [{ name: '블루', hex: '#2563eb' }, { name: '네이비', hex: '#1e3a5f' }],
  [{ name: '다크그레이', hex: '#4b5563' }, { name: '브라운', hex: '#7c4a2d' }],
  [{ name: '베이지', hex: '#d4b896' }, { name: '핑크', hex: '#f472b6' }],
  [{ name: '레드', hex: '#dc2626' }, { name: '카키', hex: '#6b7c3f' }],
  [{ name: '그린', hex: '#16a34a' }, { name: '옐로우', hex: '#facc15' }],
  [{ name: '민트', hex: '#2dd4bf' }, { name: '오트밀', hex: '#e8dcc8' }],
  [{ name: '퍼플', hex: '#9333ea' }, { name: '스카이블루', hex: '#38bdf8' }],
  [{ name: '다크네이비', hex: '#0f172a' }, { name: '카멜', hex: '#c4956a' }],
  [{ name: '오렌지', hex: '#f97316' }, { name: '버건디', hex: '#7f1d1d' }],
  [{ name: '다크블루', hex: '#1e40af' }, { name: '라이트핑크', hex: '#fbcfe8' }],
  [{ name: '다크브라운', hex: '#4a2c17' }, { name: '라이트그레이', hex: '#d1d5db' }],
  [{ name: '라임', hex: '#84cc16' }, { name: '라벤더', hex: '#c4b5fd' }],
  [{ name: '다크그린', hex: '#14532d' }, { name: '브릭', hex: '#b45309' }],
  [{ name: '라이트그린', hex: '#4ade80' }, { name: '피치', hex: '#fdba74' }],
  [{ name: '라이트옐로우', hex: '#fef08a' }, { name: '머스타드', hex: '#ca8a04' }],
  [{ name: '다크베이지', hex: '#a89078' }, { name: '올리브그린', hex: '#556b2f' }],
  [{ name: '라이트브라운', hex: '#a67c52' }, { name: '다크핑크', hex: '#be185d' }],
  [{ name: '딥레드', hex: '#991b1b' }, { name: '다크오렌지', hex: '#c2410c' }],
  [{ name: '라이트오렌지', hex: '#fb923c' }, { name: '로즈골드', hex: '#b76e79' }],
  [{ name: '실버', hex: '#c0c0c0' }],
];

export const COLOR_PALETTE: ColorSwatch[] = COLOR_PALETTE_ROWS.flat();

export function getColorHex(name: string): string | undefined {
  if (name === '전체') return undefined;
  return COLOR_PALETTE.find((c) => c.name === name)?.hex;
}

export function sampleMatchesColor(sampleColor: string | undefined, filterColor: string): boolean {
  if (filterColor === '전체') return true;
  const c = (sampleColor || '').toLowerCase();
  const f = filterColor.toLowerCase();
  return c === f || c.includes(f);
}
