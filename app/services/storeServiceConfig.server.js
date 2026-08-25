import prisma from "../db.server";

const DEFAULT_CONFIGS = {
  order_confirmation_whatsapp: {
    paymentFilter: "all",
    delayMinutes: 0,
    includeImage: false,
    confirmTag: "Order Confirmed",
    cancelTag: "Order Cancelled",
    useSeparateTemplates: false,
    codTemplateId: "",
    prepaidTemplateId: "",
    sendConfirmResponse: false,
    confirmResponseTemplateId: "",
    sendCancelResponse: false,
    cancelResponseTemplateId: "",
    cancelOrderOnShopify: false,
    noResponseTagEnabled: false,
    noResponseTag: "No Response",
    noResponseAfter: "2_days",
  },
  order_paid: {
    paymentFilter: "all",
    useSeparateTemplates: false,
    codTemplateId: "",
    prepaidTemplateId: "",
  },
  order_fulfillment: {
    paymentFilter: "all",
    useSeparateTemplates: false,
    codTemplateId: "",
    prepaidTemplateId: "",
  },
  order_delivered: {
    paymentFilter: "all",
    useSeparateTemplates: false,
    codTemplateId: "",
    prepaidTemplateId: "",
  },
  order_cancelled: {
    paymentFilter: "all",
    useSeparateTemplates: false,
    codTemplateId: "",
    prepaidTemplateId: "",
  },
  abandoned_checkout: {
    expiryDays: 7,
    reminders: {
      first: { enabled: true, templateId: "", delay: "30_min", discountCode: "", productImage: false },
      second: { enabled: false, templateId: "", delay: "1_hour", discountCode: "", productImage: false },
      third: { enabled: false, templateId: "", delay: "24_hours", discountCode: "", productImage: false },
    },
  },
  review_request_whatsapp: {},
};

function getDefaultConfig(serviceKey) {
  return DEFAULT_CONFIGS[serviceKey] || {};
}

export async function loadServiceConfig(session, serviceKey) {
  const store = await prisma.store.findUnique({ where: { shopDomain: session.shop } });
  if (!store) return { error: "Store not found" };

  const service = await prisma.service.findUnique({ where: { serviceKey } });
  if (!service) return { error: "Service not found in database" };

  const storeService = await prisma.storeService.findUnique({
    where: { storeId_serviceId: { storeId: store.id, serviceId: service.id } },
  });

  const templates = await prisma.template.findMany({
    where: { storeId: store.id, status: { in: ["approved", "draft", "pending"] } },
    orderBy: { createdAt: "desc" },
  });

  let extraConfig = {};
  if (storeService?.config) {
    try {
      extraConfig = typeof storeService.config === "string"
        ? JSON.parse(storeService.config)
        : storeService.config;
    } catch (e) {}
  }

  const defaults = getDefaultConfig(serviceKey);
  const config = {};
  config.templateId = storeService?.templateId ? String(storeService.templateId) : "";
  for (const [key, defaultVal] of Object.entries(defaults)) {
    config[key] = extraConfig[key] !== undefined ? extraConfig[key] : defaultVal;
  }

  if (serviceKey === "review_request_whatsapp") {
    const { decrypt } = await import("../utils/encryption.server.js");
    config.judgeMeApiToken = store.judgeMeApiToken ? decrypt(store.judgeMeApiToken) : "";
    config.judgeMeShopDomain = store.judgeMeShopDomain || "";
    config.reviewRequestDelayValue = store.reviewRequestDelayValue ?? 3;
    config.reviewRequestDelayUnit = store.reviewRequestDelayUnit || "days";
  }

  return {
    error: null,
    store,
    service,
    isEnabled: storeService?.isEnabled || false,
    config,
    templates: templates.map((t) => ({
      id: String(t.id),
      name: t.name,
      displayName: t.displayName || t.name,
      status: t.status,
    })),
  };
}

export async function saveServiceConfig(session, serviceKey, formData) {
  const store = await prisma.store.findUnique({ where: { shopDomain: session.shop } });
  if (!store) return { success: false, error: "Store not found" };

  const service = await prisma.service.findUnique({ where: { serviceKey } });
  if (!service) return { success: false, error: "Service not found" };

  let extraConfig = {};
  const configRaw = formData.get("extraConfig");
  if (configRaw) {
    try { extraConfig = JSON.parse(configRaw); } catch (e) {}
  }

  const templateIdRaw = formData.get("templateId");

  if (serviceKey === "review_request_whatsapp") {
    const { encrypt } = await import("../utils/encryption.server.js");
    const judgeMeApiToken = (extraConfig.judgeMeApiToken || "").trim();
    await prisma.store.update({
      where: { id: store.id },
      data: {
        judgeMeApiToken: judgeMeApiToken ? encrypt(judgeMeApiToken) : null,
        judgeMeShopDomain: (extraConfig.judgeMeShopDomain || "").trim(),
        reviewRequestDelayValue: parseInt(extraConfig.reviewRequestDelayValue) || 3,
        reviewRequestDelayUnit: (extraConfig.reviewRequestDelayUnit || "days").trim(),
      },
    });

    delete extraConfig.judgeMeApiToken;
    delete extraConfig.judgeMeShopDomain;
    delete extraConfig.reviewRequestDelayValue;
    delete extraConfig.reviewRequestDelayUnit;
  }

  await prisma.storeService.upsert({
    where: { storeId_serviceId: { storeId: store.id, serviceId: service.id } },
    update: {
      templateId: templateIdRaw ? BigInt(templateIdRaw) : null,
      config: extraConfig,
    },
    create: {
      storeId: store.id,
      serviceId: service.id,
      isEnabled: false,
      templateId: templateIdRaw ? BigInt(templateIdRaw) : null,
      config: extraConfig,
    },
  });

  return { success: true, type: "saved" };
}

export async function toggleService(admin, session, serviceKey, enable) {
  const store = await prisma.store.findUnique({ where: { shopDomain: session.shop } });
  if (!store) return { success: false, error: "Store not found" };

  const service = await prisma.service.findUnique({ where: { serviceKey } });
  if (!service) return { success: false, error: "Service not found" };

  const compositeKey = { storeId_serviceId: { storeId: store.id, serviceId: service.id } };

  await prisma.storeService.upsert({
    where: compositeKey,
    update: {
      isEnabled: enable,
      enabledAt: enable ? new Date() : undefined,
      disabledAt: enable ? null : new Date(),
    },
    create: {
      storeId: store.id,
      serviceId: service.id,
      isEnabled: enable,
      enabledAt: enable ? new Date() : null,
      disabledAt: enable ? null : new Date(),
    },
  });

  return { success: true, type: "toggled", isEnabled: enable };
}