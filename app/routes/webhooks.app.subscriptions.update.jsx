import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { PLAN, isTrialActive } from "../utils/billing.server.js";

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    const subscription = payload?.app_subscription;
    const status = subscription?.status;

    const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
    if (!store) return new Response();

    if (status === "ACTIVE") {
      await prisma.store.update({
        where: { id: store.id },
        data: {
          billingPlan: PLAN.key,
          billingStatus: "active",
          shopifyChargeId: String(subscription.admin_graphql_api_id || ""),
          isTrialActive: false,
        },
      });
      console.log(`💳 Subscription active for ${shop}`);
    } else if (["CANCELLED", "EXPIRED", "DECLINED", "FROZEN"].includes(status)) {
      const stillOnTrial = isTrialActive(store);
      await prisma.store.update({
        where: { id: store.id },
        data: {
          billingPlan: "none",
          billingStatus: stillOnTrial ? "trial" : "frozen",
          shopifyChargeId: null,
        },
      });
      console.log(`⏸️  Subscription ${status.toLowerCase()} for ${shop}`);
    }
  } catch (error) {
    console.error("Subscription webhook error:", error);
  }

  return new Response();
};