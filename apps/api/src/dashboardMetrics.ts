import { hasDatabase, query } from './db.js';

export type DashboardMetrics = {
  monthlyUptimeHours: number;
  monthlyUptimeDeltaPercent: number;
  certifiedUsers: number;
  totalUsers: number;
  metricsVersion?: string;
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (!hasDatabase()) {
    return {
      monthlyUptimeHours: 0,
      monthlyUptimeDeltaPercent: 0,
      certifiedUsers: 0,
      totalUsers: 0,
      metricsVersion: 'active-equipment-uptime-v2'
    };
  }

  const [uptime, education, activeEquipment] = await Promise.all([
    query<{ period: 'current' | 'previous'; hours: string }>(
      `with bounds as (
          select
            (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') as current_start,
            ((date_trunc('month', now() at time zone 'Asia/Seoul') + interval '1 month') at time zone 'Asia/Seoul') as next_start,
            ((date_trunc('month', now() at time zone 'Asia/Seoul') - interval '1 month') at time zone 'Asia/Seoul') as previous_start
        ),
        periods as (
          select 'current'::text as period, current_start as starts_at, next_start as ends_at from bounds
          union all
          select 'previous'::text as period, previous_start as starts_at, current_start as ends_at from bounds
        ),
        usage_reservations as (
          select r.starts_at, r.ends_at
          from reservations r
          join equipment e on e.id = r.equipment_id and e.deleted_at is null
          join users u on u.id = r.user_id and u.deleted_at is null and u.status = 'active'
          where r.deleted_at is null
            and r.status = 'approved'
        )
        select
          p.period as "period",
          coalesce(round(sum(
            extract(epoch from (least(r.ends_at, p.ends_at) - greatest(r.starts_at, p.starts_at))) / 3600
          )::numeric, 1), 0)::text as "hours"
        from periods p
        left join usage_reservations r
          on r.starts_at < p.ends_at
         and r.ends_at > p.starts_at
        group by p.period`
    ),
    query<{ certifiedUsers: string; totalUsers: string }>(
      `with active_users as (
          select id
          from users
          where deleted_at is null and status = 'active'
        ),
        certified as (
          select ep.user_id
          from equipment_permissions ep
          join active_users au on au.id = ep.user_id
          where ep.revoked_at is null

          union

          select ur.user_id
          from user_roles ur
          join roles r on r.id = ur.role_id
          join active_users au on au.id = ur.user_id
          where r.name in ('ADMIN', 'MANAGER')

          union

          select e.manager_user_id as user_id
          from equipment e
          join active_users au on au.id = e.manager_user_id
          where e.deleted_at is null and e.manager_user_id is not null
        )
        select
          (select count(distinct user_id)::text from certified) as "certifiedUsers",
          (select count(*)::text from active_users) as "totalUsers"`
    ),
    query<{ count: string }>(
      `select count(*)::text as count
       from equipment
       where deleted_at is null`
    )
  ]);

  const hasActiveEquipment = toNumber(activeEquipment.rows[0]?.count) > 0;
  const currentHours = hasActiveEquipment ? toNumber(uptime.rows.find((row) => row.period === 'current')?.hours) : 0;
  const previousHours = hasActiveEquipment ? toNumber(uptime.rows.find((row) => row.period === 'previous')?.hours) : 0;
  const monthlyUptimeDeltaPercent = previousHours > 0
    ? Math.round(((currentHours - previousHours) / previousHours) * 100)
    : 0;

  return {
    monthlyUptimeHours: currentHours,
    monthlyUptimeDeltaPercent,
    certifiedUsers: toNumber(education.rows[0]?.certifiedUsers),
    totalUsers: toNumber(education.rows[0]?.totalUsers),
    metricsVersion: 'active-equipment-uptime-v2'
  };
}
