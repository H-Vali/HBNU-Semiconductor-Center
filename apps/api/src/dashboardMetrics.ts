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
      metricsVersion: 'equipment-setting-usage-hours-v1'
    };
  }

  const [usage, education] = await Promise.all([
    query<{ hours: string }>(
      `select coalesce(sum(greatest(usage_hours, 0)), 0)::text as "hours"
       from equipment
       where deleted_at is null`
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
    )
  ]);

  const currentHours = toNumber(usage.rows[0]?.hours);

  return {
    monthlyUptimeHours: currentHours,
    monthlyUptimeDeltaPercent: 0,
    certifiedUsers: toNumber(education.rows[0]?.certifiedUsers),
    totalUsers: toNumber(education.rows[0]?.totalUsers),
    metricsVersion: 'equipment-setting-usage-hours-v1'
  };
}
