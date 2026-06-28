import dotenv from 'dotenv';
import { deleteR2Object, putR2Object } from './r2Storage.js';

dotenv.config();

async function main() {
  const key = `healthcheck/r2-${Date.now()}.txt`;
  const buffer = Buffer.from(`HBNU R2 healthcheck ${new Date().toISOString()}`, 'utf8');
  await putR2Object(key, buffer, 'text/plain');
  await deleteR2Object(key);
  console.log(JSON.stringify({ ok: true, storageKey: key, note: 'R2 upload/delete check completed' }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
