import prisma from "../db.server";
import { extractCustomerPhone } from "./order.server.js";
import { canSendMessage } from "../utils/billing.server.js";
import { resolveTemplateVariables } from "../utils/templateVariables.js";
import { sendAndLog } from "./message.server.js";

function parseReviewDelay(value, unit) {
  const n = parseInt(value, 10) || 3;
  let ms;
  if (unit === "minutes") ms = 60 * 1000;
  else if (unit === "hours") ms = 60 * 60 * 1000;
  else ms = 24 * 60 * 60 * 1000;
  return n * ms;
}

// ==================== SCHEDULE REVIEW REQUEST (called on order fulfillment) ====================
export async function scheduleReviewRequest({ shop, store, order }) {
  if (!store || !store.whatsappConnected) return;

  const { allowed, reason } = canSendMessage(store);
  if (!allowed) {
    console.log(`⏸️  Review request paused for ${shop}: ${reason}`);
    return;
  }

  const customerPhone = extractCustomerPhone(order);
  if (!customerPhone) {
    console.log(`No phone number found for order ${order?.name}`);
    return;
  }

  const storeService = store.storeServices.find(
    (ss) => ss.service.serviceKey === "review_request_whatsapp"
  );
  if (!storeService) {
    console.log(`Service review_request_whatsapp not enabled for ${shop}`);
    return;
  }

  const existing = await prisma.reviewRequest.findUnique({
    where: { storeId_orderId: { storeId: store.id, orderId: String(order?.id) } },
  });
  if (existing) {
    console.log(`Review request already scheduled for order ${order?.name}`);
    return;
  }

  const delayMs = parseReviewDelay(store.reviewRequestDelayValue, store.reviewRequestDelayUnit);
  const { reviewRequestQueue } = await import("../queues/queues.server.js");
  await reviewRequestQueue.add(
    `review-${order?.id}`,
    { shop, orderId: String(order?.id), orderName: order?.name || "" },
    { delay: delayMs, jobId: `review-${order?.id}`, attempts: 2 }
  );
  console.log(`⏳ Review request scheduled in ${Math.round(delayMs / 60000)}min for order ${order?.name}`);
}

// ==================== PROCESS REVIEW REQUEST JOB (worker) ====================
export async function processReviewRequestJob(job) {
  const { shop, orderId, orderName } = job;

  const store = await prisma.store.findUnique({
    where: { shopDomain: shop },
    include: { storeServices: { where: { isEnabled: true }, include: { service: true } } },
  });
  if (!store || !store.whatsappConnected) return { skipped: true, reason: "no_store" };

  const { allowed } = canSendMessage(store);
  if (!allowed) return { skipped: true, reason: "billing_paused" };

  const storeService = store.storeServices.find(
    (ss) => ss.service.serviceKey === "review_request_whatsapp"
  );
  if (!storeService) return { skipped: true, reason: "service_disabled" };

  const existing = await prisma.reviewRequest.findUnique({
    where: { storeId_orderId: { storeId: store.id, orderId: String(orderId) } },
  });
  if (existing) return { skipped: true, reason: "duplicate" };

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
  const customerPhone = extractCustomerPhone(order);
  if (!customerPhone) return { skipped: true, reason: "no_phone" };

  const lineItem = order?.line_items?.[0];
  const customerName = order?.customer?.first_name || order?.shipping_address?.first_name || "";
  const customerEmail = order?.email || order?.customer?.email || "";
  const finalOrderName = orderName || order?.name || "";

  if (!storeService.templateId) {
    console.log(`No template selected for review_request_whatsapp (${shop})`);
    return { skipped: true, reason: "no_template" };
  }

  const template = await prisma.template.findUnique({ where: { id: storeService.templateId } });
  if (!template || template.status !== "approved") {
    console.log(`Review template not approved for ${shop}`);
    return { skipped: true, reason: "template_not_approved" };
  }

  const variables = resolveTemplateVariables(template, order, store);

  const sendResult = await sendAndLog({
    store,
    template,
    storeService,
    orderId: String(orderId),
    orderName: finalOrderName,
    phone: customerPhone,
    variables,
  });

  if (sendResult.success) {
    await prisma.reviewRequest.create({
      data: {
        storeId: store.id,
        orderId: String(orderId),
        orderName: finalOrderName,
        productId: lineItem?.product_id ? String(lineItem.product_id) : null,
        customerPhone,
        customerName,
        customerEmail,
        status: "requested",
        whatsappMessageId: sendResult.messageId,
        requestedAt: new Date(),
      },
    });
    return { success: true, messageId: sendResult.messageId };
  } else {
    await prisma.reviewRequest.create({
      data: {
        storeId: store.id,
        orderId: String(orderId),
        orderName: finalOrderName,
        customerPhone,
        customerName,
        customerEmail,
        status: "failed",
        requestedAt: new Date(),
      },
    });
    return { success: false, error: sendResult.error };
  }
}
