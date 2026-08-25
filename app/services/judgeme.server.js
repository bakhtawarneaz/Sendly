import { decrypt } from "../utils/encryption.server.js";


export async function submitJudgeMeReview(store, reviewRequest, reviewBody) {
  if (!store.judgeMeApiToken || !store.judgeMeShopDomain) {
    throw new Error("Judge.me credentials not configured");
  }

  const apiToken = decrypt(store.judgeMeApiToken);
  const shopDomain = store.judgeMeShopDomain;

  const payload = {
    shop_domain: shopDomain,
    api_token: apiToken,
    platform: "shopify",
    name: reviewRequest.customerName || "Customer",
    email: reviewRequest.customerEmail || `${reviewRequest.customerPhone}@noemail.invalid`,
    rating: reviewRequest.rating || 5,
    body: reviewBody || "",
  };

  if (reviewRequest.productId) {
    payload.id = reviewRequest.productId;        
    payload.platform = "shopify";
  }

  const res = await fetch("https://judge.me/api/v1/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    throw new Error(`Judge.me API error: ${data.error || res.status}`);
  }

  return { success: true, judgeMeReviewId: data.review?.id || null };
}