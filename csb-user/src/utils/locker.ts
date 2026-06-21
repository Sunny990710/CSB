import { LOCKER_KEY_PREFIX } from './constants';

export function getLockerCodes(memberId: string): string[] {
  try {
    const raw = localStorage.getItem(`${LOCKER_KEY_PREFIX}${memberId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

export function saveLockerCodes(memberId: string, codes: string[]): void {
  localStorage.setItem(`${LOCKER_KEY_PREFIX}${memberId}`, JSON.stringify(codes));
}

export function toggleLockerCode(memberId: string, code: string): string[] {
  const current = getLockerCodes(memberId);
  const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
  saveLockerCodes(memberId, next);
  return next;
}

export function removeLockerCode(memberId: string, code: string): string[] {
  const next = getLockerCodes(memberId).filter((c) => c !== code);
  saveLockerCodes(memberId, next);
  return next;
}

export function clearLockerCodes(memberId: string): void {
  localStorage.removeItem(`${LOCKER_KEY_PREFIX}${memberId}`);
}
