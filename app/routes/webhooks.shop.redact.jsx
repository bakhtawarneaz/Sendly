import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
    if (!store) {
      console.log(`No store record for ${shop} — nothing to redact`);
      return new Response();
    }

    await prisma.store.delete({ where: { id: store.id } });

    await prisma.session.deleteMany({ where: { shop } });

    console.log(`🗑️  GDPR shop redact complete for ${shop} — all data deleted`);
  } catch (error) {
    console.error("Shop redact webhook error:", error);
  }

  return new Response();
};