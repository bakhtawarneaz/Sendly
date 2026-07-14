import prisma from "../db.server";

async function getAdminToken(shop) {
  const session = await prisma.session.findFirst({
    where: { shop, isOnline: false },
    orderBy: { id: "desc" },
  });
  console.log("🔑 Token:", session?.accessToken ? "found" : "MISSING");
  return session?.accessToken || null;
}

async function getOrderGid(shop, token, orderId) {
  const res = await fetch(`https://${shop}/admin/api/2024-10/orders/${orderId}.json?fields=id,tags`, {
    headers: { "X-Shopify-Access-Token": token },
  });
  console.log("🔍 Order fetch:", orderId, "→ status", res.status);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    gid: `gid://shopify/Order/${data.order.id}`,
    tags: data.order.tags ? data.order.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
  };
}

async function setOrderTags(shop, token, orderGid, tags) {
  const res = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation orderUpdate($input: OrderInput!) {
        orderUpdate(input: $input) { userErrors { message } }
      }`,
      variables: { input: { id: orderGid, tags } },
    }),
  });
  const json = await res.json();
  const errs = json?.data?.orderUpdate?.userErrors;
  if (errs?.length) throw new Error(errs[0].message);
}

// Add newTag, remove removeTag (keeps latest action reflected)
export async function updateOrderTag(shop, orderId, newTag, removeTag) {
  const token = await getAdminToken(shop);
  if (!token) throw new Error("No admin token");

  const order = await getOrderGid(shop, token, orderId);
  if (!order) throw new Error("Order not found");

  let tags = order.tags.filter((t) => t.toLowerCase() !== (removeTag || "").toLowerCase());
  if (newTag && !tags.some((t) => t.toLowerCase() === newTag.toLowerCase())) {
    tags.push(newTag);
  }
  await setOrderTags(shop, token, order.gid, tags);
}

export async function cancelShopifyOrder(shop, orderId) {
  const token = await getAdminToken(shop);
  if (!token) throw new Error("No admin token");

  const res = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation orderCancel($orderId: ID!, $reason: OrderCancelReason!, $refund: Boolean!, $restock: Boolean!, $notifyCustomer: Boolean) {
        orderCancel(orderId: $orderId, reason: $reason, refund: $refund, restock: $restock, notifyCustomer: $notifyCustomer) {
          userErrors { message }
        }
      }`,
      variables: {
        orderId: `gid://shopify/Order/${orderId}`,
        reason: "CUSTOMER",
        refund: false,
        restock: true,
        notifyCustomer: false,
      },
    }),
  });
  const json = await res.json();
  const errs = json?.data?.orderCancel?.userErrors;
  if (errs?.length) throw new Error(errs[0].message);
}

export async function isOrderCancelled(shop, orderId) {
  const token = await getAdminToken(shop);
  if (!token) return false;

  const res = await fetch(
    `https://${shop}/admin/api/2024-10/orders/${orderId}.json?fields=id,cancelled_at`,
    { headers: { "X-Shopify-Access-Token": token } }
  );
  if (!res.ok) return false;

  const data = await res.json();
  return !!data?.order?.cancelled_at;
}