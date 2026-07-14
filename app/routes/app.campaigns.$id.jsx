import { useLoaderData, useNavigate } from "react-router";
import { useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadCampaign } from "../services/campaignService.server.js";
import {
  Page, Card, IndexTable, Text, Badge, EmptyState, Toast, Frame,
  BlockStack, InlineStack, Box, InlineGrid, Button, Banner,
} from "@shopify/polaris";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  return await loadCampaign(session, params.id);
};

const STATUS_TONE = { active: "success", paused: "attention", completed: undefined };

export default function CampaignDetail() {
  const data = useLoaderData();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  if (data.error) {
    return (
      <Frame>
        <Page title="Campaign" backAction={{ content: "Campaigns", onAction: () => navigate("/app/campaigns") }}>
          <Banner tone="critical"><p>{data.error}</p></Banner>
        </Page>
      </Frame>
    );
  }

  const { campaign, stats, dailyRevenue, orders, currency } = data;

  const copyUrl = () => {
    navigator.clipboard.writeText(campaign.trackingUrl);
    setCopied(true);
    setToastMessage("Tracking URL copied!");
    setToastActive(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const subtitleParts = [campaign.campaignCode, `${campaign.startDate} — ${campaign.endDate}`];
  if (campaign.daysLeft > 0) subtitleParts.push(`${campaign.daysLeft} days left`);
  if (campaign.notes) subtitleParts.push(campaign.notes);

  return (
    <Frame>
      <Page
        title={campaign.campaignName}
        titleMetadata={
          <Badge tone={STATUS_TONE[campaign.status]}>
            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
          </Badge>
        }
        subtitle={subtitleParts.join(" • ")}
        backAction={{ content: "Campaigns", onAction: () => navigate("/app/campaigns") }}
      >
        <Box paddingBlockEnd="400">
          <Card background="bg-surface-secondary">
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingSm" as="h2">Tracking URL</Text>
                <Button size="slim" onClick={copyUrl}>{copied ? "✓ Copied!" : "Copy URL"}</Button>
              </InlineStack>
              <Card>
                <Text variant="bodySm" as="p" breakWord>{campaign.trackingUrl}</Text>
              </Card>
              <Text variant="bodySm" tone="subdued">Add this URL to your WhatsApp template button.</Text>
            </BlockStack>
          </Card>
        </Box>

        <Box paddingBlockEnd="400">
          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
            {[
              { value: `${currency} ${stats.totalRevenue.toLocaleString()}`, label: "Total Revenue", tone: "success" },
              { value: stats.totalOrders, label: "Attributed Orders", tone: undefined },
              { value: `${currency} ${Math.round(stats.avgOrderValue).toLocaleString()}`, label: "Avg Order Value", tone: undefined },
            ].map((s, i) => (
              <Card key={i} padding="400">
                <BlockStack gap="100" inlineAlign="center">
                  <Text variant="headingLg" as="p" alignment="center" fontWeight="bold" tone={s.tone}>{s.value}</Text>
                  <Text variant="bodySm" as="p" alignment="center" tone="subdued">{s.label}</Text>
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>
        </Box>

        {dailyRevenue.length > 0 && (
          <Box paddingBlockEnd="400">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h2">Daily Revenue</Text>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8c9196" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#8c9196" }} axisLine={false} tickLine={false} />
                    <RTooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e3e3e3", fontSize: "12px" }}
                      cursor={{ fill: "#fafafa" }}
                      formatter={(value) => [`${currency} ${value.toLocaleString()}`, "Revenue"]}
                    />
                    <Bar dataKey="Revenue" fill="#16a34a" radius={[6, 6, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </BlockStack>
            </Card>
          </Box>
        )}

        <Card padding="0">
          <Box padding="400" paddingBlockEnd="0">
            <Text variant="headingSm" as="h2">Attributed Orders ({orders.length})</Text>
          </Box>

          {orders.length > 0 ? (
            <IndexTable
              resourceName={{ singular: "order", plural: "orders" }}
              itemCount={orders.length}
              headings={[
                { title: "Order" }, { title: "Customer" }, { title: "Phone" },
                { title: "Revenue" }, { title: "Type" }, { title: "Date" },
              ]}
              selectable={false}
            >
              {orders.map((o, index) => (
                <IndexTable.Row id={o.id} key={o.id} position={index}>
                  <IndexTable.Cell><Text variant="bodyMd" fontWeight="semibold" as="span">{o.orderNumber}</Text></IndexTable.Cell>
                  <IndexTable.Cell><Text variant="bodySm" as="span">{o.customerName}</Text></IndexTable.Cell>
                  <IndexTable.Cell><Text variant="bodySm" tone="subdued" as="span">{o.customerPhone}</Text></IndexTable.Cell>
                  <IndexTable.Cell>
                    <Text variant="bodyMd" fontWeight="semibold" tone="success" as="span">
                      {o.currency} {o.revenue.toLocaleString()}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell><Badge tone="info">{o.attributionType}</Badge></IndexTable.Cell>
                  <IndexTable.Cell><Text variant="bodySm" tone="subdued" as="span">{o.createdAt}</Text></IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          ) : (
            <EmptyState heading="No orders yet" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png">
              <p>No orders attributed to this campaign yet.</p>
            </EmptyState>
          )}
        </Card>

        <Box paddingBlockEnd="800" />
        {toastActive && <Toast content={toastMessage} onDismiss={() => setToastActive(false)} duration={2000} />}
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};