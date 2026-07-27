import prisma from "../db.server";
import { getStore } from "../utils/helpers.server.js";
import { humanizeWhatsappError } from "../utils/errorMessages.js";
// ==================== LOAD MESSAGE LOGS ====================
export async function loadMessageLogs(session, { page = 1, perPage = 10, status = "all", service = "all", search = "", dateFrom = "", dateTo = "" }) {
  const store = await getStore(session);
  if (!store) return { logs: [], stats: {}, totalPages: 0, currentPage: 1, totalCount: 0, services: [], dateFrom: "", dateTo: "" };

  const where = { storeId: store.id };
  if (status !== "all") where.status = status;
  if (service !== "all") where.service = { serviceKey: service };
  if (search) {
    where.OR = [
      { orderName: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: search, mode: "insensitive" } },
      { templateName: { contains: search, mode: "insensitive" } },
    ];
  }
  if (dateFrom && dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    where.createdAt = { gte: fromDate, lte: toDate };
  }

  const [logs, totalCount] = await Promise.all([
    prisma.messageLog.findMany({
      where,
      include: { service: true, retryQueues: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.messageLog.count({ where }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const SENT_STATES = ["sent", "delivered", "read"];

  const [totalSent, totalDelivered, totalRead, totalFailed, todaySent, monthSent] = await Promise.all([
    prisma.messageLog.count({ where: { storeId: store.id, status: { in: SENT_STATES } } }),
    prisma.messageLog.count({ where: { storeId: store.id, status: { in: ["delivered", "read"] } } }),
    prisma.messageLog.count({ where: { storeId: store.id, status: "read" } }),
    prisma.messageLog.count({ where: { storeId: store.id, status: "failed" } }),
    prisma.messageLog.count({ where: { storeId: store.id, status: { in: SENT_STATES }, createdAt: { gte: todayStart } } }),
    prisma.messageLog.count({ where: { storeId: store.id, status: { in: SENT_STATES }, createdAt: { gte: monthStart } } }),
  ]);

  const services = await prisma.service.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });

  return {
    logs: logs.map((l) => {
      const retry = l.retryQueues?.find((r) => r.status === "failed") || l.retryQueues?.[0] || null;
      return {
        id: String(l.id),
        orderName: l.orderName || "—",
        customerName: l.customerName || "—",
        customerPhone: l.customerPhone || "—",
        templateName: l.templateName || "—",
        serviceName: l.service?.name || "—",
        serviceKey: l.service?.serviceKey || "",
        status: l.status,
        direction: l.direction,
        errorMessage: l.errorMessage || "",
        errorInfo: l.status === "failed" && l.errorMessage ? humanizeWhatsappError(l.errorMessage) : null,
        wamid: l.metadata?.whatsappMessageId || "",
        retryId: retry ? String(retry.id) : null,
        retryCount: retry?.retryCount || 0,
        maxRetries: retry?.maxRetries || 5,
        canRetry: l.status === "failed" && retry && retry.retryCount < retry.maxRetries,
        sentAt: l.sentAt ? new Date(l.sentAt).toLocaleString() : "—",
        createdAt: new Date(l.createdAt).toLocaleString(),
      };
    }),
    stats: { totalSent, totalDelivered, totalRead, totalFailed, todaySent, monthSent },
    totalPages: Math.ceil(totalCount / perPage),
    currentPage: page,
    totalCount,
    services: services.map((s) => ({ key: s.serviceKey, name: s.name })),
    dateFrom,
    dateTo,
  };
}

// ==================== BUILD RETRY VARIABLES ====================
async function buildRetryVariables(store, template, messageLog, retry) {
  try {
    const session = await prisma.session.findFirst({
      where: { shop: store.shopDomain },
      orderBy: { id: "desc" },
    });
    if (session?.accessToken && retry.orderId) {
      const orderRes = await fetch(
        `https://${store.shopDomain}/admin/api/2024-10/orders/${retry.orderId}.json`,
        { headers: { "X-Shopify-Access-Token": session.accessToken } }
      );
      if (orderRes.ok) {
        const { order } = await orderRes.json();
        const { resolveTemplateVariables } = await import("../utils/templateVariables.js");
        const variables = resolveTemplateVariables(template, order, store);
        const { buildVarArray } = await import("./message.server.js");
        return buildVarArray(template, variables);
      }
    }
  } catch (e) {
    console.warn("Fresh variable resolve failed, using stored:", e.message);
  }
  return messageLog?.metadata?.variables || [];
}

// ==================== SINGLE RETRY ====================
export async function singleRetry(session, retryId) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };

  const retry = await prisma.retryQueue.findUnique({ where: { id: BigInt(retryId) } });
  if (!retry) return { success: false, error: "Retry record not found" };
  if (retry.storeId !== store.id) return { success: false, error: "Unauthorized" };
  if (retry.retryCount >= retry.maxRetries) return { success: false, error: "Maximum retries reached" };

  const messageLog = await prisma.messageLog.findUnique({
    where: { id: retry.messageLogId },
    include: { service: true },
  });
  if (!messageLog) return { success: false, error: "Original message not found" };

  let template = null;
  if (retry.serviceKey) {
    const service = await prisma.service.findUnique({ where: { serviceKey: retry.serviceKey } });
    if (service) {
      const storeService = await prisma.storeService.findUnique({
        where: { storeId_serviceId: { storeId: store.id, serviceId: service.id } },
      });
      if (storeService?.templateId) {
        template = await prisma.template.findUnique({ where: { id: storeService.templateId } });
      }
    }
  }
  if (!template && retry.templateName) {
    template = await prisma.template.findFirst({ where: { storeId: store.id, name: retry.templateName } });
  }

  try {
    const { sendTemplateMessage } = await import("./whatsappSender.server");
    if (!template) throw new Error("Template not found for retry");

    const variables = await buildRetryVariables(store, template, messageLog, retry);
    const result = await sendTemplateMessage(store, template, retry.customerPhone, variables);

    await prisma.retryQueue.update({
      where: { id: BigInt(retryId) },
      data: { status: "sent", retryCount: retry.retryCount + 1, lastRetriedAt: new Date(), errorMessage: null },
    });
    await prisma.messageLog.update({
      where: { id: retry.messageLogId },
      data: {
        status: "sent",
        sentAt: new Date(),
        errorMessage: null,
        metadata: {
          ...(messageLog?.metadata || {}),
          whatsappMessageId: result.messageId,
          variables,
        },
      },
    });

    return { success: true, type: "retried", count: 1 };
  } catch (error) {
    await prisma.retryQueue.update({
      where: { id: BigInt(retryId) },
      data: { retryCount: retry.retryCount + 1, lastRetriedAt: new Date(), errorMessage: error.message },
    });
    return { success: false, error: `Retry failed: ${error.message}` };
  }
}

// ==================== BULK RETRY ====================
export async function bulkRetry(session, ids) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };
  if (!ids || ids.length === 0) return { success: false, error: "No messages selected" };

  let successCount = 0;
  let failCount = 0;

  for (const retryId of ids) {
    const retry = await prisma.retryQueue.findUnique({ where: { id: BigInt(retryId) } });
    if (!retry || retry.storeId !== store.id) { failCount++; continue; }
    if (retry.retryCount >= retry.maxRetries) { failCount++; continue; }
    if (retry.status === "sent") continue;

    const messageLog = await prisma.messageLog.findUnique({ where: { id: retry.messageLogId } });
    const template = retry.templateName
      ? await prisma.template.findFirst({ where: { storeId: store.id, name: retry.templateName } })
      : null;

    try {
      const { sendTemplateMessage } = await import("./whatsappSender.server");
      if (!template) throw new Error("Template not found");

      const variables = await buildRetryVariables(store, template, messageLog, retry);
      const result = await sendTemplateMessage(store, template, retry.customerPhone, variables);

      await prisma.retryQueue.update({
        where: { id: BigInt(retryId) },
        data: { status: "sent", retryCount: retry.retryCount + 1, lastRetriedAt: new Date(), errorMessage: null },
      });
      if (messageLog) {
        await prisma.messageLog.update({
          where: { id: retry.messageLogId },
          data: {
            status: "sent",
            sentAt: new Date(),
            errorMessage: null,
            metadata: {
              ...(messageLog?.metadata || {}),
              whatsappMessageId: result.messageId,
              variables,
            },
          },
        });
      }
      successCount++;
    } catch (error) {
      await prisma.retryQueue.update({
        where: { id: BigInt(retryId) },
        data: { retryCount: retry.retryCount + 1, lastRetriedAt: new Date(), errorMessage: error.message },
      });
      failCount++;
    }
  }

  return { success: true, type: "bulk_retried", successCount, failCount };
}