/**
 * Next.js instrumentation hook. Runs once when the server starts.
 * Used to boot the pg-boss queue + register handlers + schedule
 * periodic jobs. The Edge runtime path is a no-op because pg-boss
 * needs Node APIs.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Skip during `next build` — no DB connection, would crash.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Skip in tests.
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") return;

  // Skip if explicitly disabled (useful for one-off CLI runs that import
  // app code but shouldn't kick off the queue).
  if (process.env.QUEUE_DISABLED === "true") return;

  const { bootQueue } = await import("@/lib/queue/setup");
  try {
    await bootQueue();
  } catch (err) {
    // Don't crash the server boot just because the queue failed to start —
    // HTTP handlers can still serve the dashboard. The queue will retry on
    // the next request that calls getBoss().
    // eslint-disable-next-line no-console
    console.error("[instrumentation] queue boot failed:", err);
  }
}
