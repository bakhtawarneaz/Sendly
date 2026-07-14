import prisma from "../db.server";
import { getStore } from "../utils/helpers.server.js";

// ==================== LOAD TEMPLATES (listing) ====================
export async function loadTemplates(session, page = 1, perPage = 10) {
  const store = await getStore(session);
  if (!store) return { templates: [], whatsappConnected: false, totalPages: 0, currentPage: 1, totalCount: 0 };

  const [templates, totalCount] = await Promise.all([
    prisma.template.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.template.count({ where: { storeId: store.id } }),
  ]);

  return {
    templates: templates.map((t) => ({
      id: String(t.id),
      name: t.name,
      displayName: t.displayName || t.name,
      type: t.type,
      language: t.language,
      status: t.status,
      headerType: t.headerType,
      body: t.body || "",
      createdAt: new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    })),
    whatsappConnected: store.whatsappConnected,
    totalPages: Math.ceil(totalCount / perPage),
    currentPage: page,
    totalCount,
  };
}

// ==================== LOAD SINGLE TEMPLATE (view) ====================
export async function loadTemplate(session, templateId) {
  const store = await getStore(session);
  if (!store) return { error: "Store not found" };

  const template = await prisma.template.findUnique({ where: { id: BigInt(templateId) } });
  if (!template || template.storeId !== store.id) return { error: "Template not found" };

  return {
    error: null,
    shopName: store.shopName || session.shop,
    template: {
      id: String(template.id),
      name: template.name,
      displayName: template.displayName || template.name,
      type: template.type,
      language: template.language,
      status: template.status,
      metaTemplateId: template.metaTemplateId,
      rejectionReason: template.rejectionReason,
      headerType: template.headerType || "none",
      headerText: template.headerText || "",
      headerMediaUrl: template.headerMediaUrl || "",
      body: template.body || "",
      footer: template.footer || "",
      buttons: template.buttons || [],
      variablesMap: template.variablesMap || {},
      createdAt: new Date(template.createdAt).toLocaleString(),
      updatedAt: new Date(template.updatedAt).toLocaleString(),
    },
  };
}

// ==================== LOAD CREATE PAGE ====================
export async function loadCreatePage(session) {
  const store = await getStore(session);
  if (!store || !store.whatsappConnected) return { error: "WhatsApp not connected", shopName: "" };
  return { error: null, shopName: store.shopName || session.shop };
}

// ==================== CREATE TEMPLATE ====================
export async function createTemplate(session, formData) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };

  const actionType = formData.get("actionType");
  const name = formData.get("name")?.trim().toLowerCase().replace(/\s+/g, "_") || "";
  const displayName = formData.get("displayName")?.trim() || name;
  const type = formData.get("type") || "utility";
  const language = formData.get("language") || "en";
  const headerType = formData.get("headerType") || "none";
  const headerText = formData.get("headerText")?.trim() || null;
  const headerMediaUrl = formData.get("headerMediaUrl")?.trim() || null;
  const body = formData.get("body")?.trim() || "";
  const footer = formData.get("footer")?.trim() || null;

  let buttons = null;
  try { buttons = JSON.parse(formData.get("buttons") || "null"); } catch (e) {}

  let variablesMap = null;
  try { variablesMap = JSON.parse(formData.get("variablesMap") || "null"); } catch (e) {}

  if (!name || !body) return { success: false, error: "Template name and body are required." };

  try {
    const existingDraft = await prisma.template.findFirst({
      where: { storeId: store.id, name, language, status: "draft" },
    });
    if (existingDraft) {
      await prisma.template.delete({ where: { id: existingDraft.id } });
    }

    const template = await prisma.template.create({
      data: {
        storeId: store.id, name, displayName, type, language, status: "draft",
        headerType: headerType === "none" ? null : headerType,
        headerText, headerMediaUrl, body, footer, buttons, variablesMap,
      },
    });

    if (actionType === "submit") {
      try {
        const { createMetaTemplate } = await import("./metaTemplateApi.server");
        const metaResult = await createMetaTemplate(store, {
          name, displayName, type, language, headerType, headerText, headerMediaUrl,
          body, footer, buttons, variablesMap,
        });

        await prisma.template.update({
          where: { id: template.id },
          data: { status: metaResult.status.toLowerCase(), metaTemplateId: metaResult.metaTemplateId },
        });

        return { success: true, templateId: String(template.id), status: metaResult.status.toLowerCase() };
      } catch (metaError) {
        return { success: true, templateId: String(template.id), status: "draft", metaError: metaError.message };
      }
    }

    return { success: true, templateId: String(template.id), status: "draft" };
  } catch (error) {
    if (error.code === "P2002") return { success: false, error: "Template with this name and language already exists." };
    return { success: false, error: error.message };
  }
}

