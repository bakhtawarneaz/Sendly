import prisma from "../db.server";
import { getStore } from "../utils/helpers.server.js";

// Service groups shown in analytics
const SERVICE_GROUPS = [
  { key: "order_confirmation_whatsapp", label: "New Order", color: "#7c3aed" },
  { key: "order_fulfillment", label: "Fulfillment Order", color: "#2563eb" },
  { key: "order_paid", label: "Paid Order", color: "#0891b2" },
  { key: "order_cancelled", label: "Cancel Order", color: "#dc2626" },
  { key: "order_delivered", label: "Delivered Order", color: "#16a34a" },
  { key: "abandoned_checkout", label: "Abandoned Order", color: "#ea580c" },
  { key: "review_request_whatsapp", label: "Review Order", color: "#f59e0b" },
];

export async function loadAnalytics(session, { dateFrom = "", dateTo = "", search = "" }) {
  const store = await getStore(session);
  if (!store) {
    return { serviceStats: [], summary: {}, dailyStats: [], recentMessages: [], quickStats: {}, dateFrom, dateTo };
  }

  const now = new Date();
  let periodStart, periodEnd;

  if (dateFrom && dateTo) {
    periodStart = new Date(dateFrom);
    periodEnd = new Date(dateTo);
    periodEnd.setHours(23, 59, 59, 999);
  } else {
    // Default: last 7 days
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    periodEnd = now;
  }

  const dateFilter = { gte: periodStart, lte: periodEnd };
  const baseWhere = { storeId: store.id, createdAt: dateFilter };

  if (search) {
    baseWhere.OR = [
      { orderName: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: search, mode: "insensitive" } },
    ];
  }

  // ==================== SUMMARY ====================
  const [totalMessages, successCount, failedCount] = await Promise.all([
    prisma.messageLog.count({ where: baseWhere }),
    prisma.messageLog.count({ where: { ...baseWhere, status: { in: ["sent", "delivered", "read"] } } }),
    prisma.messageLog.count({ where: { ...baseWhere, status: "failed" } }),
  ]);

  const summary = {
    totalMessages,
    successCount,
    failedCount,
    successRate: totalMessages > 0 ? Math.round((successCount / totalMessages) * 100) : 0,
    failedRate: totalMessages > 0 ? Math.round((failedCount / totalMessages) * 100) : 0,
  };

  // ==================== PER-SERVICE STATS ====================
  const serviceStats = [];
  for (const group of SERVICE_GROUPS) {
    const service = await prisma.service.findUnique({ where: { serviceKey: group.key } });
    if (!service) {
      serviceStats.push({ ...group, total: 0, sent: 0, error: 0, confirmed: 0, cancelled: 0 });
      continue;
    }

    const serviceWhere = { ...baseWhere, serviceId: service.id };

    const [total, sent, error] = await Promise.all([
      prisma.messageLog.count({ where: serviceWhere }),
      prisma.messageLog.count({ where: { ...serviceWhere, status: { in: ["sent", "delivered", "read"] } } }),
      prisma.messageLog.count({ where: { ...serviceWhere, status: "failed" } }),
    ]);

    const stat = { ...group, total, sent, error };

    // New Order also tracks customer responses
    if (group.key === "order_confirmation_whatsapp") {
      const [confirmed, cancelled, noResponse] = await Promise.all([
        prisma.messageLog.count({ where: { ...serviceWhere, customerResponse: "confirmed" } }),
        prisma.messageLog.count({ where: { ...serviceWhere, customerResponse: "cancelled" } }),
        prisma.messageLog.count({ where: { ...serviceWhere, customerResponse: "no_response" } }),
      ]);
      stat.confirmed = confirmed;
      stat.cancelled = cancelled;
      stat.noResponse = noResponse;
    }
    if (group.key === "review_request_whatsapp") {
      const [rated, submitted] = await Promise.all([
        prisma.reviewRequest.count({ where: { storeId: store.id, createdAt: dateFilter, rating: { not: null } } }),
        prisma.reviewRequest.count({ where: { storeId: store.id, createdAt: dateFilter, status: "submitted" } }),
      ]);
      stat.rated = rated;
      stat.submitted = submitted;
    }
    serviceStats.push(stat);
  }

  // ==================== DAILY CHART (Overview) ====================
  const dayCount = Math.min(
    Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1,
    30
  );

  const dailyStats = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const dayStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayWhere = { storeId: store.id, createdAt: { gte: dayStart, lt: dayEnd } };

    const [total, sent, error] = await Promise.all([
      prisma.messageLog.count({ where: dayWhere }),
      prisma.messageLog.count({ where: { ...dayWhere, status: { in: ["sent", "delivered", "read"] } } }),
      prisma.messageLog.count({ where: { ...dayWhere, status: "failed" } }),
    ]);

    dailyStats.push({
      date: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      Total: total,
      Sent: sent,
      Error: error,
    });
  }

  // ==================== MESSAGES BY TYPE (chart) ====================
  const messagesByType = serviceStats
    .filter((s) => s.total > 0)
    .map((s) => ({ name: s.label, value: s.total, color: s.color }));

  // ==================== RECENT ACTIVITY ====================
  const recentMessages = await prisma.messageLog.findMany({
    where: { storeId: store.id },
    include: { service: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  // ==================== QUICK ACTION STATS ====================
  const [activeServices, approvedTemplates, allTimeMessages, failedRetries, activeCampaigns] = await Promise.all([
    prisma.storeService.count({ where: { storeId: store.id, isEnabled: true } }),
    prisma.template.count({ where: { storeId: store.id, status: "approved" } }),
    prisma.messageLog.count({ where: { storeId: store.id } }),
    prisma.retryQueue.count({ where: { storeId: store.id, status: "failed" } }),
    prisma.campaign.count({ where: { storeId: store.id, status: "active" } }),
  ]);

  return {
    summary,
    serviceStats,
    dailyStats,
    messagesByType,
    recentMessages: recentMessages.map((m) => ({
      id: String(m.id),
      orderName: m.orderName || "—",
      customerName: m.customerName || "—",
      serviceName: m.service?.name || "—",
      serviceKey: m.service?.serviceKey || "",
      status: m.status,
      createdAt: new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    })),
    quickStats: { activeServices, approvedTemplates, allTimeMessages, failedRetries, activeCampaigns, whatsappConnected: store.whatsappConnected },
    dateFrom,
    dateTo,
  };
}