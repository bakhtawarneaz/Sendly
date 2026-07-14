// ==================== BILLING / TRIAL ====================

export const PLAN = {
    key: "pro",
    name: "Sendly Pro",
    price: 19.99,
    currency: "USD",
    trialDays: 7,
  };
  
  export function isTrialActive(store) {
    if (!store?.isTrialActive) return false;
    if (!store.trialEndDate) return false;
    return new Date(store.trialEndDate) > new Date();
  }
  
  export function hasActiveSubscription(store) {
    return store?.billingStatus === "active" && store?.billingPlan === PLAN.key;
  }
  
  export function canSendMessage(store) {
    if (hasActiveSubscription(store)) return { allowed: true };
    if (isTrialActive(store)) return { allowed: true };
    return { allowed: false, reason: "Trial ended. Subscribe to resume sending messages." };
  }
  
  export function trialDaysLeft(store) {
    if (!store?.trialEndDate) return 0;
    const diff = new Date(store.trialEndDate) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }