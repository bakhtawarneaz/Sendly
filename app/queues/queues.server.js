import { Queue } from "bullmq";
import connection from "./connection.server.js";

export const abandonedCartQueue = new Queue("abandoned-cart", { connection });
export const orderMessageQueue = new Queue("order-message", { connection });
export const noResponseQueue = new Queue("no-response", { connection });