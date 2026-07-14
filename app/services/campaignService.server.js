import prisma from "../db.server";
import crypto from "crypto";
import { getStore } from "../utils/helpers.server.js";

// ==================== LOAD CAMPAIGNS (listing) ====================
export async function loadCampaigns(session, page = 1, perPage = 10) {
  const store = await getStore(session);
  if (!store) return { campaigns: [], stats: {}, totalPages: 0, currentPage: 1, totalCount: 0, currency: "USD" };

  const currency = store.currency || "USD";

  const [campaigns, totalCount] = await Promise.all([
    prisma.campaign.findMany({
      where: { storeId: store.id },
      include: { campaignOrders: { select: { revenue: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.campaign.count({ where: { storeId: store.id } }),
  ]);

  const now = new Date();

  return {
    campaigns: campaigns.map((c) => {
      const totalRevenue = c.campaignOrders.reduce((sum, o) => sum + Number(o.revenue), 0);
      const isExpired = new Date(c.endDate) < now;
      return {
        id: String(c.id),
        campaignName: c.campaignName,
        campaignCode: c.campaignCode,
        trackingUrl: c.trackingUrl,
        startDate: new Date(c.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        endDate: new Date(c.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: isExpired && c.status === "active" ? "completed" : c.status,
        totalRevenue,
        totalOrders: c.campaignOrders.length,
      };
    }),
    stats: {
      total: totalCount,
      active: campaigns.filter((c) => c.status === "active" && new Date(c.endDate) >= now).length,
      totalRevenue: campaigns.reduce((sum, c) => sum + c.campaignOrders.reduce((s, o) => s + Number(o.revenue), 0), 0),
      totalOrders: campaigns.reduce((sum, c) => sum + c.campaignOrders.length, 0),
    },
    currency,
    totalPages: Math.ceil(totalCount / perPage),
    currentPage: page,
    totalCount,
  };
}

// ==================== LOAD SINGLE CAMPAIGN ====================
export async function loadCampaign(session, campaignId) {
  const store = await getStore(session);
  if (!store) return { error: "Store not found" };

  const campaign = await prisma.campaign.findUnique({
    where: { id: BigInt(campaignId) },
    include: { campaignOrders: { orderBy: { createdAt: "desc" } } },
  });

  if (!campaign || campaign.storeId !== store.id) return { error: "Campaign not found" };

  const currency = store.currency || "USD";
  const totalRevenue = campaign.campaignOrders.reduce((sum, o) => sum + Number(o.revenue), 0);
  const totalOrders = campaign.campaignOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const dailyMap = {};
  campaign.campaignOrders.forEach((o) => {
    const day = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    dailyMap[day] = (dailyMap[day] || 0) + Number(o.revenue);
  });

  const now = new Date();
  const isExpired = new Date(campaign.endDate) < now;
  const daysLeft = isExpired ? 0 : Math.ceil((new Date(campaign.endDate) - now) / (1000 * 60 * 60 * 24));

  return {
    error: null,
    currency,
    campaign: {
      id: String(campaign.id),
      campaignName: campaign.campaignName,
      campaignCode: campaign.campaignCode,
      trackingUrl: campaign.trackingUrl,
      targetUrl: campaign.targetUrl,
      startDate: new Date(campaign.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      endDate: new Date(campaign.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status: isExpired && campaign.status === "active" ? "completed" : campaign.status,
      notes: campaign.notes,
      daysLeft,
    },
    stats: { totalRevenue, totalOrders, avgOrderValue },
    dailyRevenue: Object.entries(dailyMap).map(([day, revenue]) => ({ day, Revenue: revenue })),
    orders: campaign.campaignOrders.map((o) => ({
      id: String(o.id),
      orderNumber: o.orderNumber || "—",
      customerName: o.customerName || "—",
      customerPhone: o.customerPhone || "—",
      revenue: Number(o.revenue),
      currency: o.currency,
      attributionType: o.attributionType,
      createdAt: new Date(o.createdAt).toLocaleString(),
    })),
  };
}

// ==================== LOAD CREATE PAGE ====================
export async function loadCreateCampaignPage(session) {
  const store = await getStore(session);
  if (!store) return { error: "Store not found" };
  return { error: null, storeUrl: `https://${session.shop}`, shopDomain: session.shop };
}

// ==================== CREATE CAMPAIGN ====================
export async function createCampaign(session, formData) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };

  const campaignName = formData.get("campaignName")?.trim();
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const notes = formData.get("notes")?.trim() || null;
  const targetUrl = formData.get("targetUrl")?.trim() || `https://${session.shop}`;

  if (!campaignName || !startDate || !endDate) {
    return { success: false, error: "Campaign name, start date and end date are required." };
  }

  if (new Date(endDate) < new Date(startDate)) {
    return { success: false, error: "End date must be after start date." };
  }

  const codeBase = campaignName.toUpperCase().replace(/[^A-Z0-9]+/g, "").substring(0, 10);
  const codeHash = crypto.randomBytes(4).toString("hex").toUpperCase();
  const campaignCode = `${codeBase}_${codeHash}`;
  const trackingUrl = `${targetUrl}${targetUrl.includes("?") ? "&" : "?"}utm_source=whatsapp&utm_medium=campaign&utm_campaign=${campaignCode}`;

  try {
    const campaign = await prisma.campaign.create({
      data: {
        storeId: store.id,
        campaignName,
        campaignCode,
        targetUrl,
        trackingUrl,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: "active",
        notes,
      },
    });
    return { success: true, campaignId: String(campaign.id), trackingUrl };
  } catch (error) {
    if (error.code === "P2002") return { success: false, error: "Campaign code already exists. Try again." };
    return { success: false, error: error.message };
  }
}

// ==================== DELETE CAMPAIGN ====================
export async function deleteCampaign(session, campaignId) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };

  const campaign = await prisma.campaign.findUnique({ where: { id: BigInt(campaignId) } });
  if (!campaign || campaign.storeId !== store.id) return { success: false, error: "Campaign not found" };

  await prisma.campaign.delete({ where: { id: BigInt(campaignId) } });
  return { success: true, type: "deleted" };
}

// ==================== TOGGLE CAMPAIGN STATUS ====================
export async function toggleCampaignStatus(session, campaignId) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };

  const campaign = await prisma.campaign.findUnique({ where: { id: BigInt(campaignId) } });
  if (!campaign || campaign.storeId !== store.id) return { success: false, error: "Campaign not found" };

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: campaign.status === "active" ? "paused" : "active" },
  });
  return { success: true, type: "toggled" };
}