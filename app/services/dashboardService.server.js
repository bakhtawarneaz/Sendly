export async function loadDashboard(admin, store) {
    const response = await admin.graphql(
      `#graphql
        query {
          shop {
            name
            email
            myshopifyDomain
            plan { displayName }
            currencyCode
          }
        }`
    );
    const responseJson = await response.json();
    const shop = responseJson.data.shop;
  
    const now = new Date();
  
    const trialEndDate = store.trialEndDate ? new Date(store.trialEndDate) : null;
    const trialDaysLeft = trialEndDate
      ? Math.max(0, Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)))
      : 0;
    const isTrial = store.isTrialActive && trialDaysLeft > 0;
  
    const { default: prisma } = await import("../db.server");
    const activeServices = await prisma.storeService.count({
      where: { storeId: store.id, isEnabled: true },
    });
  
    return {
      shop,
      isTrial,
      trialDaysLeft,
      whatsappConnected: store.whatsappConnected,
      billingStatus: store.billingStatus,
      activeServices,
      isFrozen: store.billingStatus === "frozen",
    };
  }