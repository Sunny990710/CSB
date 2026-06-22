import { Sample } from '@/types';

export const DETAIL_OPTION_KEYS = ['fit', 'material', 'neckline', 'pattern', 'style'] as const;
export type DetailOptionKey = (typeof DETAIL_OPTION_KEYS)[number];

export const DETAIL_OPTION_LABELS: Record<DetailOptionKey, string> = {
  fit: '핏',
  material: '소재',
  neckline: '넥라인',
  pattern: '패턴',
  style: '스타일',
};

export type DetailOptionFilters = Record<DetailOptionKey, string[]>;

export const EMPTY_DETAIL_OPTION_FILTERS: DetailOptionFilters = {
  fit: [],
  material: [],
  neckline: [],
  pattern: [],
  style: [],
};

/** 상세 옵션 > 핏 고정 필터값 */
export const FIT_FILTER_OPTIONS = ['슬림핏', '레귤러핏', '오버핏'] as const;

const FIT_ALIASES: Record<(typeof FIT_FILTER_OPTIONS)[number], string[]> = {
  슬림핏: ['슬림핏', '슬림', 'slim', 'slim fit', 'slimfit', 'skinny'],
  레귤러핏: ['레귤러핏', '레귤러', 'regular', 'regular fit', 'regularfit', 'standard fit'],
  오버핏: ['오버핏', '오버', 'over', 'over fit', 'overfit', 'oversized', 'loose fit', '루즈'],
};

/** 상세 옵션 > 스타일 고정 필터값 */
export const STYLE_FILTER_OPTIONS = [
  '캐주얼',
  '미니멀',
  '시크',
  '클래식',
  '프레피',
  '로맨틱',
  '러블리',
  '페미닌',
  '스트릿',
  '스포티',
  '고프코어',
  '워크웨어',
  '레트로',
  '빈티지',
  '에스닉',
  '하이틴',
] as const;

const STYLE_ALIASES: Record<(typeof STYLE_FILTER_OPTIONS)[number], string[]> = {
  캐주얼: ['캐주얼', 'casual'],
  미니멀: ['미니멀', 'minimal', 'minimalist'],
  시크: ['시크', 'chic', 'sleek'],
  클래식: ['클래식', 'classic', 'formal'],
  프레피: ['프레피', 'preppy', 'prep'],
  로맨틱: ['로맨틱', 'romantic', 'romance'],
  러블리: ['러블리', 'lovely', 'cute'],
  페미닌: ['페미닌', 'feminine', 'femme'],
  스트릿: ['스트릿', 'street', 'streetwear', 'urban'],
  스포티: ['스포티', 'sporty', 'sport', 'athletic', 'outdoor'],
  고프코어: ['고프코어', 'gorpcore', 'gorp', 'outdoor'],
  워크웨어: ['워크웨어', 'workwear', 'utility'],
  레트로: ['레트로', 'retro'],
  빈티지: ['빈티지', 'vintage'],
  에스닉: ['에스닉', 'ethnic', 'bohemian', 'boho'],
  하이틴: ['하이틴', 'high teen', 'highteen', 'y2k'],
};

/** 상세 옵션 > 패턴 고정 필터값 */
export const PATTERN_FILTER_OPTIONS = [
  '단색',
  '로고/그래픽',
  '스트라이프',
  '패치워크',
  '체크',
  '컬러블록',
  '카모플라쥬',
  '플라워',
  '도트',
  '캐릭터',
  '포토프린트',
  '애니멀패턴',
  '체커보드',
  '팝아트',
  '드로잉',
  '타이다이',
  '그라데이션',
  '페이즐리',
  '특수소재',
] as const;

const PATTERN_ALIASES: Record<(typeof PATTERN_FILTER_OPTIONS)[number], string[]> = {
  단색: ['단색', '무지', 'solid', 'plain'],
  '로고/그래픽': ['로고', '그래픽', 'logo', 'graphic', 'lettering', '레터링', 'print'],
  스트라이프: ['스트라이프', 'stripe', 'striped'],
  패치워크: ['패치워크', 'patchwork', 'patch'],
  체크: ['체크', 'check', 'plaid', 'gingham', 'tartan'],
  컬러블록: ['컬러블록', 'color block', 'colorblock'],
  카모플라쥬: ['카모', '카모플라쥬', 'camo', 'camouflage'],
  플라워: ['플라워', 'flower', 'floral', 'bloom'],
  도트: ['도트', 'dot', 'polka', 'polka dot'],
  캐릭터: ['캐릭터', 'character', 'cartoon'],
  포토프린트: ['포토', '포토프린트', 'photo print', 'photoprint'],
  애니멀패턴: ['애니멀', '애니멀패턴', 'animal', 'leopard', 'zebra', 'snake'],
  체커보드: ['체커보드', 'checkerboard', 'checker'],
  팝아트: ['팝아트', 'pop art', 'popart'],
  드로잉: ['드로잉', 'drawing', 'illustration', 'sketch'],
  타이다이: ['타이다이', 'tie dye', 'tie-dye', 'tiedye'],
  그라데이션: ['그라데이션', 'gradient', 'ombre'],
  페이즐리: ['페이즐리', 'paisley'],
  특수소재: ['특수소재', 'special material', 'special fabric'],
};

