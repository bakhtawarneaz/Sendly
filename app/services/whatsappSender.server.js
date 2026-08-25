// ==================== WHATSAPP MESSAGE SENDER ====================

const GRAPH_API_VERSION = "v21.0";

export async function sendTemplateMessage(store, template, customerPhone, variables = [], buttonParams = [], productImageUrl = null) {
  const { decrypt } = await import("../utils/encryption.server.js");
  const whatsappApiToken = decrypt(store.whatsappApiToken);
  const whatsappPhoneId = store.whatsappPhoneId;

  if (!whatsappApiToken || !whatsappPhoneId) {
    throw new Error("WhatsApp credentials not configured");
  }

  const phone = customerPhone.replace(/[\s\-\+]/g, "");
  const components = [];

  if (template.headerType === "image") {
    const imageUrl = productImageUrl || template.headerMediaUrl;
    if (imageUrl) {
      components.push({
        type: "header",
        parameters: [{ type: "image", image: { link: imageUrl } }],
      });
    }
  } else if (template.headerType === "video" && template.headerMediaUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "video", video: { link: template.headerMediaUrl } }],
    });
  } else if (template.headerType === "document" && template.headerMediaUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "document", document: { link: template.headerMediaUrl } }],
    });
  }

  if (variables.length > 0) {
    components.push({
      type: "body",
      parameters: variables.map(val => ({ type: "text", text: String(val) })),
    });
  }

  if (template.buttons && Array.isArray(template.buttons)) {
    template.buttons.forEach((btn, index) => {
      if (btn.type === "URL" && btn.urlType === "dynamic") {
        const dynamicValue = buttonParams[index] || "";
        if (dynamicValue) {
          components.push({
            type: "button",
            sub_type: "url",
            index: index,
            parameters: [{ type: "text", text: String(dynamicValue) }],
          });
        }
      }
    });
  }

  const requestBody = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language || "en" },
    },
  };

  if (components.length > 0) {
    requestBody.template.components = components;
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${whatsappPhoneId}/messages`,
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
    console.error("WhatsApp API Error:", data.error);
    throw new Error(`(#${data.error.code || "unknown"}) ${data.error.message || "Failed to send message"}`);
  }

  return {
    messageId: data.messages?.[0]?.id || null,
    status: data.messages?.[0]?.message_status || "sent",
  };
}

export async function sendInteractiveListMessage(store, customerPhone, { bodyText, buttonText, sections, headerText = null, footerText = null }) {
  const { decrypt } = await import("../utils/encryption.server.js");
  const whatsappApiToken = decrypt(store.whatsappApiToken);
  const whatsappPhoneId = store.whatsappPhoneId;

  if (!whatsappApiToken || !whatsappPhoneId) {
    throw new Error("WhatsApp credentials not configured");
  }

  const phone = customerPhone.replace(/[\s\-\+]/g, "");

  const interactive = {
    type: "list",
    body: { text: bodyText },
    action: { button: buttonText, sections },
  };
  if (headerText) interactive.header = { type: "text", text: headerText };
  if (footerText) interactive.footer = { text: footerText };

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${whatsappPhoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${whatsappApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "interactive",
        interactive,
      }),
    }
  );

  const data = await response.json();

  if (data.error) {
    console.error("WhatsApp API Error:", data.error);
    throw new Error(`(#${data.error.code || "unknown"}) ${data.error.message || "Failed to send interactive message"}`);
  }

  return {
    messageId: data.messages?.[0]?.id || null,
  };
}

export async function sendTextMessage(store, customerPhone, text) {
  const { decrypt } = await import("../utils/encryption.server.js");
  const whatsappApiToken = decrypt(store.whatsappApiToken);
  const whatsappPhoneId = store.whatsappPhoneId;

  if (!whatsappApiToken || !whatsappPhoneId) {
    throw new Error("WhatsApp credentials not configured");
  }

  const phone = customerPhone.replace(/[\s\-\+]/g, "");

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${whatsappPhoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${whatsappApiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: text },
      }),
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "Failed to send text message");
  } 

  return {
    messageId: data.messages?.[0]?.id || null,
  };
}