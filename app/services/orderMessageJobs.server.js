import prisma from "../db.server";
import { getStoreWithServices } from "../utils/helpers.server.js";
import { processOrderNotification } from "./orderNotification.server.js";
import { updateOrderTag } from "./orderTags.server.js";

// ==================== DELAYED ORDER MESSAGE ====================
export async function processDelayedMessage(job) {
  const { shop, orderId, serviceKey, fulfillment } = job;

  const store = await getStoreWithServices(shop);
  if (!store) return { skipped: true, reason: "no_store" };

  const session = await prisma.session.findFirst({
    where: { shop, isOnline: false },
    orderBy: { id: "desc" },
  });
  if (!session?.accessToken) return { skipped: true, reason: "no_token" };

  const res = await fetch(
    `https://${shop}/admin/api/2024-10/orders/${orderId}.json`,
    { headers: { "X-Shopify-Access-Token": session.accessToken } }
  );
  if (!res.ok) return { skipped: true, reason: "order_fetch_failed" };

  const { order } = await res.json();

  await processOrderNotification({ shop, store, order, serviceKey, fulfillment }, { skipDelay: true });
  return { success: true };
}

// ==================== NO RESPONSE TAG ====================
export async function processNoResponse(job) {
  const { shop, messageLogId, tagName } = job;

  const log = await prisma.messageLog.findUnique({ where: { id: BigInt(messageLogId) } });
  if (!log) return { skipped: true, reason: "no_log" };

  if (log.customerResponse) return { skipped: true, reason: "already_responded" };

  try {
    await updateOrderTag(shop, log.orderId, tagName || "No Response", null);
    await prisma.messageLog.update({
      where: { id: log.id },
      data: { customerResponse: "no_response", respondedAt: new Date() },
    });
    return { success: true };
  } catch (e) {
    console.warn("No-response tag failed:", e.message);
    return { skipped: true, reason: "tag_failed" };
  }
}