import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadDashboard } from "../services/dashboardService.server.js";
import { getStore } from "../utils/helpers.server.js";
import {
  Page,
  Frame,
  Layout,
  Card,
  Box,
  BlockStack,
  InlineStack,
  InlineGrid,
  Text,
  Button,
  Badge,
  Banner,
  Icon,
  Divider,
} from "@shopify/polaris";
import {
  EmailIcon,
  AutomationIcon,
  ChartVerticalIcon,
  CheckCircleIcon,
} from "@shopify/polaris-icons";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const store = await getStore(session);
  return await loadDashboard(admin, store);
};

const HERO_FEATURES = [
  {
    icon: EmailIcon,
    title: "Branded messages",
    desc: "Connect your WhatsApp Business account and message customers using your own brand name.",
    bg: "var(--p-color-bg-surface-success)",
    fg: "var(--p-color-icon-success)",
  },
  {
    icon: AutomationIcon,
    title: "Enable automation",
    desc: "Automatically send order confirmation, fulfillment and delivery updates — no manual work.",
    bg: "var(--p-color-bg-surface-info)",
    fg: "var(--p-color-icon-info)",
  },
  {
    icon: ChartVerticalIcon,
    title: "Track and analyze",
    desc: "Monitor delivery, track customer responses and measure performance in real time.",
    bg: "var(--p-color-bg-surface-magic)",
    fg: "var(--p-color-icon-magic)",
  },
];

// Colored icon tile — subtle background using Polaris tokens (review-safe)
function IconTile({ source, bg, fg }) {
  return (
    <div
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "10px",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ width: "20px", height: "20px", color: fg }}>
        <Icon source={source} />
      </span>
    </div>
  );
}

const BILLING_INFO = [
  { title: "App billing", text: "Subscription charges are billed through your Shopify account every 30 days." },
  { title: "WhatsApp billing", text: "WhatsApp API message charges are billed separately by Meta from your connected Business account." },
  { title: "Free trial", text: "7-day free trial with 10 messages. Connect your own WhatsApp Business account to send. Meta's API charges apply during the trial — only the app subscription fee is waived." },
  { title: "Change anytime", text: "Upgrade, downgrade or cancel at any time. Changes take effect immediately." },
];

export default function Dashboard() {
  const {
    shop, isTrial, trialDaysLeft, isFrozen, whatsappConnected, billingStatus, activeServices,
  } = useLoaderData();
  const navigate = useNavigate();

  const storeInfo = [
    { label: "Store", value: shop.name },
    { label: "Domain", value: shop.myshopifyDomain },
    { label: "Email", value: shop.email },
    { label: "Plan", value: shop.plan.displayName },
    { label: "Currency", value: shop.currencyCode },
    { label: "Billing", value: billingStatus.charAt(0).toUpperCase() + billingStatus.slice(1) },
  ];

  return (
    <Frame>
      <Page title="Dashboard" subtitle={`Welcome back, ${shop.name}`}>
        <Layout>
          {/* ---------- HERO ---------- */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="start" wrap gap="400">
                  <Box maxWidth="620px">
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingLg">
                        Automate WhatsApp notifications for your Shopify store
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Keep customers updated at every step — order confirmations, fulfillment,
                        delivery and more, sent straight to WhatsApp.
                      </Text>
                    </BlockStack>
                  </Box>
                  {whatsappConnected && (
                    <Badge tone="success" progress="complete">
                      WhatsApp connected
                    </Badge>
                  )}
                </InlineStack>

                <Divider />

                <InlineGrid columns={{ xs: 1, sm: 1, md: 3 }} gap="400">
                  {HERO_FEATURES.map((f) => (
                    <BlockStack key={f.title} gap="200">
                      <IconTile source={f.icon} bg={f.bg} fg={f.fg} />
                      <Text as="h3" variant="headingSm">
                        {f.title}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {f.desc}
                      </Text>
                    </BlockStack>
                  ))}
                </InlineGrid>

                {!whatsappConnected && (
                  <Box>
                    <Button variant="primary" onClick={() => navigate("/app/settings")}>
                      Get started
                    </Button>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ---------- TRIAL BANNER ---------- */}
          {isTrial && (
            <Layout.Section>
              <Banner
                tone="info"
                title="Free trial active"
                action={{ content: "View plans", onAction: () => navigate("/app/plans") }}
              >
                <p>
                  {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left · {activeServices}{" "}
                  {activeServices === 1 ? "service" : "services"} active. Try all services free — no
                  credit card required.
                </p>
              </Banner>
            </Layout.Section>
          )}

          {/* ---------- FROZEN BANNER ---------- */}
          {isFrozen && (
            <Layout.Section>
              <Banner
                tone="critical"
                title="Your trial has ended"
                action={{ content: "View plans", onAction: () => navigate("/app/plans") }}
              >
                <p>
                  Message sending is paused. Your services and settings are safe — subscribe to
                  resume immediately.
                </p>
              </Banner>
            </Layout.Section>
          )}

          {/* ---------- STORE INFORMATION ---------- */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Store information
                </Text>
                <InlineGrid columns={{ xs: 2, sm: 3, md: 6 }} gap="400">
                  {storeInfo.map((item) => (
                    <BlockStack key={item.label} gap="100">
                      <Text as="span" variant="bodySm" tone="subdued">
                        {item.label}
                      </Text>
                      <Text as="span" variant="bodyMd" fontWeight="medium" truncate>
                        {item.value}
                      </Text>
                    </BlockStack>
                  ))}
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ---------- HOW BILLING WORKS ---------- */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  How billing works
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
                  {BILLING_INFO.map((item) => (
                    <BlockStack key={item.title} gap="100">
                      <Text as="h4" variant="headingSm">
                        {item.title}
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {item.text}
                      </Text>
                    </BlockStack>
                  ))}
                </InlineGrid>
                <Divider />
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="attention">Total cost</Badge>
                  <Text as="span" variant="bodySm" tone="subdued">
                    App charges (via Shopify) + WhatsApp API charges (via Meta)
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Box paddingBlockEnd="800" />
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};