import { Worker } from "bullmq";
import connection from "../queues/connection.server.js";
import { runAbandonedSync } from "../services/abandonedSync.server.js";

let worker = globalThis.__sendlyAbandonedSyncWorker;

if (!worker) {
  worker = new Worker(
    "abandoned-sync",
    async () => {
      const results = await runAbandonedSync();
      const totalSynced = results.reduce((n, r) => n + (r.synced || 0), 0);
      return { success: true, totalSynced, stores: results.length };
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on("completed", (job, result) => {
    console.log(`✅ Abandoned sync run complete | synced: ${result?.totalSynced ?? 0}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Abandoned sync run failed: ${err.message}`);
  });

  console.log("🔄 Abandoned sync worker started");
  globalThis.__sendlyAbandonedSyncWorker = worker;
}

async function startSyncScheduler() {
  const { abandonedSyncQueue } = await import("../queues/queues.server.js");

  const existing = await abandonedSyncQueue.getJobSchedulers();
  for (const s of existing) {
    await abandonedSyncQueue.removeJobScheduler(s.key);
  }

  await abandonedSyncQueue.upsertJobScheduler(
    "abandoned-sync-every-15m",
    { every: 60 * 60 * 1000 },
    {
      name: "sync",
      opts: {
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 172800 },
      },
    }
  );

  console.log("🔄 Abandoned sync scheduled every 15 minutes");
}

if (!globalThis.__sendlyAbandonedSyncScheduled) {
  globalThis.__sendlyAbandonedSyncScheduled = true;
  startSyncScheduler().catch((err) =>
    console.error("❌ Failed to start sync scheduler:", err.message)
  );
}

export default worker;