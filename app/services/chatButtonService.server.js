const METAFIELD_NAMESPACE = "sendly";
const METAFIELD_KEY = "chat_button";

const DEFAULT_CONFIG = {
  enabled: false,
  phoneNumber: "",
  position: "bottom-right",
  prefilledMessage: "",
  buttonText: "Chat with us",
};

// ==================== LOAD CHAT BUTTON CONFIG ====================
export async function loadChatButton(admin) {
  const response = await admin.graphql(
    `#graphql
    query {
      shop {
        id
        metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
          id
          value
        }
      }
    }`
  );

  const json = await response.json();
  const shop = json?.data?.shop;
  const raw = shop?.metafield?.value;

  let config = { ...DEFAULT_CONFIG };
  if (raw) {
    try {
      config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch (e) {
      console.warn("Invalid chat button metafield:", e.message);
    }
  }

  return { shopId: shop?.id, config };
}

// ==================== SAVE CHAT BUTTON CONFIG ====================
export async function saveChatButton(admin, formData) {
  const { shopId } = await loadChatButton(admin);
  if (!shopId) return { success: false, error: "Shop not found" };

  const config = {
    enabled: formData.get("enabled") === "true",
    phoneNumber: (formData.get("phoneNumber") || "").trim(),
    position: formData.get("position") || "bottom-right",
    prefilledMessage: (formData.get("prefilledMessage") || "").trim(),
    buttonText: (formData.get("buttonText") || "Chat with us").trim(),
  };

  if (config.enabled && !config.phoneNumber) {
    return { success: false, error: "Enter a WhatsApp number before enabling the chat button." };
  }

  const response = await admin.graphql(
    `#graphql
    mutation setChatButton($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: shopId,
            namespace: METAFIELD_NAMESPACE,
            key: METAFIELD_KEY,
            type: "json",
            value: JSON.stringify(config),
          },
        ],
      },
    }
  );

  const json = await response.json();
  const errors = json?.data?.metafieldsSet?.userErrors;
  if (errors?.length) {
    return { success: false, error: errors[0].message };
  }

  return { success: true, type: "saved", config };
}
