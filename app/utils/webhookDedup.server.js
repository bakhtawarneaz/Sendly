import prisma from "../db.server";

export async function isDuplicateWebhook(request, topic = null) {
  const webhookId = request.headers.get("x-shopify-webhook-id");
  if (!webhookId) return false; // no id — can't dedupe, let it through

  try {
    await prisma.webhookEvent.create({
      data: { id: webhookId, topic },
    });
    return false; 
  } catch (e) {
    if (e.code === "P2002") return true;
    console.warn("Webhook dedup check failed:", e.message);
    return false;
  }
}