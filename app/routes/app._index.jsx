import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadDashboard } from "../services/dashboardService.server.js";
import { getStore } from "../utils/helpers.server.js";
import "../styles/dashboard.css";
import { Page, Frame, Box } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const store = await getStore(session);
  return await loadDashboard(admin, store);
};

export default function Dashboard() {
  const {
    shop, isTrial, trialDaysLeft, isFrozen, whatsappConnected, billingStatus, activeServices,
  } = useLoaderData();
  const navigate = useNavigate();

  return (
    <Frame>
      <Page title="Dashboard">
        {/* HERO BANNER */}
        <div
          className="hero-banner"
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f4c3a 100%)",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "24px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,0.03)" }}></div>
          <div style={{ position: "absolute", bottom: "-60px", right: "100px", width: "150px", height: "150px", borderRadius: "50%", background: "rgba(255,255,255,0.02)" }}></div>

          <div style={{ flex: 1, minWidth: "280px", position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: "22px", fontWeight: "800", marginBottom: "6px" }}>
              Automate WhatsApp notifications for your Shopify store
            </div>
            <div style={{ fontSize: "13px", opacity: 0.7, marginBottom: "24px" }}>
              Keep customers updated at every step — order confirmations, fulfillment, delivery and more, sent straight to WhatsApp.
            </div>

            <div className="hero-feature">
              <div className="hero-feature-icon" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>✉️</div>
              <div>
                <div className="hero-feature-title">Branded Messages</div>
                <div className="hero-feature-desc">Connect your WhatsApp Business account and message customers using your own brand name.</div>
              </div>
            </div>
            <div className="hero-feature">
              <div className="hero-feature-icon" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}>⚡</div>
              <div>
                <div className="hero-feature-title">Enable Automation</div>
                <div className="hero-feature-desc">Automatically send order confirmation, fulfillment and delivery updates — no manual work.</div>
              </div>
            </div>
            <div className="hero-feature">
              <div className="hero-feature-icon" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>📊</div>
              <div>
                <div className="hero-feature-title">Track & Analyze</div>
                <div className="hero-feature-desc">Monitor delivery, track customer responses and measure performance in real time.</div>
              </div>
            </div>

            {!whatsappConnected && (
              <button
                onClick={() => navigate("/app/settings")}
                style={{ marginTop: "16px", padding: "12px 28px", borderRadius: "10px", border: "none", background: "#22c55e", color: "white", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}
              >
                Get Started →
              </button>
            )}
          </div>

          {whatsappConnected && (
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ background: "rgba(34,197,94,0.15)", borderRadius: "12px", padding: "14px 24px", textAlign: "center" }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse 2s infinite" }}></span>
                  WhatsApp Connected
                </div>
              </div>
            </div>
          )}
        </div>

        {/* WELCOME */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#1a1a1a" }}>
            Welcome back, {shop.name}! 👋
          </div>
          <div style={{ fontSize: "14px", color: "#616161", marginTop: "4px" }}>
            Here's how your WhatsApp notifications are performing.
          </div>
        </div>

        {/* TRIAL BANNER */}
        {isTrial && (
          <div style={{
            background: "linear-gradient(135deg, #1e3a5f 0%, #1a4a7a 100%)",
            borderRadius: "14px", padding: "20px 24px", color: "white", marginBottom: "20px",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px",
            border: "1px solid rgba(59,130,246,0.2)",
          }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700" }}>🚀 Free Trial Active</div>
              <div style={{ fontSize: "13px", opacity: 0.8, marginTop: "4px" }}>Try all services free — no credit card required</div>
            </div>
            <div style={{ display: "flex", gap: "20px" }}>
              {[
                { value: trialDaysLeft, label: "Days Left" },
                { value: activeServices, label: "Services Active" },
                { value: "FREE", label: "Trial Active" },
              ].map((item, i) => (
                <div key={i} style={{ textAlign: "center", background: "rgba(255,255,255,0.08)", borderRadius: "10px", padding: "12px 16px", minWidth: "70px" }}>
                  <div style={{ fontSize: "20px", fontWeight: "800" }}>{item.value}</div>
                  <div style={{ fontSize: "10px", opacity: 0.7, marginTop: "2px" }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FROZEN BANNER */}
        {isFrozen && (
          <div style={{
            background: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
            borderRadius: "14px", padding: "20px 24px", color: "white", marginBottom: "20px",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px",
            border: "1px solid rgba(239,68,68,0.3)",
          }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "700" }}>⚠️ Your trial has ended</div>
              <div style={{ fontSize: "13px", opacity: 0.85, marginTop: "4px" }}>
                Message sending is paused. Your services and settings are safe — subscribe to resume immediately.
              </div>
            </div>
            <button
              onClick={() => navigate("/app/plans")}
              style={{ padding: "10px 24px", borderRadius: "8px", border: "none", background: "#ffffff", color: "#991b1b", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}
            >
              View Plans →
            </button>
          </div>
        )}

        {/* STORE INFORMATION */}
        <div className="dash-card" style={{ marginBottom: "20px", padding: "16px 20px" }}>
          <div style={{ fontSize: "15px", fontWeight: "700", color: "#1a1a1a", marginBottom: "12px" }}>Store Information</div>
          <div className="store-info-row">
            {[
              { label: "Store", value: shop.name },
              { label: "Domain", value: shop.myshopifyDomain },
              { label: "Email", value: shop.email },
              { label: "Plan", value: shop.plan.displayName },
              { label: "Currency", value: shop.currencyCode },
              { label: "Billing", value: billingStatus.charAt(0).toUpperCase() + billingStatus.slice(1) },
            ].map((item, i) => (
              <div key={i} className="store-info-cell">
                <div className="store-info-label">{item.label}</div>
                <div className="store-info-value" title={item.value}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* IMPORTANT INFORMATION */}
        <div className="info-box" style={{ background: "#e0f2fe", border: "1px solid #bae6fd" }}>
          <div className="info-box-title" style={{ color: "#0c4a6e" }}>
            <span style={{ fontSize: "18px" }}>ℹ️</span>
            Important Information
          </div>
          <div style={{ color: "#0e4f71" }}>
            {[
              { bold: "App Billing:", text: "Subscription charges are billed through your Shopify account every 30 days." },
              { bold: "WhatsApp Billing:", text: "WhatsApp API message charges are billed separately by Meta from your connected Business account." },
              { bold: "Free Trial:", text: "All plans include a 7-day free trial with 10 messages. You must connect your own WhatsApp Business account to send messages. WhatsApp API charges will be billed by Meta to your Business account even during the trial — the trial only waives the app subscription fee." },
              { bold: "Upgrade/Downgrade:", text: "You can change your plan anytime. Changes take effect immediately." },
              { bold: "Cancel Anytime:", text: "No long-term commitments. Cancel your subscription at any time." },
            ].map((item, i) => (
              <div key={i} className="info-item">
                <span><strong>{item.bold}</strong> {item.text}</span>
              </div>
            ))}
          </div>
          <div className="info-highlight" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
            💡 Total Cost: App Charges (via Shopify) + WhatsApp API Charges (via Meta)
          </div>
        </div>

        <Box paddingBlockEnd="800" />
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};