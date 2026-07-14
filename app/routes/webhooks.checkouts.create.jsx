import { authenticate } from "../shopify.server";
import { getStoreWithServices } from "../utils/helpers.server.js";
import { parseConfig } from "../services/order.server.js";
import { parseDelayToMs } from "../utils/delay.js";
import { canSendMessage } from "../utils/billing.server.js";

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    const checkout = payload;
    const store = await getStoreWithServices(shop);
    if (!store || !store.whatsappConnected) return new Response();

    const { allowed, reason } = canSendMessage(store);
    if (!allowed) {
      console.log(`⏸️  Abandoned cart paused for ${shop}: ${reason}`);
      return new Response();
    }

    const customerPhone =
      checkout?.billing_address?.phone ||
      checkout?.shipping_address?.phone ||
      checkout?.phone ||
      null;

    if (!customerPhone) {
      console.log(`No phone number in checkout ${checkout?.token}`);
      return new Response();
    }

    for (const storeService of store.storeServices) {
      if (storeService.service.serviceKey !== "abandoned_checkout") continue;

      const config = parseConfig(storeService);
      const reminders = config.reminders || {};
      const expiryDays = config.expiryDays || 7;

      const hasEnabledReminder = Object.values(reminders).some((r) => r.enabled);
      if (!hasEnabledReminder) {
        console.log("No abandoned cart reminders enabled");
        continue;
      }

      const { abandonedCartQueue } = await import("../queues/queues.server.js");

      const checkoutData = {
        storeId: String(store.id),
        serviceId: String(storeService.service.id),
        customerPhone,
        customerName: `${checkout?.billing_address?.first_name || ""} ${checkout?.billing_address?.last_name || ""}`.trim(),
        checkoutToken: checkout?.token || "",
        checkoutId: String(checkout?.id || ""),
        checkoutUrl: checkout?.abandoned_checkout_url || "",
        totalPrice: checkout?.total_price || "0.00",
        currency: checkout?.currency || store.currency || "PKR",
        lineItems: (checkout?.line_items || []).map((item) => ({
          name: item.title || item.name,
          quantity: item.quantity,
          price: item.price,
          productId: item.product_id,
        })),
        createdAt: checkout?.created_at || new Date().toISOString(),
        expiryDays,
      };

      for (const [key, reminder] of Object.entries(reminders)) {
        if (!reminder.enabled) continue;

        await abandonedCartQueue.add(
          `reminder-${key}`,
          {
            ...checkoutData,
            reminderKey: key,
            templateId: reminder.templateId || "",
            discountCode: reminder.discountCode || "",
            includeImage: reminder.productImage || false,
          },
          {
            delay: parseDelayToMs(reminder.delay || "30_min"),
            attempts: 2,
            backoff: { type: "exponential", delay: 60000 },
            jobId: `${checkout?.token}-${key}`,
          }
        );

        console.log(`⏳ Abandoned cart ${key} reminder queued (${reminder.delay}) for ${customerPhone}`);
      }
    }
  } catch (error) {
    console.error("Abandoned checkout webhook error:", error);
  }

  return new Response();
};