import { closePool } from "../db.js";
import { runRealtimeSync } from "../services/realtimeSyncService.js";

try {
  const result = await runRealtimeSync();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closePool();
}
