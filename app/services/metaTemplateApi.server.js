// ==================== META WHATSAPP TEMPLATE API ====================

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ==================== UPLOAD MEDIA TO META ====================
async function uploadMediaToMeta(store, mediaUrl) {
  const { decrypt } = await import("../utils/encryption.server.js");
  const whatsappApiToken = decrypt(store.whatsappApiToken);

  const fileResponse = await fetch(mediaUrl);
  if (!fileResponse.ok) throw new Error("Failed to download media file");

  const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
  const contentType = fileResponse.headers.get("content-type") || "image/jpeg";
  const fileLength = fileBuffer.length;

  const sessionResponse = await fetch(
    `${GRAPH_API_BASE}/app/uploads?file_length=${fileLength}&file_type=${encodeURIComponent(contentType)}&access_token=${whatsappApiToken}`,
    { method: "POST" }
  );
  const sessionData = await sessionResponse.json();
  if (sessionData.error) {
    console.error("Upload session error:", sessionData.error);
    throw new Error(sessionData.error.message);
  }
  const uploadSessionId = sessionData.id;

  const uploadResponse = await fetch(
    `${GRAPH_API_BASE}/${uploadSessionId}`,
    {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${whatsappApiToken}`,
        "file_offset": "0",
        "Content-Type": contentType,
      },
      body: fileBuffer,
    }
  );

  const uploadData = await uploadResponse.json();
  if (uploadData.error) {
    console.error("File upload error:", uploadData.error);
    throw new Error(uploadData.error.message);
  }

  return uploadData.h;
}

// ==================== 1. CREATE TEMPLATE ====================
export async function createMetaTemplate(store, templateData) {
  const { decrypt } = await import("../utils/encryption.server.js");
  const whatsappApiToken = decrypt(store.whatsappApiToken);
  const whatsappBusinessId = store.whatsappBusinessId;

  if (!whatsappBusinessId || !whatsappApiToken) {
    throw new Error("WhatsApp credentials not configured");
  }
  const components = [];

  if (templateData.headerType && templateData.headerType !== "none") {
    const headerComponent = { type: "HEADER" };

    if (templateData.headerType === "text") {
      headerComponent.format = "TEXT";
      headerComponent.text = templateData.headerText || "";
    } else if (["image", "video", "document"].includes(templateData.headerType)) {
      headerComponent.format = templateData.headerType.toUpperCase();
      if (templateData.headerMediaUrl) {
        try {
          const mediaHandle = await uploadMediaToMeta(store, templateData.headerMediaUrl);
          headerComponent.example = { header_handle: [mediaHandle] };
        } catch (e) {
          console.warn("Media upload to Meta failed:", e.message);
          throw new Error(`Media upload failed: ${e.message}`);
        }
      }
    }

    components.push(headerComponent);
  }

  if (templateData.body) {
    const bodyComponent = { type: "BODY", text: templateData.body };

    if (templateData.variablesMap && Object.keys(templateData.variablesMap).length > 0) {
      const varMap = templateData.variablesMap;
      const keys = Object.keys(varMap).map((k) => parseInt(k));
      const maxIndex = Math.max(...keys);
      const FIELD_SAMPLES = {
        customer_name: "John Doe", order_number: "#1234", total_amount: "PKR 1500",
        shop_name: "My Store", product_names: "Shirt x1", customer_address: "123 Main St",
        city: "Karachi", payment_method: "COD", order_date: "May 25, 2026",
        order_id: "123456789", customer_phone: "03001234567", product_quantities: "1, 2",
        product_prices: "PKR 500", delivery_charge: "PKR 200", payment_status: "paid",
        tracking_number: "TCS123456", tracking_url: "https://track.example.com",
        tracking_company: "TCS", checkout_url: "https://checkout.example.com",
        fulfillment_name: "EU44639.1", fulfillment_items: "Shirt x1, Pants x2",
        fulfillment_total: "PKR 749.95", fulfillment_prices: "PKR 500, PKR 1000",
        discount_code: "SAVE20",
      };
      const examples = [];
      for (let i = 1; i <= maxIndex; i++) {
        const val = varMap[String(i)];
        if (val && FIELD_SAMPLES[val]) examples.push(FIELD_SAMPLES[val]);
        else if (val) examples.push(val);
        else examples.push(`sample_${i}`);
      }
      bodyComponent.example = { body_text: [examples] };
    }

    components.push(bodyComponent);
  }

  if (templateData.footer) {
    components.push({ type: "FOOTER", text: templateData.footer });
  }

  if (templateData.buttons && templateData.buttons.length > 0) {
    const metaButtons = templateData.buttons.map((btn) => {
      if (btn.type === "QUICK_REPLY") {
        return { type: "QUICK_REPLY", text: btn.text };
      } else if (btn.type === "URL") {
        const urlBtn = { type: "URL", text: btn.text, url: btn.url || "" };
        if (btn.urlType === "dynamic") urlBtn.example = [btn.url + "/example"];
        return urlBtn;
      } else if (btn.type === "PHONE_NUMBER") {
        return { type: "PHONE_NUMBER", text: btn.text, phone_number: (btn.countryCode || "+92") + (btn.phoneNumber || "") };
      } else if (btn.type === "COPY_CODE") {
        return { type: "COPY_CODE", example: btn.offerCode || "CODE123" };
      }
      return null;
    }).filter(Boolean);

    components.push({ type: "BUTTONS", buttons: metaButtons });
  }

  const requestBody = {
    name: templateData.name,
    language: templateData.language,
    category: templateData.type === "utility" ? "UTILITY" : "MARKETING",
    components,
  };

  const response = await fetch(
    `${GRAPH_API_BASE}/${whatsappBusinessId}/message_templates`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${whatsappApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  const data = await response.json();
  if (data.error) {
    console.error("Meta API Error:", data.error);
    throw new Error(data.error.message || "Failed to create template on Meta");
  }

  return {
    metaTemplateId: data.id,
    status: data.status || "PENDING",
  };
}

// ==================== 2. GET TEMPLATE STATUS ====================
export async function getMetaTemplateStatus(store, templateName) {
  const { decrypt } = await import("../utils/encryption.server.js");
  const whatsappApiToken = decrypt(store.whatsappApiToken);
  const whatsappBusinessId = store.whatsappBusinessId;

  const response = await fetch(
    `${GRAPH_API_BASE}/${whatsappBusinessId}/message_templates?name=${templateName}`,
    { headers: { "Authorization": `Bearer ${whatsappApiToken}` } }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Failed to fetch template status");

  if (data.data && data.data.length > 0) {
    const template = data.data[0];
    return {
      metaTemplateId: template.id,
      status: template.status.toLowerCase(),
      language: template.language,
      rejectionReason: template.rejected_reason || null,
    };
  }
  return null;
}

// ==================== 3. GET ALL TEMPLATES FROM META ====================
export async function getAllMetaTemplates(store) {
  const { decrypt } = await import("../utils/encryption.server.js");
  const whatsappApiToken = decrypt(store.whatsappApiToken);
  const whatsappBusinessId = store.whatsappBusinessId;

  const response = await fetch(
    `${GRAPH_API_BASE}/${whatsappBusinessId}/message_templates?limit=500`,
    { headers: { "Authorization": `Bearer ${whatsappApiToken}` } }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Failed to fetch templates");

  return data.data || [];
}

// ==================== 4. DELETE TEMPLATE ====================
export async function deleteMetaTemplate(store, templateName) {
  const { decrypt } = await import("../utils/encryption.server.js");
  const whatsappApiToken = decrypt(store.whatsappApiToken);
  const whatsappBusinessId = store.whatsappBusinessId;

  const response = await fetch(
    `${GRAPH_API_BASE}/${whatsappBusinessId}/message_templates?name=${templateName}`,
    { method: "DELETE", headers: { "Authorization": `Bearer ${whatsappApiToken}` } }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Failed to delete template");

  return { success: true };
}