import { Worker } from "bullmq";
import connection from "../queues/connection.server.js";
import { processReviewRequestJob } from "../services/reviewRequest.server.js";

let worker = globalThis.__sendlyReviewRequestWorker;

if (!worker) {
  worker = new Worker(
    "review-request",
    async (job) => processReviewRequestJob(job.data),
    { connection, concurrency: 5 }
  );
  worker.on("failed", (job, err) => console.error(`❌ Review request job failed: ${err.message}`));

  console.log("🔄 Review request worker started");
  globalThis.__sendlyReviewRequestWorker = worker;
}

export default worker;
