export const USER_AUTH_KEY = 'csb_user_auth_member_id';
export const LOCKER_KEY_PREFIX = 'csb_user_locker_';
export const RENTAL_DAYS = 28;
export const DUE_SOON_DAYS = 3;

export type UserTab = 'home' | 'rental' | 'rental_status' | 'locker';

export const STATUS_CHIP_OPTIONS = [
  { key: '전체', label: '전체' },
  { key: '대여가능', label: '대여가능' },
  { key: '대여중', label: '대여중' },
  { key: '연체중', label: '연체' },
  { key: '부평보관', label: '보관' },
  { key: '분실', label: '분실' },
] as const;
