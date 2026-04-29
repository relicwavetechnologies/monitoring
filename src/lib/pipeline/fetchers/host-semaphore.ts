/**
 * Per-host concurrency semaphore — in-process.
 *
 * Two URLs that share a host (e.g. two pages on visa.vfsglobal.com) should
 * not be fetched simultaneously, both because it accelerates rate-limiting
 * and because the same Cloudflare front fingerprints concurrent requests.
 *
 * Phase 4 ships an in-process implementation. Phase 5 (queue) will replace
 * this with the queue's native concurrency control; the API surface here
 * is intentionally narrow so swapping is straightforward.
 */

interface Waiter {
  resolve: () => void;
}

class HostSemaphore {
  private capacity: number;
  private inFlight = 0;
  private queue: Waiter[] = [];

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
  }

  async acquire(): Promise<void> {
    if (this.inFlight < this.capacity) {
      this.inFlight++;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push({ resolve });
    });
    this.inFlight++;
  }

  release(): void {
    // Free the slot. If there's a queued waiter, wake it; the waiter's
    // own acquire() path will increment inFlight as it resumes, taking
    // the slot we just released.
    this.inFlight = Math.max(0, this.inFlight - 1);
    const next = this.queue.shift();
    if (next) next.resolve();
  }

  stats(): { capacity: number; inFlight: number; queued: number } {
    return { capacity: this.capacity, inFlight: this.inFlight, queued: this.queue.length };
  }
}

const semaphores = new Map<string, HostSemaphore>();

/** Default per-host capacity. Override per-host with `setHostCapacity`. */
const DEFAULT_CAPACITY = 1;

/** Hosts where we know we want a higher (or strictly = 1) cap. */
const HOST_CAPACITY_OVERRIDES: Record<string, number> = {
  // Most hosts are fine with 1 concurrent fetch. Add explicit overrides
  // here as we learn what each host tolerates.
};

function capacityFor(host: string): number {
  return HOST_CAPACITY_OVERRIDES[host] ?? DEFAULT_CAPACITY;
}

function getSemaphore(host: string): HostSemaphore {
  let s = semaphores.get(host);
  if (!s) {
    s = new HostSemaphore(capacityFor(host));
    semaphores.set(host, s);
  }
  return s;
}

/** Run `fn` while holding the per-host slot. Releases on success and on
 *  failure so a thrown fetch can't deadlock the host's queue. */
export async function withHostLock<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const sem = getSemaphore(host);
  await sem.acquire();
  try {
    return await fn();
  } finally {
    sem.release();
  }
}

/** Test seam — clears all semaphore state. Production code never calls this. */
export function _resetSemaphoresForTests(): void {
  semaphores.clear();
}

/** Inspect current semaphore state. Useful for the admin metrics endpoint. */
export function semaphoreStats(): Record<string, ReturnType<HostSemaphore["stats"]>> {
  const out: Record<string, ReturnType<HostSemaphore["stats"]>> = {};
  for (const [host, sem] of semaphores) out[host] = sem.stats();
  return out;
}
