// ==================== CAMPAIGN ATTRIBUTION ====================
import prisma from "../db.server";

function extractCampaignCode(landingSite) {
  if (!landingSite) return null;

  try {
    const url = landingSite.startsWith("http")
      ? new URL(landingSite)
      : new URL(`https://example.com${landingSite}`);

    const utmCampaign = url.searchParams.get("utm_campaign");
    if (utmCampaign) return utmCampaign;
  } catch (e) {
    // fall through to regex
  }

  const match = landingSite.match(/utm_campaign=([^&]+)/);
  return match ? match[1] : null;
}

export async function attributeOrderToCampaign(order, store) {
  try {
    const campaignCode = extractCampaignCode(order.landing_site || "");
    if (!campaignCode) return { attributed: false, reason: "No UTM campaign found" };

    const campaign = await prisma.campaign.findFirst({
      where: {
        campaignCode,
        storeId: store.id,
        status: { in: ["active", "paused"] },
      },
    });

    if (!campaign) return { attributed: false, reason: `No campaign found for code: ${campaignCode}` };

    const orderDate = new Date(order.created_at);
    const campaignStart = new Date(campaign.startDate);
    const campaignEnd = new Date(campaign.endDate);
    campaignEnd.setHours(23, 59, 59, 999); // include the whole end day

    if (orderDate < campaignStart) return { attributed: false, reason: "Order placed before campaign start" };
    if (orderDate > campaignEnd) return { attributed: false, reason: "Order placed after campaign end" };

    const existing = await prisma.campaignOrder.findFirst({
      where: { campaignId: campaign.id, shopifyOrderId: String(order.id) },
    });
    if (existing) return { attributed: false, reason: "Order already attributed" };

    const customerName = `${order.billing_address?.first_name || ""} ${order.billing_address?.last_name || ""}`.trim();
    const customerPhone = order.billing_address?.phone || order.customer?.phone || null;

    const attribution = await prisma.campaignOrder.create({
      data: {
        campaignId: campaign.id,
        storeId: store.id,
        shopifyOrderId: String(order.id),
        orderNumber: order.name || String(order.order_number || "") || null,
        customerPhone,
        customerName: customerName || null,
        revenue: parseFloat(order.total_price) || 0,
        currency: order.currency || store.currency || "USD",
        attributionType: "utm",
        attributedAt: new Date(),
        orderData: order,
      },
    });

    return {
      attributed: true,
      campaign_id: String(campaign.id),
      campaign_name: campaign.campaignName,
      revenue: Number(attribution.revenue),
    };
  } catch (error) {
    console.error("Campaign attribution error:", error.message);
    return { attributed: false, reason: `Error: ${error.message}` };
  }
}