import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../apiClient';
import { STORAGE_KEYS } from '../appStorage';

type AuditLogEntry = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const actionLabels: Record<string, string> = {
  USER_DELETE: '사용자 삭제',
  USER_CREATE: '사용자 생성',
  USER_UPDATE: '사용자 수정',
  EQUIPMENT_CREATE: '장비 생성',
  EQUIPMENT_UPDATE: '장비 수정',
  EQUIPMENT_DELETE: '장비 삭제',
  NOTICE_CREATE: '공지 생성',
  NOTICE_UPDATE: '공지 수정',
  NOTICE_DELETE: '공지 삭제',
  FAQ_CREATE: 'FAQ 생성',
  FAQ_UPDATE: 'FAQ 수정',
  FAQ_DELETE: 'FAQ 삭제',
  QNA_ANSWER: 'Q&A 답변',
  QNA_DELETE: 'Q&A 삭제',
  RESERVATION_CREATE: '예약 생성',
  RESERVATION_CANCEL: '예약 취소',
  EQUIPMENT_PERMISSION_GRANT: '장비 권한 부여',
  EQUIPMENT_PERMISSION_REVOKE: '장비 권한 회수',
  EQUIPMENT_PERMISSION_SET: '장비 권한 일괄 저장',
  TRAINING_REQUEST_CREATE: '교육 신청',
  TRAINING_REQUEST_SCHEDULE: '교육 일정 확정',
  TRAINING_REQUEST_REJECT: '교육 신청 반려',
  TRAINING_REQUEST_COMPLETE: '교육 이수 처리',
  CONSUMABLES_SAVE: '소모품 저장',
  FILE_ASSET_CREATE: '파일 메타데이터 등록',
  FILE_ASSET_DELETE: '파일 메타데이터 삭제',
  PENALTY_CREATE: '패널티 등록',
  PENALTY_REVOKE: '패널티 해제'
};

function formatAuditDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return '추가 정보 없음';
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ');
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  async function loadLogs() {
    setLoading(true);
    const token = localStorage.getItem(STORAGE_KEYS.sessionToken);
    const items = await apiGet<AuditLogEntry[]>('/audit-logs?limit=300', token);
    setLogs(items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  const actionOptions = useMemo(() => (
    Array.from(new Set(logs.map((log) => log.action))).sort()
  ), [logs]);

  const visibleLogs = filter === 'all' ? logs : logs.filter((log) => log.action === filter);

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-white/10 bg-surface/85 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase text-cyan-300">Audit Log</p>
            <h2 className="text-2xl font-black text-white">운영 감사 로그</h2>
            <p className="mt-2 text-sm text-slate-400">예약, 교육, 권한, 사용자, 패널티 관련 관리자 작업 이력을 확인합니다.</p>
          </div>
          <button
            type="button"
            className="rounded-md bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-cyan-500 hover:text-slate-950"
            onClick={() => void loadLogs()}
            disabled={loading}
          >
            {loading ? '새로고침 중' : '새로고침'}
          </button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="감사 로그 작업 필터">
            <option value="all">전체 작업</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>{actionLabels[action] ?? action}</option>
            ))}
          </select>
          <span className="text-sm font-bold text-slate-400">표시 {visibleLogs.length}건 / 전체 {logs.length}건</span>
        </div>
      </div>

      <div className="audit-log-list">
        {visibleLogs.length > 0 ? visibleLogs.map((log) => (
          <article key={log.id} className="audit-log-row">
            <div>
              <strong>{actionLabels[log.action] ?? log.action}</strong>
              <span>{log.actorEmail ?? 'system'} · {log.actorRole} · {formatAuditDate(log.createdAt)}</span>
              <p>{formatMetadata(log.metadata)}</p>
            </div>
            <em>{log.entityType} / {log.entityId}</em>
          </article>
        )) : (
          <div className="rounded-lg border border-white/10 bg-surface/85 p-8 text-center text-sm font-bold text-slate-400">
            표시할 감사 로그가 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}
