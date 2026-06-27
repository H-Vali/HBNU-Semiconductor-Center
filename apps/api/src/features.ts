import { query } from './db.js';

export const hiddenFeatureKeys = ['equipment_usage_analytics_export'] as const;

export type HiddenFeatureKey = (typeof hiddenFeatureKeys)[number];

export const featureFlagSchemaStatements = [
  `create table if not exists feature_flags (
    feature_key text primary key,
    enabled boolean not null default false,
    updated_at timestamptz not null default now(),
    updated_by text
  )`
];

export function isHiddenFeatureKey(value: string): value is HiddenFeatureKey {
  return hiddenFeatureKeys.includes(value as HiddenFeatureKey);
}

export async function ensureFeatureFlagSchema() {
  for (const statement of featureFlagSchemaStatements) {
    await query(statement);
  }

  for (const featureKey of hiddenFeatureKeys) {
    await query(
      `insert into feature_flags (feature_key, enabled)
       values ($1, false)
       on conflict (feature_key) do nothing`,
      [featureKey]
    );
  }
}

export async function isFeatureEnabled(featureKey: HiddenFeatureKey) {
  const result = await query<{ enabled: boolean }>(
    `select enabled
     from feature_flags
     where feature_key = $1`,
    [featureKey]
  );
  return result.rows[0]?.enabled ?? false;
}

export async function setFeatureEnabled(featureKey: HiddenFeatureKey, enabled: boolean, updatedBy: string | null) {
  const result = await query<{ featureKey: string; enabled: boolean; updatedAt: string | Date; updatedBy: string | null }>(
    `insert into feature_flags (feature_key, enabled, updated_by)
     values ($1, $2, $3)
     on conflict (feature_key) do update
     set enabled = excluded.enabled,
         updated_at = now(),
         updated_by = excluded.updated_by
     returning feature_key as "featureKey", enabled, updated_at as "updatedAt", updated_by as "updatedBy"`,
    [featureKey, enabled, updatedBy]
  );
  return result.rows[0];
}