/** 상세 옵션 > 넥라인 고정 필터값 */
export const NECKLINE_FILTER_OPTIONS = [
  '라운드넥',
  '브이넥',
  '스퀘어',
  '보트넥',
  '터틀넥/폴라',
  '후드',
  '일반카라',
  '오픈카라',
  '헨리/차이나카라',
  '반집업 카라',
  '슬릿',
  '오프숄더',
] as const;

const NECKLINE_ALIASES: Record<(typeof NECKLINE_FILTER_OPTIONS)[number], string[]> = {
  라운드넥: ['라운드넥', '라운드', 'round neck', 'crew neck', 'crewneck'],
  브이넥: ['브이넥', 'v넥', 'v-neck', 'v neck', 'vneck'],
  스퀘어: ['스퀘어', 'square neck', 'square'],
  보트넥: ['보트넥', 'boat neck', 'boatneck'],
  '터틀넥/폴라': ['터틀넥', '폴라', 'turtle', 'turtleneck', 'polo neck', 'poloneck'],
  후드: ['후드', 'hood', 'hooded'],
  일반카라: ['일반카라', '카라', 'collar', 'classic collar'],
  오픈카라: ['오픈카라', 'open collar'],
  '헨리/차이나카라': ['헨리', '차이나카라', 'henley', 'china collar', 'mandarin collar'],
  '반집업 카라': ['반집업', '반집업 카라', 'half zip', 'quarter zip', 'zip collar'],
  슬릿: ['슬릿', 'slit', 'keyhole'],
  오프숄더: ['오프숄더', 'off shoulder', 'off-shoulder', 'offshoulder'],
};

/** 상세 옵션 > 소재 고정 필터값 */
export const MATERIAL_FILTER_OPTIONS = [
  '면',
  '데님',
  '니트',
  '폴리에스테르',
  '린넨',
  '울',
  '나일론',
  '아크릴',
  '레이온',
  '스판',
  '실크',
  '쉬폰',
  '캐시미어',
  '기모',
  '벨벳',
  '코듀로이',
  '스웨이드',
  '메시',
  '앙고라',
] as const;

const MATERIAL_ALIASES: Record<(typeof MATERIAL_FILTER_OPTIONS)[number], string[]> = {
  면: ['면', 'cotton', '코튼'],
  데님: ['데님', 'denim'],
  니트: ['니트', 'knit', 'knitting', 'ribbing', 'knit ribbing'],
  폴리에스테르: ['폴리에스테르', '폴리에스터', 'polyester', 'poly'],
  린넨: ['린넨', 'linen'],
  울: ['울', 'wool'],
  나일론: ['나일론', 'nylon'],
  아크릴: ['아크릴', 'acrylic'],
  레이온: ['레이온', 'rayon'],
  스판: ['스판', 'spandex', 'elastane'],
  실크: ['실크', 'silk'],
  쉬폰: ['쉬폰', 'chiffon'],
  캐시미어: ['캐시미어', 'cashmere'],
  기모: ['기모', 'fleece', 'brushed'],
  벨벳: ['벨벳', 'velvet'],
  코듀로이: ['코듀로이', 'corduroy'],
  스웨이드: ['스웨이드', 'suede'],
  메시: ['메시', 'mesh'],
  앙고라: ['앙고라', 'angora'],
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function addToken(set: Set<string>, value: unknown) {
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (trimmed) set.add(trimmed);
}

function sampleTagValues(sample: Sample, key: DetailOptionKey): string[] {
  const tags = sample.aiTags;
  if (!tags) return [];

  switch (key) {
    case 'fit':
      return [...(tags.fit || []), sample.name || '', sample.description || ''].filter(Boolean);
    case 'material':
      return [...(tags.material || []), sample.material || ''].filter(Boolean);
    case 'neckline':
      return [...(tags.design || []), sample.name || '', sample.description || ''];
    case 'pattern':
      return [...(tags.design || []), sample.name || '', sample.description || ''];
    case 'style':
      return [...(tags.style || []), sample.name || '', sample.description || ''].filter(Boolean);
    default:
      return [];
  }
}

export function collectDetailOptionValues(samples: Sample[], key: DetailOptionKey): string[] {
  if (key === 'fit') {
    return ['전체', ...FIT_FILTER_OPTIONS];
  }
  if (key === 'material') {
    return ['전체', ...MATERIAL_FILTER_OPTIONS];
  }
  if (key === 'neckline') {
    return ['전체', ...NECKLINE_FILTER_OPTIONS];
  }
  if (key === 'pattern') {
    return ['전체', ...PATTERN_FILTER_OPTIONS];
  }
  if (key === 'style') {
    return ['전체', ...STYLE_FILTER_OPTIONS];
  }

  const set = new Set<string>();

  for (const sample of samples) {
    for (const value of sampleTagValues(sample, key)) {
      addToken(set, value);
    }
  }

  return ['전체', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))];
}

