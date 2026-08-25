import prisma from "../db.server";
import { parseConfig } from "./order.server.js";
import { updateOrderTag, cancelShopifyOrder, isOrderCancelled } from "./orderTags.server.js";
import { sendTemplateMessage } from "./whatsappSender.server.js";
import { resolveTemplateVariables } from "../utils/templateVariables.js";
import { buildVarArray } from "./message.server.js";

function resolveAction(template, buttonText) {
  const buttons = Array.isArray(template?.buttons) ? template.buttons : [];
  const match = buttons.find((b) => (b.text || "").trim() === (buttonText || "").trim());
  return match?.action || null; 
}

export async function processButtonReply({ contextMessageId, buttonText, phoneNumberId = null }) {
  console.log("🔔 Callback:", { contextMessageId, buttonText });
  if (!contextMessageId) return;

  let store = null;
  if (phoneNumberId) {
    store = await prisma.store.findFirst({
      where: { whatsappPhoneId: phoneNumberId },
    });
  }

  const log = await prisma.messageLog.findFirst({
    where: {
      metadata: { path: ["whatsappMessageId"], equals: contextMessageId },
      ...(store ? { storeId: store.id } : {}),
    },
    include: { store: true, service: true },
  });
  if (!log) return;

  if (!store) store = log.store;

  if (store && log.store && String(store.id) !== String(log.storeId)) {
    console.warn("Callback store mismatch — ignoring");
    return;
  }

  if (log.service?.serviceKey !== "order_confirmation_whatsapp") return;

  const shop = store.shopDomain;

  const storeService = await prisma.storeService.findUnique({
    where: { storeId_serviceId: { storeId: store.id, serviceId: log.serviceId } },
  });
  const config = parseConfig(storeService);

  const template = log.templateName
    ? await prisma.template.findFirst({ where: { storeId: store.id, name: log.templateName } })
    : null;

  const action = resolveAction(template, buttonText);
  if (!action) return;

  const confirmTag = config.confirmTag || "Order Confirmed";
  const cancelTag = config.cancelTag || "Order Cancelled";

  try {
    if (action === "confirm") {
      let wasCancelled = false;
      if (config.cancelOrderOnShopify) {
        wasCancelled = await isOrderCancelled(shop, log.orderId);
      }

      await updateOrderTag(shop, log.orderId, confirmTag, cancelTag);

      if (wasCancelled) {
        await updateOrderTag(shop, log.orderId, "Reconfirmed After Cancel", null);
      }
    } else {
      await updateOrderTag(shop, log.orderId, cancelTag, confirmTag);
      if (config.cancelOrderOnShopify) {
        try { await cancelShopifyOrder(shop, log.orderId); }
        catch (e) { console.warn("Cancel order failed:", e.message); }
      }
    }
    console.log("🏷️  Tag updated:", action);
  } catch (e) {
    console.error("❌ Tag update failed:", e.message); 
  }

  await prisma.messageLog.update({
    where: { id: log.id },
    data: { customerResponse: action === "confirm" ? "confirmed" : "cancelled", respondedAt: new Date() },
  });

  const sendResponse = action === "confirm" ? config.sendConfirmResponse : config.sendCancelResponse;
  const responseTemplateId = action === "confirm" ? config.confirmResponseTemplateId : config.cancelResponseTemplateId;

  if (sendResponse && responseTemplateId && log.customerPhone) {
    const respTemplate = await prisma.template.findUnique({ where: { id: BigInt(responseTemplateId) } });
    if (respTemplate && respTemplate.status === "approved") {
      try {
        const order = { name: log.orderName, customer: {}, billing_address: {}, line_items: [] };
        const variables = resolveTemplateVariables(respTemplate, order, store);
        const varArray = buildVarArray(respTemplate, variables);
        await sendTemplateMessage(store, respTemplate, log.customerPhone, varArray);
      } catch (e) {
        console.warn("Response template send failed:", e.message);
      }
    }
  }
}

// ==================== PROCESS STATUS UPDATE ====================
export async function processStatusUpdate({ whatsappMessageId, status, errorMessage = null }) {
  if (!whatsappMessageId || !status) return;

  const log = await prisma.messageLog.findFirst({
    where: { metadata: { path: ["whatsappMessageId"], equals: whatsappMessageId } },
    include: { service: true },
  });
  if (!log) return;

  const rank = { sent: 1, delivered: 2, read: 3, failed: 3 };
  const currentRank = rank[log.status?.toLowerCase()] || 0;
  const newRank = rank[status] || 0;
  if (status !== "failed" && newRank <= currentRank) return;

  await prisma.messageLog.update({
    where: { id: log.id },
    data: {
      status,
      errorMessage: status === "failed" ? (errorMessage || "Message delivery failed") : null,
    },
  });

  if (status === "failed") {
    const existingRetry = await prisma.retryQueue.findFirst({
      where: { messageLogId: log.id },
    });
    if (!existingRetry) {
      await prisma.retryQueue.create({
        data: {
          storeId: log.storeId,
          messageLogId: log.id,
          orderId: log.orderId || "",
          orderName: log.orderName || "",
          customerPhone: log.customerPhone || "",
          templateName: log.templateName || "",
          serviceKey: log.service?.serviceKey || "",
          status: "failed",
          errorMessage: errorMessage || "Message delivery failed",
        },
      });
      console.log(`🔁 Retry queued for failed message ${whatsappMessageId}`);
    }
  }

  console.log(`📊 Status updated: ${status} for ${whatsappMessageId}`);
}


// ==================== REVIEW REQUEST FLOW ====================
export async function processReviewReply({ contextMessageId, phone, phoneNumberId, listReplyId, buttonText, textBody }) {
  const {
    sendRatingList,
    handleRatingReply,
    handleReviewText,
  } = await import("./reviewResponse.server.js");

  let store = null;
  if (phoneNumberId) {
    store = await prisma.store.findFirst({ where: { whatsappPhoneId: phoneNumberId } });
  }

  const cleanPhone = (phone || "").replace(/[\s\-\+]/g, "");

  if (contextMessageId) {
    const rr = await prisma.reviewRequest.findFirst({
      where: {
        whatsappMessageId: contextMessageId,
        ...(store ? { storeId: store.id } : {}),
      },
      include: { store: true },
    });
    if (rr) {
      if (!store) store = rr.store;
      if (rr.status === "requested" || rr.status === "rating_sent") {
        await sendRatingList(store, rr);
        return true;
      }
    }
  }

  const openReview = await prisma.reviewRequest.findFirst({
    where: {
      customerPhone: cleanPhone,
      status: { in: ["rating_sent", "rated"] },
      ...(store ? { storeId: store.id } : {}),
    },
    orderBy: { id: "desc" },
    include: { store: true },
  });
  if (!openReview) return false;
  if (!store) store = openReview.store;


  if (listReplyId && listReplyId.startsWith("review_rating_") && openReview.status === "rating_sent") {
    const rating = parseInt(listReplyId.replace("review_rating_", ""), 10) || 5;
    await handleRatingReply(store, openReview, rating);
    return true;
  }

  if (textBody && openReview.status === "rated") {
    await handleReviewText(store, openReview, textBody.trim());
    return true;
  }

  return false;
}