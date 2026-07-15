import { authenticate } from "../shopify.server";
import { getStoreWithServices } from "../utils/helpers.server.js";
import { parseConfig } from "../services/order.server.js";
import { canSendMessage } from "../utils/billing.server.js";
import { upsertCheckoutAndSchedule } from "../services/abandonedSync.server.js";

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

    const recoveryUrl = checkout?.abandoned_checkout_url || "";
    const checkoutToken = checkout?.token || "";
    if (!checkoutToken) return new Response();

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

      const customerName = `${checkout?.billing_address?.first_name || ""} ${checkout?.billing_address?.last_name || ""}`.trim() || "Guest";
      const lineItems = (checkout?.line_items || []).map((item) => ({
        name: item.title || item.name,
        quantity: item.quantity,
        price: item.price,
        productId: item.product_id ? String(item.product_id) : null,
      }));

      await upsertCheckoutAndSchedule({
        store,
        storeService,
        reminders,
        expiryDays,
        checkout: {
          checkoutToken,
          shopifyCheckoutId: String(checkout?.id || ""),
          customerName,
          customerPhone,
          customerEmail: checkout?.email || checkout?.customer?.email || null,
          cartItems: lineItems,
          cartTotal: checkout?.total_price || "0",
          currency: checkout?.currency || store.currency || "PKR",
          recoveryUrl,
          createdAt: checkout?.created_at || new Date().toISOString(),
        },
        source: "webhook",
      });

      console.log(`⏳ Abandoned checkout tracked + reminders queued for ${customerPhone}`);
    }
  } catch (error) {
    console.error("Abandoned checkout webhook error:", error);
  }

  return new Response();
};