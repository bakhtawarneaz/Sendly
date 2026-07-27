import prisma from "../db.server";

export async function ensureStore(session, admin) {
  const shopDomain = session.shop;

  let store = await prisma.store.findUnique({
    where: { shopDomain },
  });

  if (store) return store;

  let shopData = {};
  try {
    const response = await admin.graphql(`
      #graphql
      query {
        shop {
          name
          email
          contactEmail
          currencyCode
          ianaTimezone
          billingAddress {
            phone
          }
        }
      }
    `);
    const json = await response.json();
    const shop = json?.data?.shop;
    if (shop) {
      shopData = {
        shopName: shop.name || null,
        email: shop.contactEmail || shop.email || null,
        phone: shop.billingAddress?.phone || null,
        currency: shop.currencyCode || "PKR",
        timezone: shop.ianaTimezone || null,
      };
    }
  } catch (err) {
    console.error("ensureStore: failed to fetch shop details", err);
  }

  store = await prisma.store.upsert({
    where: { shopDomain },
    update: {},
    create: {
      shopDomain,
      ...shopData,
      trialStartDate: new Date(),
      trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return store;
}