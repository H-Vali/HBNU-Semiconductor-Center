export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'maintenance' | 'external' | 'canceled';

export function normalizeReservationStatus(status: unknown): ReservationStatus {
  return status === 'maintenance' ||
    status === 'external' ||
    status === 'approved' ||
    status === 'pending' ||
    status === 'rejected' ||
    status === 'canceled'
    ? status
    : 'approved';
}

export function getReservationStatusLabel(status?: ReservationStatus) {
  if (status === 'maintenance') return '장비 점검';
  if (status === 'external') return '외부 예약';
  if (status === 'canceled') return '취소';
  return '예약 확정';
}