function tokensMatch(haystack: string[], needle: string): boolean {
  return haystack.some((token) => token.includes(needle) || needle.includes(token));
}

function sampleMatchesFit(sample: Sample, selected: string[]): boolean {
  const haystack = sampleTagValues(sample, 'fit').map(normalizeToken);
  if (haystack.length === 0) return false;

  return selected.some((preset) => {
    const aliases = FIT_ALIASES[preset as (typeof FIT_FILTER_OPTIONS)[number]] || [preset];
    return aliases.some((alias) => tokensMatch(haystack, normalizeToken(alias)));
  });
}

function sampleMatchesMaterial(sample: Sample, selected: string[]): boolean {
  const haystack = sampleTagValues(sample, 'material').map(normalizeToken);
  if (haystack.length === 0) return false;

  return selected.some((preset) => {
    const aliases = MATERIAL_ALIASES[preset as (typeof MATERIAL_FILTER_OPTIONS)[number]] || [preset];
    return aliases.some((alias) => tokensMatch(haystack, normalizeToken(alias)));
  });
}

function sampleMatchesNeckline(sample: Sample, selected: string[]): boolean {
  const haystack = sampleTagValues(sample, 'neckline').map(normalizeToken);
  if (haystack.length === 0) return false;

  return selected.some((preset) => {
    const aliases = NECKLINE_ALIASES[preset as (typeof NECKLINE_FILTER_OPTIONS)[number]] || [preset];
    return aliases.some((alias) => tokensMatch(haystack, normalizeToken(alias)));
  });
}

function sampleMatchesPattern(sample: Sample, selected: string[]): boolean {
  const haystack = sampleTagValues(sample, 'pattern').map(normalizeToken);
  if (haystack.length === 0) return false;

  return selected.some((preset) => {
    const aliases = PATTERN_ALIASES[preset as (typeof PATTERN_FILTER_OPTIONS)[number]] || [preset];
    return aliases.some((alias) => tokensMatch(haystack, normalizeToken(alias)));
  });
}

function sampleMatchesStyle(sample: Sample, selected: string[]): boolean {
  const haystack = sampleTagValues(sample, 'style').map(normalizeToken);
  if (haystack.length === 0) return false;

  return selected.some((preset) => {
    const aliases = STYLE_ALIASES[preset as (typeof STYLE_FILTER_OPTIONS)[number]] || [preset];
    return aliases.some((alias) => tokensMatch(haystack, normalizeToken(alias)));
  });
}

export function sampleMatchesDetailOption(sample: Sample, key: DetailOptionKey, selected: string[]): boolean {
  if (selected.length === 0) return true;

  if (key === 'fit') {
    return sampleMatchesFit(sample, selected);
  }
  if (key === 'material') {
    return sampleMatchesMaterial(sample, selected);
  }
  if (key === 'neckline') {
    return sampleMatchesNeckline(sample, selected);
  }
  if (key === 'pattern') {
    return sampleMatchesPattern(sample, selected);
  }
  if (key === 'style') {
    return sampleMatchesStyle(sample, selected);
  }

  const haystack = sampleTagValues(sample, key).map(normalizeToken);
  if (haystack.length === 0) return false;

  return selected.some((value) => {
    const needle = normalizeToken(value);
    return haystack.some((token) => token.includes(needle) || needle.includes(token));
  });
}

export function sampleMatchesDetailOptions(sample: Sample, filters: DetailOptionFilters): boolean {
  return DETAIL_OPTION_KEYS.every((key) => sampleMatchesDetailOption(sample, key, filters[key]));
}
