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

export async function processButtonReply({ contextMessageId, buttonText }) {
  console.log("🔔 Callback:", { contextMessageId, buttonText });
  if (!contextMessageId) return;

  const log = await prisma.messageLog.findFirst({
    where: { metadata: { path: ["whatsappMessageId"], equals: contextMessageId } },
    include: { store: true, service: true },
  });
  console.log("📋 Log found:", log ? `yes, order ${log.orderId}` : "NO");
  if (!log) return;

  if (log.service?.serviceKey !== "order_confirmation_whatsapp") return;

  const store = log.store;
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