import { Worker } from "bullmq";
import connection from "../queues/connection.server.js";
import { processAbandonedCartJob } from "../services/abandonedCart.server.js";

let worker = globalThis.__sendlyAbandonedCartWorker;

if (!worker) {
  worker = new Worker(
    "abandoned-cart",
    async (job) => processAbandonedCartJob(job.data),
    {
      connection,
      concurrency: 3,
      limiter: { max: 5, duration: 1000 },
    }
  );

  worker.on("completed", (job, result) => {
    if (result?.skipped) {
      console.log(`⏭️  Abandoned cart job skipped (${result.reason}): ${job.data.reminderKey}`);
    } else {
      console.log(`✅ Abandoned cart job completed: ${job.data.reminderKey} | ${job.data.customerPhone}`);
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Abandoned cart job failed: ${job?.data?.reminderKey} | ${err.message}`);
  });

  console.log("🔄 Abandoned cart worker started");

  globalThis.__sendlyAbandonedCartWorker = worker;
}

export default worker;