import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadSettings, saveWhatsappSettings, disconnectWhatsapp } from "../services/settingsService.server.js";
import {
  Page, Card, TextField, Button, Banner, Toast, Frame,
  BlockStack, InlineStack, Text, Box, Badge, Divider,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await loadSettings(session);
  return {
    ...settings,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "save_whatsapp") return await saveWhatsappSettings(session, formData);
  if (actionType === "disconnect_whatsapp") return await disconnectWhatsapp(session);
  return { success: false, error: "Unknown action" };
};

export default function Settings() {
  const data = useLoaderData();
  const fetcher = useFetcher();

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const [whatsappApiToken, setWhatsappApiToken] = useState(data.whatsappApiToken);
  const [whatsappPhoneId, setWhatsappPhoneId] = useState(data.whatsappPhoneId);
  const [whatsappBusinessId, setWhatsappBusinessId] = useState(data.whatsappBusinessId);
  const [whatsappConnected, setWhatsappConnected] = useState(data.whatsappConnected);
  const [showToken, setShowToken] = useState(false);

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const showToast = (message, error = false) => {
    setToastMessage(message);
    setToastError(error);
    setToastActive(true);
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.type === "whatsapp") {
        setWhatsappConnected(fetcher.data.whatsappConnected);
        showToast("WhatsApp settings saved successfully!");
      } else if (fetcher.data.type === "disconnect") {
        setWhatsappApiToken("");
        setWhatsappPhoneId("");
        setWhatsappBusinessId("");
        setWhatsappConnected(false);
        showToast("WhatsApp disconnected.");
      }
    }
    if (fetcher.data?.error) {
      showToast(fetcher.data.error, true);
    }
  }, [fetcher.data]);

  const isSubmitting = fetcher.state === "submitting";

  const handleSave = () => {
    const form = new FormData();
    form.set("actionType", "save_whatsapp");
    form.set("whatsappApiToken", whatsappApiToken);
    form.set("whatsappPhoneId", whatsappPhoneId);
    form.set("whatsappBusinessId", whatsappBusinessId);
    fetcher.submit(form, { method: "POST" });
  };

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect WhatsApp?")) {
      const form = new FormData();
      form.set("actionType", "disconnect_whatsapp");
      fetcher.submit(form, { method: "POST" });
    }
  };

  const callbackUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/whatsapp-callback`
    : "https://your-app-url/api/whatsapp-callback";

  return (
    <Frame>
      <Page title="Settings">
        <BlockStack gap="400">
          <Banner
            title="WhatsApp Business API"
            tone={whatsappConnected ? "success" : "critical"}
          >
            <InlineStack gap="200" blockAlign="center">
              <Text variant="bodySm" as="span">
                {whatsappConnected
                  ? "Connected & Ready"
                  : "Not Connected — enter your credentials below"}
              </Text>
              {whatsappConnected && <Badge tone="success">Active</Badge>}
            </InlineStack>
          </Banner>

          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text variant="headingSm" as="h2">WhatsApp API Credentials</Text>
                <Text variant="bodySm" tone="subdued">
                  Enter your Meta WhatsApp Business API credentials. Get these from{" "}
                  <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--p-color-text-link)" }}>
                    Meta Developer Portal
                  </a>
                </Text>
              </BlockStack>

              <TextField
                label="WhatsApp Business Account ID"
                value={whatsappBusinessId}
                onChange={setWhatsappBusinessId}
                placeholder="e.g. 123456789012345"
                helpText="Found in Meta Business Suite → WhatsApp → API Setup"
                autoComplete="off"
              />

              <TextField
                label="Phone Number ID"
                value={whatsappPhoneId}
                onChange={setWhatsappPhoneId}
                placeholder="e.g. 123456789012345"
                helpText="The ID of your registered WhatsApp phone number"
                autoComplete="off"
              />

              <TextField
                label="Permanent Access Token"
                type={showToken ? "text" : "password"}
                value={whatsappApiToken}
                onChange={setWhatsappApiToken}
                placeholder="EAAxxxxxxxx..."
                helpText="Generate from System User in Meta Business Settings"
                autoComplete="off"
                connectedRight={
                  <Button onClick={() => setShowToken(!showToken)} size="large">
                    {showToken ? "Hide" : "Show"}
                  </Button>
                }
              />

              <Divider />

              <InlineStack gap="300">
                <Button variant="primary" onClick={handleSave} loading={isSubmitting} disabled={isSubmitting}>
                  Save Credentials
                </Button>
                {whatsappConnected && (
                  <Button tone="critical" onClick={handleDisconnect} disabled={isSubmitting}>
                    Disconnect
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text variant="headingSm" as="h2">How to get WhatsApp API credentials?</Text>
              <BlockStack gap="100">
                <Text variant="bodySm" as="p">1. Go to <strong>developers.facebook.com</strong> → Create or select your app</Text>
                <Text variant="bodySm" as="p">2. Add <strong>WhatsApp</strong> product to your app</Text>
                <Text variant="bodySm" as="p">3. Go to <strong>WhatsApp → API Setup</strong></Text>
                <Text variant="bodySm" as="p">4. Copy <strong>Phone Number ID</strong> and <strong>WhatsApp Business Account ID</strong></Text>
                <Text variant="bodySm" as="p">5. For permanent token: Go to <strong>Business Settings → System Users</strong> → Generate Token</Text>
                <Text variant="bodySm" as="p">6. Paste all credentials above and click Save</Text>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text variant="headingSm" as="h2">WhatsApp Webhook Setup</Text>
              <Banner tone="info">
                <p>To receive customer responses (confirm/cancel buttons), you must set up a webhook in your Meta Developer Portal. This is a one-time setup.</p>
              </Banner>

              <BlockStack gap="200">
                <Text variant="bodySm" fontWeight="semibold" as="p">Callback URL:</Text>
                <div style={{ background: "#f6f6f7", border: "1px solid #e3e3e3", borderRadius: "8px", padding: "10px 14px", fontFamily: "monospace", fontSize: "13px", wordBreak: "break-all", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span>{callbackUrl}</span>
                  <Button size="slim" onClick={() => { navigator.clipboard.writeText(callbackUrl); setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000); }}>
                    {copiedUrl ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </BlockStack>

              <BlockStack gap="200">
                <Text variant="bodySm" fontWeight="semibold" as="p">Verify Token:</Text>
                <div style={{ background: "#f6f6f7", border: "1px solid #e3e3e3", borderRadius: "8px", padding: "10px 14px", fontFamily: "monospace", fontSize: "13px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span>{data.verifyToken || "— not set —"}</span>
                  <Button size="slim" onClick={() => { navigator.clipboard.writeText(data.verifyToken); setCopiedToken(true); setTimeout(() => setCopiedToken(false), 2000); }}>
                    {copiedToken ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </BlockStack>

              <Divider />

              <Text variant="bodySm" fontWeight="semibold" as="p">Setup Steps:</Text>
              <BlockStack gap="100">
                <Text variant="bodySm" as="p">1. Go to <strong>developers.facebook.com</strong> → Select your app</Text>
                <Text variant="bodySm" as="p">2. Go to <strong>WhatsApp → Configuration</strong></Text>
                <Text variant="bodySm" as="p">3. Under <strong>Webhook</strong>, click <strong>Edit</strong></Text>
                <Text variant="bodySm" as="p">4. Paste the <strong>Callback URL</strong> and <strong>Verify Token</strong> from above</Text>
                <Text variant="bodySm" as="p">5. Click <strong>Verify and Save</strong></Text>
                <Text variant="bodySm" as="p">6. Under <strong>Webhook fields</strong>, subscribe to <strong>messages</strong></Text>
              </BlockStack>

              <Banner tone="warning">
                <p>Without this setup, customer button responses (Order Confirm/Cancel) will not be received by the app.</p>
              </Banner>
            </BlockStack>
          </Card>

          <Box paddingBlockEnd="800" />
        </BlockStack>

        {toastActive && (
          <Toast content={toastMessage} error={toastError} onDismiss={() => { setToastActive(false); setToastError(false); }} duration={3000} />
        )}
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};