import prisma from "../db.server";
import { parseConfig } from "./order.server.js";
import { parseDelayToMs } from "../utils/delay.js";
import { canSendMessage } from "../utils/billing.server.js";

// ============================================================
// (GraphQL)
// ============================================================

const CHECKOUTS_QUERY = `#graphql
  query AbandonedCheckouts($first: Int!, $after: String, $query: String) {
    abandonedCheckouts(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        cursor
        node {
          id
          abandonedCheckoutUrl
          createdAt
          completedAt
          totalPriceSet { presentmentMoney { amount currencyCode } }
          customer { firstName lastName phone email }
          billingAddress { phone }
          shippingAddress { phone }
          lineItems(first: 20) {
            edges {
              node {
                title
                quantity
                product { id }
                variant { price image { url } }
              }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

function gidToId(gid) {
  if (!gid) return "";
  const parts = String(gid).split("/");
  return parts[parts.length - 1] || "";
}

function pickPhone(node) {
  return (
    node?.billingAddress?.phone ||
    node?.shippingAddress?.phone ||
    node?.customer?.phone ||
    null
  );
}

function buildCartItems(node) {
  const edges = node?.lineItems?.edges || [];
  return edges.map(({ node: li }) => ({
    name: li.title,
    quantity: li.quantity,
    price: li.variant?.price || "0",
    productId: li.product?.id ? gidToId(li.product.id) : null,
    image: li.variant?.image?.url || null,
  }));
}

const REMINDER_NUMBER_MAP = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
function keyToReminderNumber(key) {
  const k = String(key || "").toLowerCase().trim();
  if (REMINDER_NUMBER_MAP[k]) return REMINDER_NUMBER_MAP[k];
  const digits = Number(k.replace(/\D/g, ""));
  return Number.isFinite(digits) && digits > 0 ? digits : 1;
}

// ==================== SYNC ONE STORE ====================
async function syncStore(store, admin) {
  const storeService = await prisma.storeService.findFirst({
    where: {
      storeId: store.id,
      isEnabled: true,
      service: { is: { serviceKey: "abandoned_checkout" } },
    },
    include: { service: true },
  });

  if (!storeService) return { skipped: true, reason: "service_disabled", synced: 0 };

  const config = parseConfig(storeService);
  const reminders = config.reminders || {};
  const expiryDays = config.expiryDays || 7;

  const hasEnabledReminder = Object.values(reminders).some((r) => r.enabled);
  if (!hasEnabledReminder) return { skipped: true, reason: "no_reminders", synced: 0 };

  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const searchQuery = `created_at:>='${sinceIso}'`;

  let synced = 0;
  let skipped = 0;
  let after = null;
  let hasNext = true;
  let pages = 0;

  while (hasNext && pages < 5) {
    pages++;
    const resp = await admin.graphql(CHECKOUTS_QUERY, {
      variables: { first: 50, after, query: searchQuery },
    });
    const json = await resp.json();
    const connection = json?.data?.abandonedCheckouts;
    if (!connection) break;

    for (const { node } of connection.edges) {
      try {
        if (node.completedAt) {
          skipped++;
          continue;
        }

        const phone = pickPhone(node);
        if (!phone) {
          skipped++;
          continue;
        }

        const recoveryUrl = node.abandonedCheckoutUrl;
        if (!recoveryUrl) {
          skipped++;
          continue;
        }

        const checkoutToken = gidToId(node.id);
        if (!checkoutToken) {
          skipped++;
          continue;
        }

        const existing = await prisma.abandonedCheckout.findUnique({
          where: { storeId_checkoutToken: { storeId: store.id, checkoutToken } },
        });
        if (existing && (existing.status === "recovered" || existing.status === "expired")) {
          skipped++;
          continue;
        }

        const customerName = node.customer
          ? `${node.customer.firstName || ""} ${node.customer.lastName || ""}`.trim()
          : "Guest";
        const cartItems = buildCartItems(node);
        const cartTotal = node.totalPriceSet?.presentmentMoney?.amount || "0";
        const currency = node.totalPriceSet?.presentmentMoney?.currencyCode || store.currency || "PKR";

        if (existing) {

          if (existing.status === "pending" || existing.status === "reminded") {
            await prisma.abandonedCheckout.update({
              where: { id: existing.id },
              data: { cartItems, cartTotal, recoveryUrl, customerName, customerPhone: phone },
            });
          }
          skipped++;
          continue;
        }

        await upsertCheckoutAndSchedule({
          store,
          storeService,
          reminders,
          expiryDays,
          checkout: {
            checkoutToken,
            shopifyCheckoutId: checkoutToken,
            customerName,
            customerPhone: phone,
            customerEmail: node.customer?.email || null,
            cartItems,
            cartTotal,
            currency,
            recoveryUrl,
            createdAt: node.createdAt,
          },
          source: "sync",
        });

        synced++;
      } catch (err) {
        console.error(`⚠️ Sync error for a checkout in ${store.shopDomain}: ${err.message}`);
      }
    }

    hasNext = connection.pageInfo?.hasNextPage;
    after = connection.pageInfo?.endCursor;
  }

  return { success: true, synced, skipped };
}

// ==================== SHARED: UPSERT CHECKOUT + SCHEDULE REMINDERS ====================

export async function upsertCheckoutAndSchedule({ store, storeService, reminders, expiryDays, checkout, source }) {
  const createdAtMs = new Date(checkout.createdAt || Date.now()).getTime();
  const expiresAt = new Date((isNaN(createdAtMs) ? Date.now() : createdAtMs) + expiryDays * 24 * 60 * 60 * 1000);

  const record = await prisma.abandonedCheckout.upsert({
    where: { storeId_checkoutToken: { storeId: store.id, checkoutToken: checkout.checkoutToken } },
    update: {
      cartItems: checkout.cartItems,
      cartTotal: checkout.cartTotal,
      recoveryUrl: checkout.recoveryUrl,
      customerName: checkout.customerName,
      customerPhone: checkout.customerPhone,
      customerEmail: checkout.customerEmail,
    },
    create: {
      storeId: store.id,
      shopifyCheckoutId: checkout.shopifyCheckoutId || checkout.checkoutToken,
      checkoutToken: checkout.checkoutToken,
      customerName: checkout.customerName,
      customerPhone: checkout.customerPhone,
      customerEmail: checkout.customerEmail || null,
      cartItems: checkout.cartItems,
      cartTotal: checkout.cartTotal,
      currency: checkout.currency,
      recoveryUrl: checkout.recoveryUrl,
      status: "pending",
      source: source || "webhook",
      expiresAt,
    },
  });

  if (record.status === "recovered" || record.status === "expired") {
    return { checkout: record, scheduled: 0 };
  }

  const { abandonedCartQueue } = await import("../queues/queues.server.js");

  const checkoutData = {
    storeId: String(store.id),
    serviceId: String(storeService.service.id),
    abandonedCheckoutId: String(record.id),
    customerPhone: record.customerPhone,
    customerName: record.customerName,
    checkoutToken: record.checkoutToken,
    checkoutId: record.shopifyCheckoutId || "",
    checkoutUrl: record.recoveryUrl || "",
    totalPrice: String(record.cartTotal ?? "0"),
    currency: record.currency || store.currency || "PKR",
    lineItems: record.cartItems || [],
    createdAt: checkout.createdAt,
    expiryDays,
  };

  let scheduled = 0;
  for (const [key, reminder] of Object.entries(reminders)) {
    if (!reminder.enabled) continue;

    const reminderNumber = keyToReminderNumber(key);
    const delayMs = parseDelayToMs(reminder.delay || "30_min");

    const exists = await prisma.abandonedReminder.findUnique({
      where: { abandonedCheckoutId_reminderNumber: { abandonedCheckoutId: record.id, reminderNumber } },
    });
    if (exists) continue;

    let templateName = null;
    if (reminder.templateId) {
      const tpl = await prisma.template.findUnique({
        where: { id: BigInt(reminder.templateId) },
        select: { name: true, displayName: true },
      });
      templateName = tpl?.displayName || tpl?.name || null;
    }

    const job = await abandonedCartQueue.add(
      `reminder-${key}`,
      {
        ...checkoutData,
        reminderKey: key,
        reminderNumber,
        templateId: reminder.templateId || "",
        discountCode: reminder.discountCode || "",
        includeImage: reminder.productImage || false,
      },
      {
        delay: delayMs,
        attempts: 2,
        backoff: { type: "exponential", delay: 60000 },
        jobId: `${record.checkoutToken}-${key}`,
      }
    );

    await prisma.abandonedReminder.create({
      data: {
        storeId: store.id,
        abandonedCheckoutId: record.id,
        reminderNumber,
        templateId: reminder.templateId ? BigInt(reminder.templateId) : null,
        discountCode: reminder.discountCode || null,
        bullmqJobId: job.id ? String(job.id) : null,
        scheduledAt: new Date(Date.now() + delayMs),
        status: "scheduled",
        templateName,
      },
    });
    scheduled++;
  }

  return { checkout: record, scheduled };
}

// ==================== EXPIRE OLD CHECKOUTS ====================
export async function expireOldCheckouts() {
  const now = new Date();
  const expired = await prisma.abandonedCheckout.updateMany({
    where: {
      status: { in: ["pending", "reminded"] },
      expiresAt: { lt: now },
    },
    data: { status: "expired" },
  });
  if (expired.count > 0) console.log(`🗑️  Expired ${expired.count} old abandoned checkouts`);
  return expired.count;
}

// ==================== MAIN SYNC ENTRY ====================
export async function runAbandonedSync() {
  await expireOldCheckouts();

  const stores = await prisma.store.findMany({
    where: { isActive: true, whatsappConnected: true },
  });

  const results = [];
  for (const store of stores) {
    try {
      const { allowed } = canSendMessage(store);
      if (!allowed) {
        results.push({ shop: store.shopDomain, skipped: true, reason: "billing_frozen" });
        continue;
      }

      const admin = await getAdminClient(store);
      if (!admin) {
        results.push({ shop: store.shopDomain, skipped: true, reason: "no_session" });
        continue;
      }

      const r = await syncStore(store, admin);
      results.push({ shop: store.shopDomain, ...r });
    } catch (err) {
      console.error(`❌ Sync failed for ${store.shopDomain}: ${err.message}`);
      results.push({ shop: store.shopDomain, success: false, error: err.message });
    }
  }

  console.log("🔄 Abandoned sync complete", results);
  return results;
}

// ==================== ADMIN CLIENT FROM OFFLINE SESSION ====================
async function getAdminClient(store) {
  const session = await prisma.session.findFirst({
    where: { shop: store.shopDomain, isOnline: false },
    orderBy: { id: "desc" },
  });
  if (!session?.accessToken) return null;

  const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-10";
  const endpoint = `https://${store.shopDomain}/admin/api/${apiVersion}/graphql.json`;

  return {
    graphql: async (query, { variables } = {}) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({ query, variables }),
      });
      return res;
    },
  };
}