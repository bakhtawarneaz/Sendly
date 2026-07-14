import { authenticate } from "../shopify.server";
import { getStoreWithServices } from "../utils/helpers.server.js";
import { processOrderNotification } from "../services/orderNotification.server.js";

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const { isDuplicateWebhook } = await import("../utils/webhookDedup.server.js");
  if (await isDuplicateWebhook(request, topic)) {
    console.log(`⏭️  Duplicate webhook skipped: ${topic}`);
    return new Response();
  }

  try {
    const store = await getStoreWithServices(shop);
    await processOrderNotification({
      shop,
      store,
      order: payload,
      serviceKey: "order_cancelled",
    });
  } catch (error) {
    console.error("Order cancelled webhook error:", error);
  }

  return new Response();
};