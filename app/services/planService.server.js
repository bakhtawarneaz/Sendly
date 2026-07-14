import prisma from "../db.server";
import { PLAN, isTrialActive, hasActiveSubscription, trialDaysLeft } from "../utils/billing.server.js";
import { getStore } from "../utils/helpers.server.js";

// ==================== LOAD PLANS PAGE ====================
export async function loadPlansPage(session) {
  const store = await getStore(session);
  if (!store) return { error: "Store not found" };

  return {
    error: null,
    plan: PLAN,
    isTrial: isTrialActive(store),
    isSubscribed: hasActiveSubscription(store),
    trialDaysLeft: trialDaysLeft(store),
    billingStatus: store.billingStatus,
    shopDomain: session.shop,
  };
}

// ==================== SUBSCRIBE ====================
export async function subscribeToPlan(admin, session) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };

  const trialDays = store.trialStartDate ? 0 : PLAN.trialDays;

  try {
    const response = await admin.graphql(
      `#graphql
        mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $trialDays: Int, $test: Boolean) {
          appSubscriptionCreate(name: $name, lineItems: $lineItems, returnUrl: $returnUrl, trialDays: $trialDays, test: $test) {
            appSubscription { id status }
            confirmationUrl
            userErrors { field message }
          }
        }`,
      {
        variables: {
          name: PLAN.name,
          returnUrl: `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/plans`,
          trialDays,
          test: process.env.NODE_ENV !== "production",
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  price: { amount: PLAN.price, currencyCode: PLAN.currency },
                  interval: "EVERY_30_DAYS",
                },
              },
            },
          ],
        },
      }
    );

    const json = await response.json();
    const { confirmationUrl, userErrors } = json.data.appSubscriptionCreate;

    if (userErrors?.length > 0) {
      return { success: false, error: userErrors[0].message };
    }

    return { success: true, confirmationUrl };
  } catch (error) {
    console.error("Subscription error:", error);
    return { success: false, error: error.message };
  }
}

// ==================== SYNC SUBSCRIPTION STATUS ====================
export async function syncSubscriptionStatus(admin, session) {
  const store = await getStore(session);
  if (!store) return;

  try {
    const response = await admin.graphql(
      `#graphql
      query {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            currentPeriodEnd
          }
        }
      }`
    );

    const json = await response.json();
    const subs = json?.data?.currentAppInstallation?.activeSubscriptions || [];
    const active = subs.find((s) => s.status === "ACTIVE");

    if (active) {
      if (store.billingStatus !== "active" || store.billingPlan !== PLAN.key) {
        await prisma.store.update({
          where: { id: store.id },
          data: {
            billingPlan: PLAN.key,
            billingStatus: "active",
            shopifyChargeId: active.id,
            isTrialActive: false,
          },
        });
        console.log(`💳 Subscription activated for ${session.shop}`);
      }
    } else {
      // No active subscription — freeze if trial is over
      const stillOnTrial = isTrialActive(store);
      const newStatus = stillOnTrial ? "trial" : "frozen";

      if (store.billingStatus !== newStatus || store.billingPlan !== "none") {
        await prisma.store.update({
          where: { id: store.id },
          data: {
            billingPlan: "none",
            billingStatus: newStatus,
            shopifyChargeId: null,
          },
        });
      }
    }
  } catch (error) {
    console.warn("Subscription sync failed:", error.message);
  }
}