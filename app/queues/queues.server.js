import { Queue } from "bullmq";
import connection from "./connection.server.js";

export const abandonedCartQueue = new Queue("abandoned-cart", { connection });
export const abandonedSyncQueue = new Queue("abandoned-sync", { connection });   
export const orderMessageQueue = new Queue("order-message", { connection });
export const noResponseQueue = new Queue("no-response", { connection });
export const reviewRequestQueue = new Queue("review-request", { connection });