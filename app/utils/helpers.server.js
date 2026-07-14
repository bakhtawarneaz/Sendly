import prisma from "../db.server";

// ==================== GET STORE BY SESSION ====================
export async function getStore(session) {
  return await prisma.store.findUnique({ where: { shopDomain: session.shop } });
}

// ==================== GET STORE WITH ENABLED SERVICES ====================
export async function getStoreWithServices(shop) {
  return await prisma.store.findUnique({
    where: { shopDomain: shop },
    include: {
      storeServices: {
        where: { isEnabled: true },
        include: { service: true },
      },
    },
  });
}

// ==================== GET PRODUCT IMAGE (wrapper) ====================
export async function getProductImageUrl(shop, order) {
  try {
    const session = await prisma.session.findFirst({
      where: { shop, isOnline: false },
    });
    if (!session?.accessToken) return null;

    const { getProductImageUrl: fetchImage } = await import("../services/productImage.server.js");
    return await fetchImage(shop, session.accessToken, order);
  } catch (e) {
    console.warn("Product image fetch failed:", e.message);
    return null;
  }
}