import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    const customerPhone = payload?.customer?.phone || null;
    const orderIds = (payload?.orders_to_redact || []).map(String);

    const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
    if (!store) return new Response();

    const filters = [];
    if (customerPhone) {
      const last10 = customerPhone.replace(/[\s\-\+]/g, "").slice(-10);
      filters.push({ customerPhone: { contains: last10 } });
    }
    if (orderIds.length > 0) {
      filters.push({ orderId: { in: orderIds } });
    }

    if (filters.length === 0) {
      console.log(`No identifiers in redact request for ${shop}`);
      return new Response();
    }

    const where = { storeId: store.id, OR: filters };

    const redacted = await prisma.messageLog.updateMany({
      where,
      data: {
        customerName: null,
        customerPhone: null,
        customerResponse: null,
        metadata: {},
      },
    });

    const campaignFilters = [];
    if (customerPhone) {
      const last10 = customerPhone.replace(/[\s\-\+]/g, "").slice(-10);
      campaignFilters.push({ customerPhone: { contains: last10 } });
    }
    if (orderIds.length > 0) {
      campaignFilters.push({ shopifyOrderId: { in: orderIds } });
    }

    let campaignDeleted = { count: 0 };
    if (campaignFilters.length > 0) {
      campaignDeleted = await prisma.campaignOrder.deleteMany({
        where: { storeId: store.id, OR: campaignFilters },
      });
    }

    if (customerPhone) {
      const last10 = customerPhone.replace(/[\s\-\+]/g, "").slice(-10);
      await prisma.retryQueue.deleteMany({
        where: { storeId: store.id, customerPhone: { contains: last10 } },
      });
    }

    console.log(
      `🗑️  GDPR redact for ${shop}: ${redacted.count} message logs anonymised, ${campaignDeleted.count} campaign orders deleted`
    );
  } catch (error) {
    console.error("Customer redact webhook error:", error);
  }

  return new Response();
};