import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    const customerPhone = payload?.customer?.phone || null;
    const customerEmail = payload?.customer?.email || null;
    const orderIds = payload?.orders_requested || [];

    const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
    if (!store) return new Response();

    // Collect all data we hold for this customer
    const where = { storeId: store.id };
    if (customerPhone) {
      where.customerPhone = { contains: customerPhone.replace(/[\s\-\+]/g, "").slice(-10) };
    } else if (orderIds.length > 0) {
      where.orderId = { in: orderIds.map(String) };
    } else {
      console.log(`No identifiers in data request for ${shop}`);
      return new Response();
    }

    const messageLogs = await prisma.messageLog.findMany({
      where,
      select: {
        orderId: true,
        orderName: true,
        customerName: true,
        customerPhone: true,
        messageType: true,
        templateName: true,
        status: true,
        sentAt: true,
        createdAt: true,
      },
    });

    const campaignOrders = await prisma.campaignOrder.findMany({
      where: {
        storeId: store.id,
        ...(customerPhone ? { customerPhone: { contains: customerPhone.replace(/[\s\-\+]/g, "").slice(-10) } } : {}),
      },
      select: {
        shopifyOrderId: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        revenue: true,
        currency: true,
        createdAt: true,
      },
    });

    // Shopify requires the app to provide this data to the merchant
    // within 30 days. Log it here — the merchant can be sent this
    // export via the app's support channel.
    console.log(
      `📄 GDPR data request for ${shop} | phone: ${customerPhone} | email: ${customerEmail}`,
      JSON.stringify({ messageLogs, campaignOrders }, null, 2)
    );
  } catch (error) {
    console.error("Customer data request webhook error:", error);
  }

  return new Response();
};