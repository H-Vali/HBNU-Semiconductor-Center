import dotenv from 'dotenv';
import { closeDatabase } from './db.js';
import { ensureFeatureFlagSchema, hiddenFeatureKeys, isHiddenFeatureKey, setFeatureEnabled } from './features.js';

dotenv.config();

function printUsage() {
  console.error(`Usage: npm run feature --workspace @hbnu/api -- <feature_key> <on|off>

Available features:
${hiddenFeatureKeys.map((key) => `- ${key}`).join('\n')}`);
}

function parseEnabled(value: string | undefined) {
  if (value === 'on' || value === 'enable' || value === 'enabled' || value === 'true') return true;
  if (value === 'off' || value === 'disable' || value === 'disabled' || value === 'false') return false;
  return null;
}

async function main() {
  const [featureKey, action] = process.argv.slice(2);
  const enabled = parseEnabled(action);

  if (!featureKey || !isHiddenFeatureKey(featureKey) || enabled === null) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  await ensureFeatureFlagSchema();
  const result = await setFeatureEnabled(featureKey, enabled, process.env.RENDER_SERVICE_NAME ?? 'render-shell');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(async () => {
    await closeDatabase();
  })
  .catch(async (error) => {
    console.error(error);
    await closeDatabase();
    process.exitCode = 1;
  });
