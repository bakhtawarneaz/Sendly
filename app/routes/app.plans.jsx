import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadPlansPage, subscribeToPlan, syncSubscriptionStatus } from "../services/planService.server.js";
import {
  Page,
  Layout,
  Card,
  Box,
  BlockStack,
  InlineStack,
  Grid,
  Text,
  Button,
  Badge,
  Banner,
  Divider,
  Icon,
  List,
  Frame,
  Toast,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  await syncSubscriptionStatus(admin, session);
  return await loadPlansPage(session);
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  return await subscribeToPlan(admin, session);
};

const FEATURES = [
  "Order Confirmation (WhatsApp)",
  "Order Fulfillment notifications",
  "Order Paid notifications",
  "Order Delivered notifications",
  "Order Cancelled notifications",
  "Abandoned Cart Recovery (3 reminders)",
  "Campaign UTM Tracking",
  "WhatsApp Chat Button",
  "Unlimited message templates",
  "Message logs & retry",
  "Analytics dashboard",
  "Priority support",
];

const BILLING_INFO = [
  {
    title: "App subscription",
    text: "Billed through your Shopify account every 30 days. Appears on your regular Shopify invoice.",
  },
  {
    title: "WhatsApp API charges",
    text: "Billed separately by Meta from your connected Business account, per message sent.",
  },
  {
    title: "Free trial",
    text: "7 days free on the app subscription. Connect your own WhatsApp Business account to send messages. Meta's API charges still apply during the trial.",
  },
  {
    title: "Cancel anytime",
    text: "No long-term commitment. Cancel from your Shopify admin whenever you like.",
  },
];

const FAQS = [
  {
    q: "What happens when my trial ends?",
    a: "Message sending pauses until you subscribe. Your services, templates and settings stay exactly as you left them — nothing is reset. Subscribe and everything resumes immediately.",
  },
  {
    q: "What are WhatsApp API charges?",
    a: "Meta charges a small fee per message sent through the WhatsApp Business API. These charges are separate from the app subscription and are billed directly by Meta to your connected Business account.",
  },
  {
    q: "Do I need a WhatsApp Business account?",
    a: "Yes. You need a Meta Business account with WhatsApp Business API enabled. Connect it in the Settings page of the app.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no long-term commitments. Cancel your subscription at any time from your Shopify admin.",
  },
];

function FeatureItem({ label }) {
  return (
    <InlineStack gap="200" blockAlign="center" wrap={false}>
      <Box>
        <Icon source={CheckIcon} tone="success" />
      </Box>
      <Text as="span" variant="bodyMd">
        {label}
      </Text>
    </InlineStack>
  );
}

