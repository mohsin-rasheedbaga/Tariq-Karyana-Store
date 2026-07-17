import { db } from './db';

/**
 * v1.3.3 FIX: Simple async mutex to serialize write transactions.
 *
 * SQLite allows only ONE writer at a time. Even with WAL mode + busy_timeout +
 * retry logic, heavy concurrent write transactions can exhaust the timeout
 * budget and fail with "Socket timeout" / "database is locked" errors.
 *
 * For a single-store POS, writes don't need to be concurrent — they just need
 * to be reliable. This mutex serializes all write transactions through a single
 * queue, eliminating lock contention entirely. Each transaction runs to
 * completion before the next one starts.
 *
 * Read operations are NOT serialized (WAL mode allows concurrent readers).
 */

let writeChain: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const result = writeChain.then(task, task);
  // Swallow errors from the chained promise so they don't break the chain,
  // but still surface them to the caller via `result`.
  writeChain = result.then(() => undefined, () => undefined);
  return result;
}

/**
 * v1.3.3 FIX: Transaction wrapper with retry + write-lock serialization.
 *
 * - Serializes write transactions through a single async queue (no lock contention).
 * - Uses a 15s transaction timeout.
 * - Retries up to 3 times on transient lock/timeout errors (defensive).
 */
export async function safeTransaction<T>(
  fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>,
  options?: { timeout?: number; maxRetries?: number }
): Promise<T> {
  const timeout = options?.timeout ?? 15000;
  const maxRetries = options?.maxRetries ?? 3;

  return withWriteLock(async () => {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await db.$transaction(fn, { timeout, maxWait: timeout });
      } catch (error: any) {
        lastError = error;
        const msg = (error.message || '').toLowerCase();
        const isRetryable =
          msg.includes('timeout') ||
          msg.includes('locked') ||
          msg.includes('busy') ||
          msg.includes('sqlite_busy') ||
          msg.includes('could not start transaction') ||
          msg.includes('write conflict') ||
          error.code === 'P2028';

        if (!isRetryable || attempt === maxRetries - 1) {
          throw error;
        }
        const delay = 50 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
  });
}
