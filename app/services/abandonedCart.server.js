import prisma from "../db.server";
import { sendTemplateMessage } from "./whatsappSender.server";
import { resolveTemplateVariables } from "../utils/templateVariables.js";
import { buildVarArray } from "./message.server.js";
import { getProductImageUrl } from "./productImage.server.js";
import { canSendMessage } from "../utils/billing.server.js";

async function hasPlacedOrder(store, checkoutToken) {
  try {
    const session = await prisma.session.findFirst({
      where: { shop: store.shopDomain, isOnline: false },
      orderBy: { id: "desc" },
    });
    if (!session?.accessToken) return false;

    const response = await fetch(
      `https://${store.shopDomain}/admin/api/2024-10/checkouts/${checkoutToken}.json`,
      { headers: { "X-Shopify-Access-Token": session.accessToken } }
    );

    if (!response.ok) return false;
    const data = await response.json();
    return !!(data?.checkout?.completed_at || data?.checkout?.order_id);
  } catch (e) {
    console.warn("Order check failed:", e.message);
    return false;
  }
}

// ==================== HELPERS: keep AbandonedReminder + checkout in sync ====================

function reminderNumberFromKey(reminderKey) {
  const n = Number(String(reminderKey || "").replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveMessageBody(template, varArray) {
  let body = template.body || "";
  (varArray || []).forEach((val, i) => {
    body = body.replaceAll(`{{${i + 1}}}`, String(val ?? ""));
  });
  return body;
}

async function updateReminderRow(abandonedCheckoutId, reminderNumber, data) {
  if (!abandonedCheckoutId || !reminderNumber) return;
  try {
    await prisma.abandonedReminder.updateMany({
      where: { abandonedCheckoutId: BigInt(abandonedCheckoutId), reminderNumber },
      data,
    });
  } catch (e) {
    console.warn(`⚠️ Could not update reminder row: ${e.message}`);
  }
}

async function markCheckoutReminded(abandonedCheckoutId, when) {
  if (!abandonedCheckoutId) return;
  try {
    await prisma.abandonedCheckout.update({
      where: { id: BigInt(abandonedCheckoutId) },
      data: {
        status: "reminded",
        remindersSent: { increment: 1 },
        lastReminderAt: when,
      },
    });
  } catch (e) {
    console.warn(`⚠️ Could not update checkout: ${e.message}`);
  }
}

async function markCheckoutRecovered(abandonedCheckoutId) {
  if (!abandonedCheckoutId) return;
  try {
    await prisma.abandonedCheckout.update({
      where: { id: BigInt(abandonedCheckoutId) },
      data: { status: "recovered", recoveredAt: new Date() },
    });
  } catch (e) {
    console.warn(`⚠️ Could not mark checkout recovered: ${e.message}`);
  }
}

function buildCheckoutOrder(job) {
  const { customerName, customerPhone, checkoutUrl, totalPrice, currency, lineItems, createdAt } = job;
  const [firstName, ...rest] = (customerName || "").split(" ");

  return {
    id: "",
    name: "",
    order_number: "",
    total_price: totalPrice,
    currency,
    created_at: createdAt,
    financial_status: "",
    payment_gateway_names: [],
    abandoned_checkout_url: checkoutUrl,
    order_status_url: checkoutUrl,
    phone: customerPhone,
    customer: { first_name: firstName || "", last_name: rest.join(" ") },
    billing_address: { first_name: firstName || "", last_name: rest.join(" "), phone: customerPhone },
    shipping_address: {},
    line_items: (lineItems || []).map((item) => ({
      name: item.name,
      title: item.name,
      quantity: item.quantity,
      price: item.price,
      product_id: item.productId,
    })),
    fulfillments: [],
    discount_code: job.discountCode || "",
  };
}

export async function processAbandonedCartJob(job) {
  const {
    storeId, serviceId, customerPhone, customerName, checkoutToken,
    checkoutId, createdAt, expiryDays, reminderKey, templateId,
    discountCode, includeImage, lineItems, abandonedCheckoutId,
    reminderNumber: reminderNumberFromJob,
  } = job;

  const reminderNumber = reminderNumberFromJob ?? reminderNumberFromKey(reminderKey);

  console.log(`🛒 Abandoned cart ${reminderKey} | ${customerPhone} | ${checkoutToken}`);

  const daysSince = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24);
  if (daysSince > expiryDays) {
    await updateReminderRow(abandonedCheckoutId, reminderNumber, { status: "cancelled", errorMessage: "Checkout expired" });
    return { skipped: true, reason: "expired" };
  }

  const store = await prisma.store.findUnique({ where: { id: BigInt(storeId) } });
  if (!store) throw new Error("Store not found");
  if (!store.whatsappConnected) return { skipped: true, reason: "not_connected" };

  const { allowed } = canSendMessage(store);
  if (!allowed) return { skipped: true, reason: "billing_frozen" };

  if (await hasPlacedOrder(store, checkoutToken)) {
    await updateReminderRow(abandonedCheckoutId, reminderNumber, { status: "cancelled", errorMessage: "Order already placed" });
    await markCheckoutRecovered(abandonedCheckoutId);
    return { skipped: true, reason: "order_placed" };
  }

  const alreadySent = await prisma.messageLog.findFirst({
    where: {
      storeId: BigInt(storeId),
      serviceId: BigInt(serviceId),
      orderId: checkoutToken,
      status: "sent",
      metadata: { path: ["reminderKey"], equals: reminderKey },
    },
  });
  if (alreadySent) return { skipped: true, reason: "duplicate" };

  if (!templateId) {
    await updateReminderRow(abandonedCheckoutId, reminderNumber, { status: "failed", errorMessage: "No template" });
    return { skipped: true, reason: "no_template" };
  }

  const template = await prisma.template.findUnique({ where: { id: BigInt(templateId) } });
  if (!template || template.status !== "approved") {
    await updateReminderRow(abandonedCheckoutId, reminderNumber, { status: "failed", errorMessage: "Template not approved" });
    return { skipped: true, reason: "template_not_ready" };
  }

  // mark processing
  await updateReminderRow(abandonedCheckoutId, reminderNumber, { status: "processing" });

  const checkoutOrder = buildCheckoutOrder(job);
  const variables = resolveTemplateVariables(template, checkoutOrder, store);
  const varArray = buildVarArray(template, variables);

  let productImageUrl = null;
  if (includeImage && lineItems?.[0]?.productId) {
    const session = await prisma.session.findFirst({
      where: { shop: store.shopDomain, isOnline: false },
      orderBy: { id: "desc" },
    });
    if (session?.accessToken) {
      productImageUrl = await getProductImageUrl(store.shopDomain, session.accessToken, checkoutOrder);
    }
  }

  const orderName = `Checkout ${checkoutToken.substring(0, 8)}`;

  try {
    const result = await sendTemplateMessage(store, template, customerPhone, varArray, [], productImageUrl);
    const now = new Date();

    await prisma.messageLog.create({
      data: {
        storeId: BigInt(storeId),
        serviceId: BigInt(serviceId),
        orderId: checkoutToken,
        orderName,
        customerPhone,
        customerName: customerName || "",
        messageType: "abandoned_checkout",
        templateName: template.name,
        status: "sent",
        direction: "outbound",
        metadata: {
          whatsappMessageId: result.messageId,
          variables: varArray,
          reminderKey,
          checkoutId,
          discountCode,
          abandonedCart: true,
        },
        sentAt: now,
      },
    });

    await updateReminderRow(abandonedCheckoutId, reminderNumber, {
      status: "sent",
      sentAt: now,
      whatsappMessageId: result.messageId || null,
      messageBody: resolveMessageBody(template, varArray),
      templateName: template.name,
      errorMessage: null,
    });
    await markCheckoutReminded(abandonedCheckoutId, now);

    console.log(`✅ Abandoned cart ${reminderKey} sent to ${customerPhone}`);
    return { success: true, messageId: result.messageId, reminderKey };
  } catch (error) {
    console.error(`❌ Abandoned cart ${reminderKey} failed: ${error.message}`);

    const failedLog = await prisma.messageLog.create({
      data: {
        storeId: BigInt(storeId),
        serviceId: BigInt(serviceId),
        orderId: checkoutToken,
        orderName,
        customerPhone,
        customerName: customerName || "",
        messageType: "abandoned_checkout",
        templateName: template.name,
        status: "failed",
        direction: "outbound",
        errorMessage: error.message,
        metadata: { variables: varArray, reminderKey, abandonedCart: true },
        sentAt: new Date(),
      },
    });

    await updateReminderRow(abandonedCheckoutId, reminderNumber, {
      status: "failed",
      errorMessage: error.message,
      templateName: template.name,
    });

    await prisma.retryQueue.create({
      data: {
        storeId: BigInt(storeId),
        messageLogId: failedLog.id,
        orderId: checkoutToken,
        orderName,
        customerPhone,
        templateName: template.name,
        serviceKey: "abandoned_checkout",
        status: "failed",
        errorMessage: error.message,
      },
    });

    throw error;
  }
}