// ==================== UPDATE TEMPLATE (draft edit) ====================
export async function updateTemplate(session, templateId, formData) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };

  const template = await prisma.template.findUnique({ where: { id: BigInt(templateId) } });
  if (!template || template.storeId !== store.id) return { success: false, error: "Template not found" };
  if (template.status !== "draft") return { success: false, error: "Only draft templates can be edited" };

  const actionType = formData.get("actionType");
  const displayName = formData.get("displayName")?.trim() || template.displayName;
  const name = displayName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || template.name;
  const type = formData.get("type") || template.type;
  const language = formData.get("language") || template.language;
  const headerType = formData.get("headerType") || "none";
  const headerText = formData.get("headerText")?.trim() || null;
  const headerMediaUrl = formData.get("headerMediaUrl")?.trim() || null;
  const body = formData.get("body")?.trim() || "";
  const footer = formData.get("footer")?.trim() || null;

  let buttons = null;
  try { buttons = JSON.parse(formData.get("buttons") || "null"); } catch (e) {}

  let variablesMap = null;
  try { variablesMap = JSON.parse(formData.get("variablesMap") || "null"); } catch (e) {}

  try {
    await prisma.template.update({
      where: { id: BigInt(templateId) },
      data: {
        name, displayName, type, language,
        headerType: headerType === "none" ? null : headerType,
        headerText, headerMediaUrl, body, footer, buttons, variablesMap,
      },
    });

    if (actionType === "submit") {
      try {
        const { createMetaTemplate } = await import("./metaTemplateApi.server");
        const metaResult = await createMetaTemplate(store, {
          name, displayName, type, language, headerType, headerText, headerMediaUrl,
          body, footer, buttons, variablesMap,
        });

        await prisma.template.update({
          where: { id: BigInt(templateId) },
          data: { status: metaResult.status.toLowerCase(), metaTemplateId: metaResult.metaTemplateId },
        });

        return { success: true, type: "submitted", status: metaResult.status.toLowerCase() };
      } catch (metaError) {
        return { success: true, type: "updated", status: "draft", metaError: metaError.message };
      }
    }

    return { success: true, type: "updated", status: "draft" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== DELETE TEMPLATE ====================
export async function deleteTemplate(session, templateId) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };

  const template = await prisma.template.findUnique({ where: { id: BigInt(templateId) } });
  if (template && template.metaTemplateId && store.whatsappConnected) {
    try {
      const { deleteMetaTemplate } = await import("./metaTemplateApi.server");
      await deleteMetaTemplate(store, template.name);
    } catch (e) {
      console.warn("Meta delete failed:", e.message);
    }
  }

  await prisma.template.delete({ where: { id: BigInt(templateId) } });
  return { success: true, type: "deleted" };
}

// ==================== SYNC TEMPLATES ====================
export async function syncTemplates(session) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };

  try {
    const { getAllMetaTemplates } = await import("./metaTemplateApi.server");
    const metaTemplates = await getAllMetaTemplates(store);

    let synced = 0;
    let imported = 0;

    for (const mt of metaTemplates) {
      const localTemplate = await prisma.template.findFirst({
        where: { storeId: store.id, name: mt.name, language: mt.language },
      });

      if (localTemplate) {
        const metaStatus = mt.status.toLowerCase();
        if (localTemplate.status !== metaStatus) {
          await prisma.template.update({
            where: { id: localTemplate.id },
            data: { status: metaStatus, metaTemplateId: mt.id, rejectionReason: mt.rejected_reason || null },
          });
          synced++;
        }
      } else {
        const bodyComponent = mt.components?.find(c => c.type === "BODY");
        const headerComponent = mt.components?.find(c => c.type === "HEADER");
        const footerComponent = mt.components?.find(c => c.type === "FOOTER");
        const buttonsComponent = mt.components?.find(c => c.type === "BUTTONS");

        let headerType = null, headerText = null;
        if (headerComponent) {
          if (headerComponent.format === "TEXT") { headerType = "text"; headerText = headerComponent.text || null; }
          else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComponent.format)) { headerType = headerComponent.format.toLowerCase(); }
        }

        let buttons = null;
        if (buttonsComponent?.buttons) {
          buttons = buttonsComponent.buttons.map(btn => {
            if (btn.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: btn.text };
            if (btn.type === "URL") return { type: "URL", text: btn.text, url: btn.url || "", urlType: btn.example ? "dynamic" : "static" };
            if (btn.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: btn.text, phoneNumber: btn.phone_number || "" };
            if (btn.type === "COPY_CODE") return { type: "COPY_CODE", text: btn.text || "Copy code", offerCode: btn.example?.[0] || "" };
            return null;
          }).filter(Boolean);
        }

        await prisma.template.create({
          data: {
            storeId: store.id, name: mt.name,
            displayName: mt.name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
            type: mt.category?.toLowerCase() === "marketing" ? "marketing" : "utility",
            language: mt.language, status: mt.status.toLowerCase(), metaTemplateId: mt.id,
            headerType, headerText, body: bodyComponent?.text || "", footer: footerComponent?.text || null,
            buttons, rejectionReason: mt.rejected_reason || null,
          },
        });
        imported++;
      }
    }

    return { success: true, type: "synced", count: synced, imported };
  } catch (error) {
    console.error("Sync error:", error);
    return { success: false, error: `Sync failed: ${error.message}` };
  }
}

// ==================== DUPLICATE TEMPLATE ====================
export async function duplicateTemplate(session, templateId) {
  const store = await getStore(session);
  if (!store) return { success: false, error: "Store not found" };

  const original = await prisma.template.findUnique({ where: { id: BigInt(templateId) } });
  if (!original) return { success: false, error: "Template not found" };

  await prisma.template.create({
    data: {
      storeId: store.id, name: `${original.name}_copy`,
      displayName: `${original.displayName || original.name} (Copy)`,
      type: original.type, language: original.language, status: "draft",
      headerType: original.headerType, headerText: original.headerText, headerMediaUrl: original.headerMediaUrl,
      body: original.body, footer: original.footer, buttons: original.buttons, variablesMap: original.variablesMap,
    },
  });

  return { success: true, type: "duplicated" };
}