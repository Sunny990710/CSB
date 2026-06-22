import { AVAILABILITY_ALERTS_KEY_PREFIX } from './constants';

export function getLocalAvailabilityAlertCodes(memberId: string): string[] {
  try {
    const raw = localStorage.getItem(`${AVAILABILITY_ALERTS_KEY_PREFIX}${memberId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

export function saveLocalAvailabilityAlertCodes(memberId: string, codes: string[]): void {
  localStorage.setItem(`${AVAILABILITY_ALERTS_KEY_PREFIX}${memberId}`, JSON.stringify(codes));
}

export async function fetchAvailabilityAlertCodes(memberId: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/availability-alerts?memberId=${encodeURIComponent(memberId)}`);
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const codes = Array.isArray(data.codes) ? data.codes : [];
    saveLocalAvailabilityAlertCodes(memberId, codes);
    return codes;
  } catch {
    return getLocalAvailabilityAlertCodes(memberId);
  }
}

export async function toggleAvailabilityAlert(input: {
  memberId: string;
  memberEmail: string;
  memberName: string;
  sampleCode: string;
  sampleName: string;
}): Promise<{ subscribed: boolean; codes: string[] }> {
  try {
    const res = await fetch('/api/availability-alerts/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'toggle failed');
    const codes = Array.isArray(data.codes) ? data.codes : [];
    saveLocalAvailabilityAlertCodes(input.memberId, codes);
    return { subscribed: !!data.subscribed, codes };
  } catch {
    const current = getLocalAvailabilityAlertCodes(input.memberId);
    const subscribed = !current.includes(input.sampleCode);
    const codes = subscribed
      ? [...current, input.sampleCode]
      : current.filter((c) => c !== input.sampleCode);
    saveLocalAvailabilityAlertCodes(input.memberId, codes);
    return { subscribed, codes };
  }
}
