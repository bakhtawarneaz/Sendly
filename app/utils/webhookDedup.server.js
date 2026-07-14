import prisma from "../db.server";

// Returns true if this webhook was already processed (duplicate).
// Uses the Shopify webhook id (unique per delivery) for idempotency.
export async function isDuplicateWebhook(request, topic = null) {
  const webhookId = request.headers.get("x-shopify-webhook-id");
  if (!webhookId) return false; // no id — can't dedupe, let it through

  try {
    await prisma.webhookEvent.create({
      data: { id: webhookId, topic },
    });
    return false; // inserted successfully — first time, process it
  } catch (e) {
    // Unique constraint violation — already processed
    if (e.code === "P2002") return true;
    // Any other error — don't block processing
    console.warn("Webhook dedup check failed:", e.message);
    return false;
  }
}