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
    const order = payload;
    const store = await getStoreWithServices(shop);
    if (!store) return new Response();

    try {
      const { attributeOrderToCampaign } = await import("../services/campaignAttribution.server.js");
      const result = await attributeOrderToCampaign(order, store);
      if (result.attributed) {
        console.log(`📢 Order ${order?.name} attributed to campaign: ${result.campaign_name}`);
      }
    } catch (error) {
      console.warn("Campaign attribution error:", error.message);
    }

    await processOrderNotification({
      shop,
      store,
      order,
      serviceKey: "order_confirmation_whatsapp",
    });
  } catch (error) {
    console.error("Order create webhook error:", error);
  }

  return new Response();
};