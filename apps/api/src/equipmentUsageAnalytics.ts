import { query } from './db.js';

type EquipmentUsageRow = {
  equipmentId: string;
  equipmentName: string;
  groupKey: string;
  groupName: string;
  reservationCount: number;
  totalHours: number;
};

type GroupUsageRow = {
  groupKey: string;
  groupName: string;
  reservationCount: number;
  totalHours: number;
  hourRatio: number;
};

type UserUsageRow = {
  userId: string;
  userName: string;
  email: string;
  department: string | null;
  labProfessor: string | null;
  equipmentName: string;
  groupName: string;
  reservationCount: number;
  totalHours: number;
  lastUsedAt: string | null;
};

type ReservationLogRow = {
  userName: string;
  email: string;
  equipmentName: string;
  groupName: string;
  startsAt: string;
  endsAt: string;
  durationHours: number;
  purpose: string;
};

const approvedReservationClause = `r.deleted_at is null and r.status = 'approved'`;

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function numberCell(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

function tableSection(title: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const columnCount = headers.length;
  const bodyRows = rows.length
    ? rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
        .join('\n')
    : `<tr><td colspan="${columnCount}">데이터 없음</td></tr>`;

  return `
    <tr class="section"><td colspan="${columnCount}">${escapeHtml(title)}</td></tr>
    <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
    ${bodyRows}
    <tr class="spacer"><td colspan="${columnCount}"></td></tr>
  `;
}

async function getEquipmentUsageRows() {
  const result = await query<EquipmentUsageRow>(
    `select
        e.id as "equipmentId",
        e.name as "equipmentName",
        e.group_key as "groupKey",
        coalesce(nullif(e.group_name, ''), e.group_key) as "groupName",
        count(r.id)::int as "reservationCount",
        coalesce(round(sum(extract(epoch from (r.ends_at - r.starts_at)) / 3600)::numeric, 2), 0)::float as "totalHours"
      from equipment e
      left join reservations r
        on r.equipment_id = e.id
       and ${approvedReservationClause}
      where e.deleted_at is null
      group by e.id, e.name, e.group_key, e.group_name
      order by e.group_key, e.name`
  );
  return result.rows;
}

async function getGroupUsageRows() {
  const result = await query<GroupUsageRow>(
    `with groups(group_key, group_name) as (
        values ('process', '공정장비'), ('metrology', '검사·계측·패키징 장비')
      ),
      usage as (
        select
          e.group_key,
          count(r.id)::int as reservation_count,
          coalesce(round(sum(extract(epoch from (r.ends_at - r.starts_at)) / 3600)::numeric, 2), 0)::float as total_hours
        from equipment e
        left join reservations r
          on r.equipment_id = e.id
         and ${approvedReservationClause}
        where e.deleted_at is null
        group by e.group_key
      ),
      total as (
        select coalesce(sum(total_hours), 0)::float as all_hours from usage
      )
      select
        g.group_key as "groupKey",
        g.group_name as "groupName",
        coalesce(u.reservation_count, 0)::int as "reservationCount",
        coalesce(u.total_hours, 0)::float as "totalHours",
        case
          when t.all_hours > 0 then round(((coalesce(u.total_hours, 0) / t.all_hours) * 100)::numeric, 2)::float
          else 0
        end as "hourRatio"
      from groups g
      left join usage u on u.group_key = g.group_key
      cross join total t
      order by g.group_key`
  );
  return result.rows;
}

async function getUserUsageRows() {
  const result = await query<UserUsageRow>(
    `select
        u.id as "userId",
        u.name as "userName",
        u.email,
        u.department,
        u.lab_professor as "labProfessor",
        e.name as "equipmentName",
        coalesce(nullif(e.group_name, ''), e.group_key) as "groupName",
        count(r.id)::int as "reservationCount",
        round(sum(extract(epoch from (r.ends_at - r.starts_at)) / 3600)::numeric, 2)::float as "totalHours",
        to_char(max(r.starts_at) at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as "lastUsedAt"
      from reservations r
      join users u on u.id = r.user_id and u.deleted_at is null
      join equipment e on e.id = r.equipment_id
      where ${approvedReservationClause}
      group by u.id, u.name, u.email, u.department, u.lab_professor, e.name, e.group_key, e.group_name
      order by u.name, e.name`
  );
  return result.rows;
}

async function getReservationLogRows() {
  const result = await query<ReservationLogRow>(
    `select
        u.name as "userName",
        u.email,
        e.name as "equipmentName",
        coalesce(nullif(e.group_name, ''), e.group_key) as "groupName",
        to_char(r.starts_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as "startsAt",
        to_char(r.ends_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as "endsAt",
        round((extract(epoch from (r.ends_at - r.starts_at)) / 3600)::numeric, 2)::float as "durationHours",
        r.purpose
      from reservations r
      join users u on u.id = r.user_id and u.deleted_at is null
      join equipment e on e.id = r.equipment_id
      where ${approvedReservationClause}
      order by r.starts_at desc, u.name, e.name`
  );
  return result.rows;
}

export async function buildEquipmentUsageAnalyticsWorkbook() {
  const [equipmentRows, groupRows, userRows, reservationLogs] = await Promise.all([
    getEquipmentUsageRows(),
    getGroupUsageRows(),
    getUserUsageRows(),
    getReservationLogRows()
  ]);
  const generatedAt = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul'
  }).format(new Date());

  return `\uFEFF<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #d9eaf7; font-weight: 700; }
    th, td { border: 1px solid #9aa9b5; padding: 6px 8px; mso-number-format: "\\@"; }
    .title td { background: #12324a; color: #ffffff; font-size: 18px; font-weight: 700; }
    .meta td { background: #eef5f9; color: #334; }
    .section td { background: #1f6f8b; color: #ffffff; font-weight: 700; }
    .spacer td { border-left: 0; border-right: 0; height: 16px; }
  </style>
</head>
<body>
  <table>
    <tr class="title"><td colspan="10">HBNU 장비사용통계</td></tr>
    <tr class="meta"><td colspan="10">생성일시: ${escapeHtml(generatedAt)} / 기준: 승인 완료 예약</td></tr>
    <tr class="spacer"><td colspan="10"></td></tr>
    ${tableSection(
      '1. 장비별 총 사용시간',
      ['장비 ID', '장비명', '구분', '예약 건수', '총 사용시간(h)'],
      equipmentRows.map((row) => [
        row.equipmentId,
        row.equipmentName,
        row.groupName,
        row.reservationCount,
        numberCell(row.totalHours)
      ])
    )}
    ${tableSection(
      '2. 공정장비 vs 검사·계측·패키징 장비 사용비율',
      ['구분', '예약 건수', '총 사용시간(h)', '사용시간 비율(%)'],
      groupRows.map((row) => [row.groupName, row.reservationCount, numberCell(row.totalHours), numberCell(row.hourRatio)])
    )}
    ${tableSection(
      '3. User 별 장비 예약 및 사용시간 요약',
      ['사용자 ID', '이름', '이메일', '소속학과', '지도교수명', '장비명', '구분', '예약 건수', '총 사용시간(h)', '최근 사용일시'],
      userRows.map((row) => [
        row.userId,
        row.userName,
        row.email,
        row.department,
        row.labProfessor,
        row.equipmentName,
        row.groupName,
        row.reservationCount,
        numberCell(row.totalHours),
        row.lastUsedAt
      ])
    )}
    ${tableSection(
      '4. User 별 예약 상세 log',
      ['이름', '이메일', '장비명', '구분', '시작일시', '종료일시', '사용시간(h)', '목적'],
      reservationLogs.map((row) => [
        row.userName,
        row.email,
        row.equipmentName,
        row.groupName,
        row.startsAt,
        row.endsAt,
        numberCell(row.durationHours),
        row.purpose
      ])
    )}
  </table>
</body>
</html>`;
}
