import prisma from "../db.server";
import { sendTemplateMessage } from "./whatsappSender.server";

// ==================== BUILD VAR ARRAY ====================
export function buildVarArray(template, variables) {
  const body = template.body || "";
  const regex = /\{\{(\d+)\}\}/g;
  const detectedVars = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    if (!detectedVars.includes(match[1])) detectedVars.push(match[1]);
  }
  detectedVars.sort((a, b) => parseInt(a) - parseInt(b));

  if (detectedVars.length > 0) {
    return detectedVars.map((k) => variables[k] || "");
  }
  return [];
}

// ==================== DUPLICATE CHECK ====================
export async function isDuplicate(storeId, serviceId, orderId) {
  const existing = await prisma.messageLog.findFirst({
    where: {
      storeId,
      serviceId,
      orderId: String(orderId || ""),
      status: { in: ["sent", "pending"] },
    },
  });
  return !!existing;
}

// ==================== SEND AND LOG ====================
export async function sendAndLog({ store, template, storeService, orderId, orderName, phone, variables, productImageUrl = null }) {
  const varArray = buildVarArray(template, variables);
  const serviceKey = storeService.service.serviceKey;

  try {
    const result = await sendTemplateMessage(store, template, phone, varArray, [], productImageUrl);

    const logEntry = await prisma.messageLog.create({
      data: {
        storeId: store.id,
        serviceId: storeService.service.id,
        orderId: String(orderId || ""),
        orderName: orderName || "",
        customerPhone: phone,
        customerName: variables["1"] || "",
        messageType: serviceKey,
        templateName: template.name,
        status: "sent",
        direction: "outbound",
        metadata: { whatsappMessageId: result.messageId, variables: varArray },
        sentAt: new Date(),
      },
    });

    console.log(`${serviceKey} message sent to ${phone}`);
    return { success: true, messageId: result.messageId, messageLogId: String(logEntry.id) };
  } catch (error) {
    console.error(`Failed to send ${serviceKey}:`, error.message);

    const failedLog = await prisma.messageLog.create({
      data: {
        storeId: store.id,
        serviceId: storeService.service.id,
        orderId: String(orderId || ""),
        orderName: orderName || "",
        customerPhone: phone,
        customerName: variables["1"] || "",
        messageType: serviceKey,
        templateName: template.name,
        status: "failed",
        direction: "outbound",
        errorMessage: error.message,
        metadata: { variables: varArray },
        sentAt: new Date(),
      },
    });

    await prisma.retryQueue.create({
      data: {
        storeId: store.id,
        messageLogId: failedLog.id,
        orderId: String(orderId || ""),
        orderName: orderName || "",
        customerPhone: phone,
        templateName: template.name,
        serviceKey: serviceKey,
        status: "failed",
        errorMessage: error.message,
      },
    });

    return { success: false, error: error.message };
  }
}