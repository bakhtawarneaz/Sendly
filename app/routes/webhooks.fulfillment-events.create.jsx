import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getStoreWithServices } from "../utils/helpers.server.js";
import { processOrderNotification } from "../services/orderNotification.server.js";

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
    const event = payload;

    if (String(event?.status || "").toLowerCase() !== "delivered") {
      console.log(`Fulfillment event status is "${event?.status}" — not delivered, skipping`);
      return new Response();
    }

    const store = await getStoreWithServices(shop);
    if (!store) return new Response();

    const order = await fetchOrder(shop, event.order_id);
    if (!order) {
      console.log(`Could not fetch order ${event.order_id}`);
      return new Response();
    }

    const fulfillment = (order.fulfillments || []).find(
      (f) => String(f.id) === String(event.fulfillment_id)
    ) || null;

    await processOrderNotification({
      shop,
      store,
      order,
      serviceKey: "order_delivered",
      fulfillment,
    });
  } catch (error) {
    console.error("Fulfillment event webhook error:", error);
  }

  return new Response();
};