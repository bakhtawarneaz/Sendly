import prisma from "../db.server";
import { isCodOrder, passesPaymentFilter, parseConfig, extractCustomerPhone } from "./order.server.js";
import { resolveTemplateVariables } from "../utils/templateVariables.js";
import { sendAndLog, isDuplicate } from "./message.server.js";
import { getProductImageUrl } from "../utils/helpers.server.js";
import { canSendMessage } from "../utils/billing.server.js";

/**
 * Shared handler for all order-based notification services.
 *
 * @param {object} args
 * @param {string} args.shop            - shop domain
 * @param {object} args.store           - store with storeServices included
 * @param {object} args.order           - Shopify order payload
 * @param {string} args.serviceKey      - which service is triggering
 * @param {object} [args.fulfillment]   - fulfillment payload (for fulfillment/delivered)
 */

function parseNoResponseDelay(val) {
  const map = {
    "1_min": 60 * 1000,
    "15_min": 15 * 60 * 1000,
    "30_min": 30 * 60 * 1000,
    "1_hour": 60 * 60 * 1000,
    "2_hours": 2 * 60 * 60 * 1000,
    "6_hours": 6 * 60 * 60 * 1000,
    "12_hours": 12 * 60 * 60 * 1000,
    "24_hours": 24 * 60 * 60 * 1000,
  };
  return map[val] ?? 30 * 60 * 1000;
}


export async function processOrderNotification({ shop, store, order, serviceKey, fulfillment = null }, opts = {}) {
  if (!store || !store.whatsappConnected) return;

  const { allowed, reason } = canSendMessage(store);
  if (!allowed) {
    console.log(`⏸️  Sending paused for ${shop}: ${reason}`);
    return;
  }

  const customerPhone = extractCustomerPhone(order);
  if (!customerPhone) {
    console.log(`No phone number found for order ${order?.name}`);
    return;
  }

  const storeService = store.storeServices.find(
    (ss) => ss.service.serviceKey === serviceKey
  );
  if (!storeService) {
    console.log(`Service ${serviceKey} not enabled for ${shop}`);
    return;
  }

  const config = parseConfig(storeService);

  // Payment filter
  if (!passesPaymentFilter(order, config.paymentFilter)) {
    console.log(`Order ${order?.name} filtered out by payment filter (${config.paymentFilter})`);
    return;
  }

  // Template selection
  let templateId = storeService.templateId;
  if (config.useSeparateTemplates) {
    const isCod = isCodOrder(order);
    if (isCod && config.codTemplateId) templateId = BigInt(config.codTemplateId);
    else if (!isCod && config.prepaidTemplateId) templateId = BigInt(config.prepaidTemplateId);
  }

  if (!templateId) {
    console.log(`No template configured for ${serviceKey}`);
    return;
  }

  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template || template.status !== "approved") {
    console.log(`Template ${templateId} not approved, skipping ${serviceKey}`);
    return;
  }

  // Duplicate check
  if (await isDuplicate(store.id, storeService.service.id, order?.id)) {
    console.log(`Duplicate skipped: ${serviceKey} already sent for order ${order?.name}`);
    return;
  }

  // Message delay — queue for later instead of sending now.
  const delayMinutes = parseInt(config.delayMinutes || "0");
  if (delayMinutes > 0 && !opts.skipDelay) {
    const { orderMessageQueue } = await import("../queues/queues.server.js");
    await orderMessageQueue.add(
      `${serviceKey}-${order?.id}`,
      { shop, orderId: order?.id, serviceKey, fulfillment },
      {
        delay: delayMinutes * 60 * 1000,
        jobId: `delay-${serviceKey}-${order?.id}`,
        attempts: 2,
      }
    );
    console.log(`⏳ ${serviceKey} delayed ${delayMinutes}min for order ${order?.name}`);
    return;
  }

  const variables = resolveTemplateVariables(template, order, store, fulfillment);

  // Product image
  let productImageUrl = null;
  if (config.includeImage) {
    productImageUrl = await getProductImageUrl(shop, order);
  }

  const sendResult = await sendAndLog({
    store,
    template,
    storeService,
    orderId: order?.id,
    orderName: order?.name,
    phone: customerPhone,
    variables,
    productImageUrl,
  });

  console.log("🔎 No-resp check:", {
    serviceKey,
    success: sendResult?.success,
    logId: sendResult?.messageLogId,
    enabled: config.noResponseTagEnabled,
    after: config.noResponseAfter,
  });


   // No Response Tag — schedule a check (order confirmation only)
   if (
    serviceKey === "order_confirmation_whatsapp" &&
    sendResult?.success &&
    sendResult?.messageLogId &&
    config.noResponseTagEnabled &&
    config.noResponseAfter
  ) {
    const { noResponseQueue } = await import("../queues/queues.server.js");
    const ms = parseNoResponseDelay(config.noResponseAfter);
    await noResponseQueue.add(
      `noresp-${order?.id}`,
      { shop, messageLogId: sendResult.messageLogId, tagName: config.noResponseTag || "No Response" },
      { delay: ms, jobId: `noresp-${sendResult.messageLogId}`, attempts: 2 }
    );
    console.log(`⏳ No-response check scheduled for order ${order?.name}`);
  }


}