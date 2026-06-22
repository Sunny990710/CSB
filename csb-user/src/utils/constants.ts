export const USER_AUTH_KEY = 'csb_user_auth_member_id';
export const LOCKER_KEY_PREFIX = 'csb_user_locker_';
export const AVAILABILITY_ALERTS_KEY_PREFIX = 'csb_user_availability_alerts_';
export const BRAND_FAVORITES_KEY = 'csb_user_brand_favorites';
export const EXAMPLE_BRANDS = ['후아유', '스파오', '뉴발란스'] as const;
export const SEASON_FILTER_OPTIONS = ['전체', '봄', '여름', '가을', '겨울', '사계절'] as const;

/** 오리지널 카테고리 선택 시 노출되는 세부 카테고리 */
export const ORIGINAL_SUB_CATEGORIES = [
  '소품',
  '캐주얼',
  '신사복',
  '숙녀복',
  '자사소장품',
  '스포츠',
  '문양',
  '내의',
  '아동복',
] as const;

/** 오리지널 > 소품 선택 시 노출되는 하위 항목 */
export const ORIGINAL_ACCESSORY_ITEMS = [
  '양말',
  '가방',
  '손수건',
  '벨트',
  '장갑',
  '모자',
  '스카프',
  '머플러',
  '넥타이',
  '신발',
  '기타',
] as const;

/** 세부 카테고리별 하위 항목 (현재는 소품만) */
export const ORIGINAL_SUB_CATEGORY_CHILDREN: Partial<
  Record<(typeof ORIGINAL_SUB_CATEGORIES)[number], readonly string[]>
> = {
  소품: ORIGINAL_ACCESSORY_ITEMS,
};

export function getOriginalSubCategoryChildren(subCategory: string | null): readonly string[] {
  if (!subCategory) return [];
  return ORIGINAL_SUB_CATEGORY_CHILDREN[subCategory as (typeof ORIGINAL_SUB_CATEGORIES)[number]] ?? [];
}

export const RENTAL_DAYS = 28;
export const DUE_SOON_DAYS = 3;
export const DEFAULT_RENTAL_FEE = 15000;

/** 대여료 표시용 — rentalFee 없으면 기본 15,000원 (판매가 price 와 구분) */
export function getDisplayRentalFee(sample: { rentalFee?: number; price?: number }): number {
  const fee = sample.rentalFee;
  if (fee != null && Number.isFinite(Number(fee))) return Number(fee);
  return DEFAULT_RENTAL_FEE;
}

export type UserTab = 'home' | 'rental' | 'rental_status' | 'locker';

export const STATUS_CHIP_OPTIONS = [
  { key: '전체', label: '전체' },
  { key: '대여가능', label: '대여가능' },
  { key: '대여중', label: '대여중' },
  { key: '연체중', label: '연체' },
  { key: '부평보관', label: '보관' },
  { key: '분실', label: '분실' },
] as const;
