import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "fdraft-studio-test-"));
  try {
    return await fn(dir);
  } finally {
    // maxRetries/retryDelay: Node's own documented mitigation for a real,
    // known race — a concurrently-running test's atomic-write rename (or,
    // on Windows, an antivirus/indexer file handle) can still be settling
    // inside this directory the instant recursive rm reads it, producing a
    // spurious ENOTEMPTY/EBUSY that has nothing to do with this test run's
    // own correctness.
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
