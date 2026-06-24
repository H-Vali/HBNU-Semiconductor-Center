export const STORAGE_KEYS = {
  consumablesMonthlyData: 'hbnu-consumables-monthly-data',
  consumablesUpdatedAt: 'hbnu-consumables-updated-at',
  equipmentOverrides: 'hbnu-equipment-overrides',
  equipmentPermissions: 'hbnu-equipment-permissions',
  equipmentPermissionGrantMeta: 'hbnu-equipment-permission-grant-meta',
  managedUsers: 'hbnu-managed-users',
  meetingNotices: 'hbnu-meeting-notices',
  operationNotices: 'hbnu-operation-notices',
  penaltyRecords: 'hbnu-penalty-records',
  previewPenaltyDemoDismissed: 'hbnu-preview-penalty-demo-dismissed',
  qnaItems: 'hbnu-qna-items',
  sessionToken: 'hbnu-session-token',
  sessionUser: 'hbnu-session-user',
  usersUpdatedAt: 'hbnu-users-updated-at'
} as const;

export function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}
