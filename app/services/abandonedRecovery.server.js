import prisma from "../db.server";


async function cancelPendingReminders(abandonedCheckoutId) {
  const pending = await prisma.abandonedReminder.findMany({
    where: { abandonedCheckoutId, status: "scheduled" },
  });

  if (pending.length === 0) return;

  const { abandonedCartQueue } = await import("../queues/queues.server.js");

  for (const r of pending) {
    if (r.bullmqJobId) {
      try {
        const job = await abandonedCartQueue.getJob(r.bullmqJobId);
        if (job) await job.remove();
      } catch (err) {
        console.warn(`⚠️ Could not remove reminder job ${r.bullmqJobId}: ${err.message}`);
      }
    }
    await prisma.abandonedReminder.update({
      where: { id: r.id },
      data: { status: "cancelled", errorMessage: "Checkout recovered" },
    });
  }
}


export async function handleOrderRecovery(store, order) {
  try {
    const checkoutToken = order?.checkout_token || null;
    const customerPhone =
      order?.billing_address?.phone ||
      order?.shipping_address?.phone ||
      order?.phone ||
      order?.customer?.phone ||
      null;

    if (!checkoutToken && !customerPhone) {
      return { matched: false, reason: "no_token_or_phone" };
    }

    let checkout = null;

    if (checkoutToken) {
      checkout = await prisma.abandonedCheckout.findFirst({
        where: {
          storeId: store.id,
          checkoutToken,
          status: { in: ["pending", "reminded"] },
        },
      });
    }

    if (!checkout && customerPhone) {
      checkout = await prisma.abandonedCheckout.findFirst({
        where: {
          storeId: store.id,
          customerPhone,
          status: { in: ["pending", "reminded"] },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!checkout) {
      return { matched: false, reason: "no_open_checkout" };
    }

    const orderTotal = order?.total_price || order?.current_total_price || null;

    await prisma.abandonedCheckout.update({
      where: { id: checkout.id },
      data: {
        status: "recovered",
        recoveredAt: new Date(),
        recoveredOrderId: String(order?.id || ""),
        recoveredOrderTotal: orderTotal ? Number(orderTotal) : null,
      },
    });

    await cancelPendingReminders(checkout.id);

    const viaReminder = checkout.remindersSent > 0;
    console.log(
      `💰 Abandoned checkout recovered (${viaReminder ? "via reminder" : "self"}) | ${store.shopDomain} | order ${order?.name}`
    );

    return {
      matched: true,
      checkoutId: String(checkout.id),
      viaReminder,
      orderTotal,
    };
  } catch (error) {
    console.error(`❌ Recovery tracking error: ${error.message}`);
    return { matched: false, error: error.message };
  }
}