/**
 * Queue bootstrap. Called once at server start by `instrumentation.ts`.
 * Idempotent — repeated calls are no-ops because the boss singleton
 * itself is idempotent.
 *
 * Registers handlers, schedules the periodic jobs (TICK_SCAN every 5
 * minutes, EMAIL_SWEEP every 15), and leaves pg-boss running. From
 * this point on, the cron crontab on the VM is OPTIONAL — pg-boss
 * fires the schedules itself as long as the worker process is alive.
 */
import { getBoss } from "./index";
import { registerAllHandlers } from "./handlers";
import { QUEUES, RETRY_POLICY } from "./jobs";
import { getLogger } from "@/lib/logger";

const log = getLogger("queue.setup");

let _booted = false;

export async function bootQueue(): Promise<void> {
  if (_booted) return;
  _booted = true;
  try {
    const boss = await getBoss();
    await registerAllHandlers(boss);
    await boss.schedule(QUEUES.TICK_SCAN, "*/5 * * * *", {}, RETRY_POLICY[QUEUES.TICK_SCAN]);
    await boss.schedule(QUEUES.EMAIL_SWEEP, "*/15 * * * *", {}, RETRY_POLICY[QUEUES.EMAIL_SWEEP]);
    log.info("queue boot complete — tick.scan every 5min, email.sweep every 15min");
  } catch (err) {
    _booted = false;
    log.error({ err }, "queue boot failed");
    throw err;
  }
}
