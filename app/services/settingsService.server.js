import prisma from "../db.server";
import { encrypt, decrypt } from "../utils/encryption.server.js";

export async function loadSettings(session) {
  const store = await prisma.store.findUnique({ where: { shopDomain: session.shop } });
  return {
    whatsappApiToken: store?.whatsappApiToken ? decrypt(store.whatsappApiToken) : "",
    whatsappPhoneId: store?.whatsappPhoneId || "",
    whatsappBusinessId: store?.whatsappBusinessId || "",
    whatsappConnected: store?.whatsappConnected || false,
    judgeMeApiToken: store?.judgeMeApiToken ? decrypt(store.judgeMeApiToken) : "",
    judgeMeShopDomain: store?.judgeMeShopDomain || "",
    reviewRequestDelayValue: store?.reviewRequestDelayValue ?? 3,
    reviewRequestDelayUnit: store?.reviewRequestDelayUnit || "days",
    shopDomain: session.shop,
  };
}

export async function saveWhatsappSettings(session, formData) {
  const store = await prisma.store.findUnique({ where: { shopDomain: session.shop } });
  if (!store) return { success: false, error: "Store not found" };

  const whatsappApiToken = formData.get("whatsappApiToken")?.trim() || "";
  const whatsappPhoneId = formData.get("whatsappPhoneId")?.trim() || "";
  const whatsappBusinessId = formData.get("whatsappBusinessId")?.trim() || "";
  const whatsappConnected = !!(whatsappApiToken && whatsappPhoneId && whatsappBusinessId);

  await prisma.store.update({
    where: { shopDomain: session.shop },
    data: {
      whatsappApiToken: whatsappApiToken ? encrypt(whatsappApiToken) : null,
      whatsappPhoneId,
      whatsappBusinessId,
      whatsappConnected,
    },
  });
  return { success: true, type: "whatsapp", whatsappConnected };
}

export async function disconnectWhatsapp(session) {
  await prisma.store.update({
    where: { shopDomain: session.shop },
    data: { whatsappApiToken: null, whatsappPhoneId: null, whatsappBusinessId: null, whatsappConnected: false },
  });
  return { success: true, type: "disconnect" };
}