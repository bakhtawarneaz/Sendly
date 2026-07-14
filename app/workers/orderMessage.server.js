import { Worker } from "bullmq";
import connection from "../queues/connection.server.js";
import { processDelayedMessage, processNoResponse } from "../services/orderMessageJobs.server.js";

let workers = globalThis.__sendlyOrderWorkers;

if (!workers) {
  const delayWorker = new Worker(
    "order-message",
    async (job) => processDelayedMessage(job.data),
    { connection, concurrency: 5 }
  );
  delayWorker.on("failed", (job, err) => console.error(`❌ Delayed message failed: ${err.message}`));

  const noRespWorker = new Worker(
    "no-response",
    async (job) => processNoResponse(job.data),
    { connection, concurrency: 5 }
  );
  noRespWorker.on("failed", (job, err) => console.error(`❌ No-response job failed: ${err.message}`));

  console.log("🔄 Order message + no-response workers started");
  workers = { delayWorker, noRespWorker };
  globalThis.__sendlyOrderWorkers = workers;
}

export default workers;