import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getStoreWithServices } from "../utils/helpers.server.js";
import { processOrderNotification } from "../services/orderNotification.server.js";
import { scheduleReviewRequest } from "../services/reviewRequest.server.js";

async function fetchOrder(shop, orderId) {
  const session = await prisma.session.findFirst({
    where: { shop, isOnline: false },
    orderBy: { id: "desc" },
  });
  if (!session?.accessToken) return null;

  const response = await fetch(
    `https://${shop}/admin/api/2024-10/orders/${orderId}.json`,
    { headers: { "X-Shopify-Access-Token": session.accessToken } }
  );
  if (!response.ok) return null;

  const data = await response.json();
  return data?.order || null;
}

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const { isDuplicateWebhook } = await import("../utils/webhookDedup.server.js");
  if (await isDuplicateWebhook(request, topic)) {
    console.log(`⏭️  Duplicate webhook skipped: ${topic}`);
    return new Response();
  }

  try {
    const fulfillment = payload;
    const store = await getStoreWithServices(shop);
    if (!store) return new Response();

    const order = await fetchOrder(shop, fulfillment.order_id);
    if (!order) {
      console.log(`Could not fetch order ${fulfillment.order_id}`);
      return new Response();
    }

    await processOrderNotification({
      shop,
      store,
      order,
      serviceKey: "order_fulfillment",
      fulfillment,
    });

    await scheduleReviewRequest({ shop, store, order });
  } catch (error) {
    console.error("Fulfillment create webhook error:", error);
  }

  return new Response();
};