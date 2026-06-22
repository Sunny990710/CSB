import { SampleStatus } from '@/types';

/** 보관함에 담을 수 있는 상태 (분실 제외) */
export function canAddSampleToLocker(status: SampleStatus): boolean {
  return status !== '분실';
}

/** 대여 가능 알림을 설정할 수 있는 상태 */
export function canSubscribeAvailabilityAlert(status: SampleStatus): boolean {
  return status === '대여중' || status === '연체중';
}
