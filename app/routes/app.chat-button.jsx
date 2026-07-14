import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadChatButton, saveChatButton } from "../services/chatButtonService.server.js";
import {
  Page, Card, TextField, Select, Button, Banner, Toast, Frame,
  BlockStack, InlineStack, Text, Box, Divider, InlineGrid, Badge,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { config } = await loadChatButton(admin);
  return { config, shop: session.shop };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  return await saveChatButton(admin, formData);
};

export default function ChatButton() {
  const { config: initial, shop } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [enabled, setEnabled] = useState(initial.enabled);
  const [phoneNumber, setPhoneNumber] = useState(initial.phoneNumber);
  const [position, setPosition] = useState(initial.position);
  const [prefilledMessage, setPrefilledMessage] = useState(initial.prefilledMessage);
  const [buttonText, setButtonText] = useState(initial.buttonText);

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const showToast = (message, error = false) => {
    setToastMessage(message);
    setToastError(error);
    setToastActive(true);
  };

  useEffect(() => {
    if (fetcher.data?.success) showToast("Chat button settings saved!");
    if (fetcher.data?.error) showToast(fetcher.data.error, true);
  }, [fetcher.data]);

  const isSubmitting = fetcher.state === "submitting";

  const handleSave = () => {
    const form = new FormData();
    form.set("enabled", enabled.toString());
    form.set("phoneNumber", phoneNumber);
    form.set("position", position);
    form.set("prefilledMessage", prefilledMessage);
    form.set("buttonText", buttonText);
    fetcher.submit(form, { method: "POST" });
  };

  const openThemeEditor = () => {
    const shopName = shop.replace(".myshopify.com", "");
    window.open(`https://admin.shopify.com/store/${shopName}/themes/current/editor?context=apps`, "_blank");
  };

  const Toggle = ({ value, onChange }) => (
    <div onClick={() => onChange(!value)} style={{ width: "44px", height: "24px", borderRadius: "12px", cursor: "pointer", background: value ? "#005bd3" : "#b5b5b5", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "white", position: "absolute", top: "2px", left: value ? "22px" : "2px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}></div>
    </div>
  );

  return (
    <Frame>
      <Page
        title="WhatsApp Chat Button"
        subtitle="Add a floating WhatsApp button to your storefront so customers can reach you instantly."
        primaryAction={{
          content: isSubmitting ? "Saving..." : "Save",
          onAction: handleSave,
          loading: isSubmitting,
          disabled: isSubmitting,
        }}
      >
        <InlineGrid columns={{ xs: 1, md: ["twoThirds", "oneThird"] }} gap="400">
          <BlockStack gap="400">
            {/* STATUS + NUMBER */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <InlineStack gap="200" blockAlign="center">
                      <Text variant="headingSm" as="h2">Chat Button</Text>
                      <Badge tone={enabled ? "success" : undefined}>{enabled ? "Enabled" : "Disabled"}</Badge>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued">Show a WhatsApp button on your storefront.</Text>
                  </BlockStack>
                  <Toggle value={enabled} onChange={setEnabled} />
                </InlineStack>

                <Divider />

                <TextField
                  label="WhatsApp Number"
                  value={phoneNumber}
                  onChange={setPhoneNumber}
                  placeholder="e.g. 923001234567"
                  helpText="Include the country code without + or spaces (e.g. 923001234567)."
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            {/* CUSTOMIZATION */}
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <Text variant="headingSm" as="h2">Appearance</Text>
                  <Text variant="bodySm" tone="subdued">Customize how the button looks and behaves.</Text>
                </BlockStack>

                <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
                  <Select
                    label="Position"
                    options={[
                      { label: "Bottom right", value: "bottom-right" },
                      { label: "Bottom left", value: "bottom-left" },
                    ]}
                    value={position}
                    onChange={setPosition}
                  />
                  <TextField
                    label="Button text"
                    value={buttonText}
                    onChange={setButtonText}
                    placeholder="Chat with us"
                    maxLength={24}
                    showCharacterCount
                    autoComplete="off"
                  />
                </InlineGrid>

                <TextField
                  label="Pre-filled message (optional)"
                  value={prefilledMessage}
                  onChange={setPrefilledMessage}
                  placeholder="Hi! I have a question about..."
                  helpText="This text is pre-filled in the customer's WhatsApp chat when they tap the button."
                  multiline={2}
                  maxLength={200}
                  showCharacterCount
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            {/* THEME EXTENSION */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h2">Theme Extension</Text>
                <Banner tone="info">
                  <p>After saving, activate the <strong>Sendly Chat Button</strong> app embed in your theme editor. The button will only appear once both are done.</p>
                </Banner>
                <InlineStack>
                  <Button onClick={openThemeEditor}>Open Theme Editor ↗</Button>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* SETUP GUIDE */}
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h2">Setup Guide</Text>
                <BlockStack gap="200">
                  {[
                    "Enter your WhatsApp number with country code (e.g. 923001234567)",
                    "Turn the chat button on and click Save",
                    "Click Open Theme Editor and activate the Sendly Chat Button app embed",
                    "The WhatsApp button will now appear on your storefront",
                  ].map((step, i) => (
                    <InlineStack key={i} gap="300" blockAlign="start" wrap={false}>
                      <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#f1f1f1", color: "#616161", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <Text variant="bodySm" as="p">{step}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>

          {/* PREVIEW */}
          <div style={{ position: "sticky", top: "60px" }}>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingSm" as="h2">Preview</Text>
                <div
                  style={{
                    position: "relative",
                    background: "#f6f6f7",
                    border: "1px solid #e3e3e3",
                    borderRadius: "12px",
                    height: "280px",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "16px" }}>
                    <div style={{ height: "10px", width: "60%", background: "#e3e3e3", borderRadius: "4px", marginBottom: "10px" }}></div>
                    <div style={{ height: "8px", width: "90%", background: "#ebebeb", borderRadius: "4px", marginBottom: "6px" }}></div>
                    <div style={{ height: "8px", width: "75%", background: "#ebebeb", borderRadius: "4px", marginBottom: "16px" }}></div>
                    <div style={{ height: "80px", width: "100%", background: "#ebebeb", borderRadius: "8px" }}></div>
                  </div>

                  {enabled && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "16px",
                        [position === "bottom-left" ? "left" : "right"]: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        background: "#25d366",
                        color: "white",
                        padding: "10px 16px",
                        borderRadius: "28px",
                        fontSize: "13px",
                        fontWeight: 600,
                        boxShadow: "0 4px 14px rgba(37,211,102,0.4)",
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>💬</span>
                      {buttonText || "Chat with us"}
                    </div>
                  )}
                </div>
                <Text variant="bodySm" tone="subdued">
                  {enabled ? "The button will appear like this on your storefront." : "Enable the chat button to see the preview."}
                </Text>
              </BlockStack>
            </Card>
          </div>
        </InlineGrid>

        <Box paddingBlockEnd="800" />
        {toastActive && (
          <Toast content={toastMessage} error={toastError} onDismiss={() => setToastActive(false)} duration={3000} />
        )}
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};