export default function Plans() {
  const { plan, isTrial, isSubscribed, trialDaysLeft, billingStatus } = useLoaderData();
  const fetcher = useFetcher();
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data.confirmationUrl) {
      window.top.location.href = fetcher.data.confirmationUrl;
    }
    if (fetcher.data?.error) {
      setToastMessage(fetcher.data.error);
      setToastActive(true);
    }
  }, [fetcher.data]);

  const handleSubscribe = () => {
    fetcher.submit({}, { method: "POST" });
  };

  const isSubmitting = fetcher.state === "submitting";
  const isFrozen = billingStatus === "frozen";

  // split features into two balanced columns
  const mid = Math.ceil(FEATURES.length / 2);
  const featuresLeft = FEATURES.slice(0, mid);
  const featuresRight = FEATURES.slice(mid);

  return (
    <Frame>
      <Page
        title={isSubscribed ? "Your plan" : "Upgrade to Sendly Pro"}
        subtitle="One plan, everything included. Start with a 7-day free trial — no credit card required."
      >
        <Layout>
          {isFrozen && (
            <Layout.Section>
              <Banner tone="critical" title="Your trial has ended">
                <p>
                  Message sending is paused. Your services, templates and settings are safe — subscribe to
                  resume sending immediately.
                </p>
              </Banner>
            </Layout.Section>
          )}

          {isTrial && (
            <Layout.Section>
              <Banner tone="info" title={`You're on a free trial — ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left`}>
                <p>Subscribe anytime to keep sending after your trial ends.</p>
              </Banner>
            </Layout.Section>
          )}

          {/* ---------- PLAN CARD (two-column) ---------- */}
          <Layout.Section>
            <Card>
              <Grid>
                {/* LEFT: identity, price, CTA */}
                <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 5, xl: 5 }}>
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="h2" variant="headingLg">
                          {plan.name}
                        </Text>
                        {isSubscribed ? (
                          <Badge tone="success">Active</Badge>
                        ) : isTrial ? (
                          <Badge tone="info">Trialing</Badge>
                        ) : null}
                      </InlineStack>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Everything you need to automate WhatsApp notifications for your store.
                      </Text>
                    </BlockStack>

                    <InlineStack gap="100" blockAlign="baseline">
                      <Text as="span" variant="heading2xl">
                        ${plan.price}
                      </Text>
                      <Text as="span" variant="bodyMd" tone="subdued">
                        /month
                      </Text>
                    </InlineStack>

                    <Box>
                      <Button
                        variant="primary"
                        size="large"
                        fullWidth
                        loading={isSubmitting}
                        disabled={isSubscribed}
                        onClick={handleSubscribe}
                      >
                        {isSubscribed ? "Current plan" : "Subscribe"}
                      </Button>
                    </Box>

                    <Text as="p" variant="bodySm" tone="subdued">
                      Billed through Shopify every 30 days. Cancel anytime.
                    </Text>
                  </BlockStack>
                </Grid.Cell>

                {/* RIGHT: features in two columns */}
                <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 7, xl: 7 }}>
                  <Box
                    borderColor="border"
                    borderInlineStartWidth="025"
                    paddingInlineStart="500"
                  >
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingSm">
                        What's included
                      </Text>
                      <Grid>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
                          <BlockStack gap="300">
                            {featuresLeft.map((f) => (
                              <FeatureItem key={f} label={f} />
                            ))}
                          </BlockStack>
                        </Grid.Cell>
                        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6, xl: 6 }}>
                          <BlockStack gap="300">
                            {featuresRight.map((f) => (
                              <FeatureItem key={f} label={f} />
                            ))}
                          </BlockStack>
                        </Grid.Cell>
                      </Grid>
                    </BlockStack>
                  </Box>
                </Grid.Cell>
              </Grid>
            </Card>
          </Layout.Section>

          {/* ---------- BILLING INFO ---------- */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  How billing works
                </Text>
                <Grid>
                  {BILLING_INFO.map((item) => (
                    <Grid.Cell key={item.title} columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
                      <BlockStack gap="100">
                        <Text as="h4" variant="headingSm">
                          {item.title}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {item.text}
                        </Text>
                      </BlockStack>
                    </Grid.Cell>
                  ))}
                </Grid>
                <Divider />
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="attention">Total cost</Badge>
                  <Text as="span" variant="bodySm" tone="subdued">
                    App subscription (via Shopify) + WhatsApp API charges (via Meta)
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ---------- FAQ ---------- */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h3" variant="headingMd">
                  Frequently asked questions
                </Text>
                <BlockStack gap="0">
                  {FAQS.map((faq, i) => (
                    <Box key={faq.q}>
                      <Box paddingBlock="300">
                        <BlockStack gap="100">
                          <Text as="h4" variant="headingSm">
                            {faq.q}
                          </Text>
                          <Text as="p" variant="bodyMd" tone="subdued">
                            {faq.a}
                          </Text>
                        </BlockStack>
                      </Box>
                      {i < FAQS.length - 1 && <Divider />}
                    </Box>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Box paddingBlockEnd="800" />
          </Layout.Section>
        </Layout>

        {toastActive && (
          <Toast content={toastMessage} error onDismiss={() => setToastActive(false)} duration={4000} />
        )}
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};