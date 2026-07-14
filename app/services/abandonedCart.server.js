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

// ==================== BUILD A CHECKOUT-SHAPED ORDER OBJECT ====================
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

// ==================== PROCESS ONE REMINDER JOB ====================
export async function processAbandonedCartJob(job) {
  const {
    storeId, serviceId, customerPhone, customerName, checkoutToken,
    checkoutId, createdAt, expiryDays, reminderKey, templateId,
    discountCode, includeImage, lineItems,
  } = job;

  console.log(`🛒 Abandoned cart ${reminderKey} | ${customerPhone} | ${checkoutToken}`);

  const daysSince = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24);
  if (daysSince > expiryDays) {
    console.log(`⏰ Checkout expired (${Math.round(daysSince)}d > ${expiryDays}d) — skipping`);
    return { skipped: true, reason: "expired" };
  }

  const store = await prisma.store.findUnique({ where: { id: BigInt(storeId) } });
  if (!store) throw new Error("Store not found");
  if (!store.whatsappConnected) return { skipped: true, reason: "not_connected" };

  const { allowed } = canSendMessage(store);
  if (!allowed) return { skipped: true, reason: "billing_frozen" };

  if (await hasPlacedOrder(store, checkoutToken)) {
    console.log(`✅ Checkout already completed — skipping reminder`);
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
  if (alreadySent) {
    console.log(`⚠️ ${reminderKey} already sent for ${checkoutToken} — skipping`);
    return { skipped: true, reason: "duplicate" };
  }

  if (!templateId) return { skipped: true, reason: "no_template" };

  const template = await prisma.template.findUnique({ where: { id: BigInt(templateId) } });
  if (!template || template.status !== "approved") {
    console.log(`⚠️ Template not approved — skipping`);
    return { skipped: true, reason: "template_not_ready" };
  }

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
        sentAt: new Date(),
      },
    });

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