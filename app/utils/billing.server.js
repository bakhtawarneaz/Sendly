// ==================== BILLING / TRIAL ====================

export const PLAN = {
    key: "pro",
    name: "Sendly Pro",
    price: 19.99,
    currency: "USD",
    trialDays: 7,
  };
  
  // Is the store within its free trial?
  export function isTrialActive(store) {
    if (!store?.isTrialActive) return false;
    if (!store.trialEndDate) return false;
    return new Date(store.trialEndDate) > new Date();
  }
  
  // Does the store have an active paid subscription?
  export function hasActiveSubscription(store) {
    return store?.billingStatus === "active" && store?.billingPlan === PLAN.key;
  }
  
  // Can this store send messages right now?
  export function canSendMessage(store) {
    if (hasActiveSubscription(store)) return { allowed: true };
    if (isTrialActive(store)) return { allowed: true };
    return { allowed: false, reason: "Trial ended. Subscribe to resume sending messages." };
  }
  
  // Days remaining in trial (0 if expired or not on trial)
  export function trialDaysLeft(store) {
    if (!store?.trialEndDate) return 0;
    const diff = new Date(store.trialEndDate) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }