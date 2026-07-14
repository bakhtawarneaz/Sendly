import { useLoaderData, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadPlansPage, subscribeToPlan, syncSubscriptionStatus } from "../services/planService.server.js";
import "../styles/plan.css";
import { Page, Toast, Frame, Box, Banner } from "@shopify/polaris";

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
  "Unlimited messages",
  "Message logs & retry",
  "Analytics dashboard",
  "Priority support",
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

  return (
    <Frame>
      <Page>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#1a1a1a", marginBottom: "8px" }}>
            {isSubscribed ? "Your plan" : "Upgrade to Sendly Pro"}
          </div>
          <div style={{ fontSize: "15px", color: "#616161", maxWidth: "520px", margin: "0 auto" }}>
            One plan, everything included. Start with a 7-day free trial — no credit card required.
          </div>
        </div>

        {isFrozen && (
          <Box paddingBlockEnd="400">
            <Banner tone="critical" title="Your trial has ended">
              <p>Message sending is paused. Your services, templates and settings are safe — subscribe to resume sending immediately.</p>
            </Banner>
          </Box>
        )}

        {isTrial && (
          <div style={{
            background: "linear-gradient(135deg, #1e3a5f 0%, #1a4a7a 100%)",
            borderRadius: "14px", padding: "20px 28px", color: "white", marginBottom: "28px",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px",
          }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700" }}>🚀 You're on a free trial</div>
              <div style={{ fontSize: "13px", opacity: 0.8, marginTop: "4px" }}>
                {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} remaining. Subscribe anytime to keep sending after it ends.
              </div>
            </div>
            <div style={{ textAlign: "center", background: "rgba(255,255,255,0.08)", borderRadius: "10px", padding: "12px 24px" }}>
              <div style={{ fontSize: "24px", fontWeight: "800" }}>{trialDaysLeft}</div>
              <div style={{ fontSize: "10px", opacity: 0.7 }}>Days Left</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
          <div className="plan-card featured" style={{ maxWidth: "460px", width: "100%" }}>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#1a1a1a", marginBottom: "4px" }}>
              {plan.name}
            </div>
            <div style={{ fontSize: "13px", color: "#616161", marginBottom: "20px", lineHeight: "1.4" }}>
              Everything you need to automate WhatsApp notifications for your store.
            </div>

            <div style={{ marginBottom: "24px" }}>
              <span style={{ fontSize: "42px", fontWeight: "800", color: "#1a1a1a" }}>${plan.price}</span>
              <span style={{ fontSize: "15px", color: "#8c9196", marginLeft: "4px" }}>/month</span>
            </div>

            <div style={{ borderTop: "1px solid #e3e3e3", paddingTop: "16px", flex: 1 }}>
              {FEATURES.map((f, i) => (
                <div key={i} className="plan-feature">
                  <div className="plan-feature-icon" style={{ background: "#e4f5e9", color: "#1a8245" }}>✓</div>
                  <span style={{ color: "#1a1a1a", fontWeight: 500 }}>{f}</span>
                </div>
              ))}
            </div>

            <button
              className="plan-btn"
              disabled={isSubmitting || isSubscribed}
              onClick={handleSubscribe}
              style={{
                background: isSubscribed ? "#f1f1f1" : "#005bd3",
                color: isSubscribed ? "#616161" : "white",
                marginTop: "24px",
              }}
            >
              {isSubscribed ? "✓ Active Plan" : isSubmitting ? "Redirecting..." : "Subscribe"}
            </button>
          </div>
        </div>

        <div style={{ background: "#e0f2fe", border: "1px solid #bae6fd", borderRadius: "12px", padding: "20px 24px", marginBottom: "32px" }}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "#0c4a6e", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>ℹ️</span>
            Important Information
          </div>
          <div style={{ color: "#0e4f71", fontSize: "13px", lineHeight: "1.8" }}>
            {[
              { bold: "App Billing:", text: "Subscription charges are billed through your Shopify account every 30 days." },
              { bold: "WhatsApp Billing:", text: "WhatsApp API message charges are billed separately by Meta from your connected Business account." },
              { bold: "Free Trial:", text: "7 days free. You must connect your own WhatsApp Business account to send messages. WhatsApp API charges will be billed by Meta even during the trial — the trial only waives the app subscription fee." },
              { bold: "Cancel Anytime:", text: "No long-term commitments. Cancel your subscription at any time." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                • <span><strong>{item.bold}</strong> {item.text}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "inline-block", marginTop: "12px", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
            💡 Total Cost: App Subscription (via Shopify) + WhatsApp API Charges (via Meta)
          </div>
        </div>

        <div style={{ background: "white", border: "1px solid #e3e3e3", borderRadius: "12px", padding: "24px 28px" }}>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "#1a1a1a", marginBottom: "16px" }}>
            Frequently Asked Questions
          </div>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? "1px solid #f1f1f1" : "none", padding: "14px 0" }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a", marginBottom: "6px" }}>{faq.q}</div>
              <div style={{ fontSize: "13px", color: "#616161", lineHeight: "1.5" }}>{faq.a}</div>
            </div>
          ))}
        </div>

        <Box paddingBlockEnd="800" />
        {toastActive && <Toast content={toastMessage} error onDismiss={() => setToastActive(false)} duration={4000} />}
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};