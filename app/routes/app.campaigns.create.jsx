import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadCreateCampaignPage, createCampaign } from "../services/campaignService.server.js";
import {
  Page, Card, TextField, Banner, Toast, Frame, BlockStack,
  InlineStack, Text, Box, InlineGrid, Badge,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return await loadCreateCampaignPage(session);
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  return await createCampaign(session, formData);
};

export default function CreateCampaign() {
  const data = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [campaignName, setCampaignName] = useState("");
  const [targetUrl, setTargetUrl] = useState(data.storeUrl || "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [toastError, setToastError] = useState(false);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (fetcher.data?.success) {
      setToastMessage("Campaign created successfully!");
      setToastActive(true);
      setTimeout(() => navigate("/app/campaigns"), 1500);
    }
    if (fetcher.data?.error) {
      setToastMessage(fetcher.data.error);
      setToastError(true);
      setToastActive(true);
    }
  }, [fetcher.data]);

  const handleSubmit = () => {
    const form = new FormData();
    form.set("campaignName", campaignName);
    form.set("targetUrl", targetUrl);
    form.set("startDate", startDate);
    form.set("endDate", endDate);
    form.set("notes", notes);
    fetcher.submit(form, { method: "POST" });
  };

  const previewCode = campaignName
    ? `${campaignName.toUpperCase().replace(/[^A-Z0-9]+/g, "").substring(0, 10)}_XXXXXXXX`
    : "CODE_XXXXXXXX";
  const previewUrl = `${targetUrl}${targetUrl.includes("?") ? "&" : "?"}utm_source=whatsapp&utm_medium=campaign&utm_campaign=${previewCode}`;

  const isSubmitting = fetcher.state === "submitting";
  const canSubmit = campaignName && startDate && endDate && !isSubmitting;

  if (data.error) {
    return (
      <Frame>
        <Page title="Create Campaign" backAction={{ content: "Campaigns", onAction: () => navigate("/app/campaigns") }}>
          <Banner tone="critical"><p>{data.error}</p></Banner>
        </Page>
      </Frame>
    );
  }

  return (
    <Frame>
      <Page
        title="Create Campaign"
        backAction={{ content: "Campaigns", onAction: () => navigate("/app/campaigns") }}
        primaryAction={{
          content: isSubmitting ? "Creating..." : "Create Campaign",
          onAction: handleSubmit,
          loading: isSubmitting,
          disabled: !canSubmit,
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => navigate("/app/campaigns") }]}
      >
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingSm" as="h2">Campaign details</Text>

              <TextField label="Campaign name" value={campaignName} onChange={setCampaignName} placeholder="e.g. Eid Sale 2026" autoComplete="off" />

              <TextField
                label="Target URL"
                value={targetUrl}
                onChange={setTargetUrl}
                placeholder="https://yourstore.myshopify.com/"
                helpText="The store URL or collection page where customers will land."
                autoComplete="off"
              />

              <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
                <TextField label="Start date" type="date" value={startDate} onChange={setStartDate} autoComplete="off" />
                <TextField label="End date" type="date" value={endDate} onChange={setEndDate} autoComplete="off" />
              </InlineGrid>

              <TextField label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Campaign description or notes..." multiline={3} autoComplete="off" />
            </BlockStack>
          </Card>

          <Card background="bg-surface-secondary">
            <BlockStack gap="300">
              <Text variant="headingSm" as="h2">Generated tracking URL</Text>
              <Text variant="bodySm" tone="subdued">This URL will be auto-generated. Copy it and add to your WhatsApp template button.</Text>

              <InlineStack gap="200" blockAlign="center">
                <Text variant="bodySm" fontWeight="semibold" as="span">Campaign Code:</Text>
                <Badge tone="info">{previewCode}</Badge>
              </InlineStack>

              <Card>
                <Text variant="bodySm" as="p" breakWord>{previewUrl}</Text>
              </Card>

              <Text variant="bodySm" tone="subdued">Actual code will be unique and generated on creation.</Text>
            </BlockStack>
          </Card>
        </BlockStack>

        <Box paddingBlockEnd="800" />
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