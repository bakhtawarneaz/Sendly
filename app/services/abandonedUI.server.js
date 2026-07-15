import prisma from "../db.server";
import { getStore } from "../utils/helpers.server.js";


function dateRangeWhere(from, to, field = "createdAt") {
  if (!from && !to) return {};
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.lte = end;
  }
  return { [field]: range };
}


export async function loadAbandonedOverview(session, { from = "", to = "", status = "", page = 1 } = {}) {
  const store = await getStore(session);
  if (!store) return { error: "Store not found" };

  const storeId = store.id;
  const pageSize = 20;
  const skip = (Math.max(1, Number(page)) - 1) * pageSize;
  const reminderDate = dateRangeWhere(from, to, "createdAt");
  const recoveredDate = dateRangeWhere(from, to, "recoveredAt");

  const [remindersSent, remindersFailed] = await Promise.all([
    prisma.abandonedReminder.count({ where: { storeId, status: "sent", ...reminderDate } }),
    prisma.abandonedReminder.count({ where: { storeId, status: "failed", ...reminderDate } }),
  ]);

  const [viaReminder, selfRecovered] = await Promise.all([
    prisma.abandonedCheckout.aggregate({
      _sum: { recoveredOrderTotal: true },
      _count: true,
      where: { storeId, status: "recovered", remindersSent: { gt: 0 }, ...recoveredDate },
    }),
    prisma.abandonedCheckout.aggregate({
      _sum: { recoveredOrderTotal: true },
      _count: true,
      where: { storeId, status: "recovered", remindersSent: 0, ...recoveredDate },
    }),
  ]);

  const logWhere = { storeId, ...reminderDate };
  if (status) logWhere.status = status;

  const [logCount, reminders] = await Promise.all([
    prisma.abandonedReminder.count({ where: logWhere }),
    prisma.abandonedReminder.findMany({
      where: logWhere,
      include: {
        checkout: {
          select: {
            customerName: true,
            customerPhone: true,
            cartTotal: true,
            currency: true,
            status: true,
            recoveryUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const log = reminders.map((r) => ({
    id: String(r.id),
    reminderNumber: r.reminderNumber,
    status: r.status,
    templateName: r.templateName,
    scheduledAt: r.scheduledAt,
    sentAt: r.sentAt,
    errorMessage: r.errorMessage,
    whatsappMessageId: r.whatsappMessageId,
    messageBody: r.messageBody,
    customerName: r.checkout?.customerName || null,
    customerPhone: r.checkout?.customerPhone || null,
    cartTotal: r.checkout?.cartTotal ? Number(r.checkout.cartTotal) : null,
    currency: r.checkout?.currency || store.currency || "USD",
    checkoutStatus: r.checkout?.status || null,
  }));

  return {
    error: null,
    currency: store.currency || "USD",
    stats: {
      remindersSent,
      remindersFailed,
      recoveredAmount: Number(viaReminder._sum.recoveredOrderTotal || 0),
      recoveredCount: viaReminder._count || 0,
      selfRecoveredAmount: Number(selfRecovered._sum.recoveredOrderTotal || 0),
      selfRecoveredCount: selfRecovered._count || 0,
    },
    log,
    pagination: {
      page: Number(page),
      pageSize,
      total: logCount,
      totalPages: Math.ceil(logCount / pageSize),
    },
  };
}

// ==================== CHECKOUTS LIST ====================
export async function loadAbandonedCheckouts(session, { status = "", search = "", page = 1 } = {}) {
  const store = await getStore(session);
  if (!store) return { error: "Store not found" };

  const storeId = store.id;
  const pageSize = 20;
  const skip = (Math.max(1, Number(page)) - 1) * pageSize;

  const [total, pending, recovered] = await Promise.all([
    prisma.abandonedCheckout.count({ where: { storeId } }),
    prisma.abandonedCheckout.count({ where: { storeId, status: "pending" } }),
    prisma.abandonedCheckout.count({ where: { storeId, status: "recovered" } }),
  ]);
  const recoveryRate = total > 0 ? ((recovered / total) * 100).toFixed(1) : "0.0";

  const where = { storeId };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: search } },
      { customerEmail: { contains: search, mode: "insensitive" } },
    ];
  }

  const [count, rows] = await Promise.all([
    prisma.abandonedCheckout.count({ where }),
    prisma.abandonedCheckout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const data = rows.map((c) => ({
    id: String(c.id),
    customerName: c.customerName,
    customerPhone: c.customerPhone,
    cartTotal: c.cartTotal ? Number(c.cartTotal) : 0,
    currency: c.currency || store.currency || "PKR",
    status: c.status,
    remindersSent: c.remindersSent,
    lastReminderAt: c.lastReminderAt,
    recoveredOrderTotal: c.recoveredOrderTotal ? Number(c.recoveredOrderTotal) : null,
    source: c.source,
    createdAt: c.createdAt,
  }));

  return {
    error: null,
    currency: store.currency || "PKR",
    stats: { total, pending, recovered, recoveryRate },
    data,
    pagination: {
      page: Number(page),
      pageSize,
      total: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}

// ==================== APPROVED TEMPLATES (for manual send dropdown) ====================
export async function loadAbandonedTemplates(session) {
  const store = await getStore(session);
  if (!store) return [];

  const templates = await prisma.template.findMany({
    where: { storeId: store.id, status: "approved" },
    select: { id: true, name: true, displayName: true },
    orderBy: { name: "asc" },
  });

  return templates.map((t) => ({
    id: String(t.id),
    label: t.displayName || t.name,
  }));
}

// ==================== MANUAL SEND ====================
export async function sendManualReminder(session, { checkoutId, templateId }) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };
  if (!checkoutId || !templateId) return { success: false, error: "Checkout and template are required" };

  const checkout = await prisma.abandonedCheckout.findFirst({
    where: { id: BigInt(checkoutId), storeId: store.id },
  });
  if (!checkout) return { success: false, error: "Checkout not found" };
  if (checkout.status === "recovered") return { success: false, error: "Checkout already recovered" };
  if (checkout.status === "expired") return { success: false, error: "Checkout has expired" };

  const { abandonedCartQueue } = await import("../queues/queues.server.js");

  const storeService = await prisma.storeService.findFirst({
    where: { storeId: store.id, service: { is: { serviceKey: "abandoned_checkout" } } },
    include: { service: true },
  });
  if (!storeService) return { success: false, error: "Abandoned service not enabled" };

  const lastManual = await prisma.abandonedReminder.findFirst({
    where: { abandonedCheckoutId: checkout.id, reminderNumber: { gte: 90 } },
    orderBy: { reminderNumber: "desc" },
  });
  const manualNumber = lastManual ? lastManual.reminderNumber + 1 : 90;

  const template = await prisma.template.findUnique({ where: { id: BigInt(templateId) } });

  const manualKey = `manual-${Date.now()}`;

  await prisma.abandonedReminder.create({
    data: {
      storeId: store.id,
      abandonedCheckoutId: checkout.id,
      reminderNumber: manualNumber,
      templateId: BigInt(templateId),
      templateName: template?.name || null,
      status: "scheduled",
      scheduledAt: new Date(),
    },
  });

  await abandonedCartQueue.add(
    `reminder-${manualKey}`,
    {
      storeId: String(store.id),
      serviceId: String(storeService.service.id),
      abandonedCheckoutId: String(checkout.id),
      reminderNumber: manualNumber,
      customerPhone: checkout.customerPhone,
      customerName: checkout.customerName,
      checkoutToken: checkout.checkoutToken,
      checkoutId: checkout.shopifyCheckoutId || "",
      checkoutUrl: checkout.recoveryUrl || "",
      totalPrice: String(checkout.cartTotal ?? "0"),
      currency: checkout.currency || store.currency || "PKR",
      lineItems: checkout.cartItems || [],
      createdAt: checkout.createdAt,
      expiryDays: 999, // manual send bypasses expiry
      reminderKey: manualKey,
      templateId: String(templateId),
      discountCode: "",
      includeImage: false,
      manual: true,
    },
    { attempts: 2, backoff: { type: "exponential", delay: 30000 }, jobId: `${checkout.checkoutToken}-${manualKey}` }
  );

  return { success: true, message: "Manual reminder sent" };
}

// ==================== RETRY FAILED REMINDER ====================
export async function retryReminder(session, { reminderId }) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };
  if (!reminderId) return { success: false, error: "Reminder is required" };

  const reminder = await prisma.abandonedReminder.findFirst({
    where: { id: BigInt(reminderId), storeId: store.id },
    include: { checkout: true },
  });
  if (!reminder) return { success: false, error: "Reminder not found" };
  if (reminder.status !== "failed") {
    return { success: false, error: `Only failed reminders can be retried (current: ${reminder.status})` };
  }

  const checkout = reminder.checkout;
  if (!checkout) return { success: false, error: "Checkout not found" };
  if (checkout.status === "recovered") return { success: false, error: "Checkout already recovered" };
  if (checkout.status === "expired") return { success: false, error: "Checkout has expired" };

  const storeService = await prisma.storeService.findFirst({
    where: { storeId: store.id, service: { is: { serviceKey: "abandoned_checkout" } } },
    include: { service: true },
  });
  if (!storeService) return { success: false, error: "Abandoned service not enabled" };

  const { abandonedCartQueue } = await import("../queues/queues.server.js");

  await prisma.abandonedReminder.update({
    where: { id: reminder.id },
    data: { status: "scheduled", errorMessage: null },
  });

  await abandonedCartQueue.add(
    `reminder-retry-${reminder.reminderNumber}`,
    {
      storeId: String(store.id),
      serviceId: String(storeService.service.id),
      abandonedCheckoutId: String(checkout.id),
      reminderNumber: reminder.reminderNumber,
      customerPhone: checkout.customerPhone,
      customerName: checkout.customerName,
      checkoutToken: checkout.checkoutToken,
      checkoutId: checkout.shopifyCheckoutId || "",
      checkoutUrl: checkout.recoveryUrl || "",
      totalPrice: String(checkout.cartTotal ?? "0"),
      currency: checkout.currency || store.currency || "PKR",
      lineItems: checkout.cartItems || [],
      createdAt: checkout.createdAt,
      expiryDays: 999,
      reminderKey: `retry-${reminder.reminderNumber}`,
      templateId: reminder.templateId ? String(reminder.templateId) : "",
      discountCode: reminder.discountCode || "",
      includeImage: false,
      manual: true,
    },
    { attempts: 2, backoff: { type: "exponential", delay: 30000 }, jobId: `${checkout.checkoutToken}-retry-${reminder.id}-${Date.now()}` }
  );

  return { success: true, message: "Reminder retry queued" };
}