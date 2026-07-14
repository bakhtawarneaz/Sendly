import prisma from "../db.server";

// ==================== LOAD SERVICES LIST ====================
export async function loadServicesList(session) {
  const shopDomain = session.shop;

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: { storeServices: { include: { service: true } } },
  });

  if (!store) {
    return {
      services: [],
      activeServices: [],
      trialActive: false,
      trialDaysLeft: 0,
      isFrozen: false,
    };
  }

  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const activeServiceIds = store.storeServices
    .filter((ss) => ss.isEnabled)
    .map((ss) => ss.service.id);

  // Trial calculation
  const now = new Date();
  const trialEndDate = store.trialEndDate ? new Date(store.trialEndDate) : null;
  const trialDaysLeft = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)))
    : 0;
  const trialActive = store.isTrialActive && trialDaysLeft > 0;

  return {
    services: services.map((s) => ({
      id: String(s.id),
      serviceKey: s.serviceKey,
      name: s.name,
      description: s.description,
    })),
    activeServices: activeServiceIds.map((id) => String(id)),
    trialActive,
    trialDaysLeft,
    isFrozen: store.billingStatus === "frozen",
  };
}

// ==================== TOGGLE SERVICE ====================
export async function toggleServiceFromList(session, serviceId, actionType) {
  const store = await prisma.store.findUnique({
    where: { shopDomain: session.shop },
  });
  if (!store) return { success: false, error: "Store not found" };

  const sid = BigInt(serviceId);
  const compositeKey = {
    storeId_serviceId: { storeId: store.id, serviceId: sid },
  };

  if (actionType === "enable") {
    await prisma.storeService.upsert({
      where: compositeKey,
      update: { isEnabled: true, enabledAt: new Date(), disabledAt: null },
      create: { storeId: store.id, serviceId: sid, isEnabled: true, enabledAt: new Date() },
    });
  } else if (actionType === "disable") {
    await prisma.storeService.upsert({
      where: compositeKey,
      update: { isEnabled: false, disabledAt: new Date() },
      create: { storeId: store.id, serviceId: sid, isEnabled: false, disabledAt: new Date() },
    });
  }

  return { success: true };
}