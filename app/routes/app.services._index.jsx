import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadServicesList, toggleServiceFromList } from "../services/serviceList.server.js";
import { Page, Toast, Frame, Badge, Button, Text, Box } from "@shopify/polaris";
import { useState, useEffect } from "react";

// ==================== LOADER ====================
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return await loadServicesList(session);
};

// ==================== ACTION ====================
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const serviceId = formData.get("serviceId");
  const actionType = formData.get("action");
  return await toggleServiceFromList(session, serviceId, actionType);
};

// ==================== CONSTANTS ====================
const SERVICE_ICONS = {
  order_confirmation_whatsapp: "✓",
  order_fulfillment: "📦",
  order_delivered: "✅",
  order_cancelled: "❌",
  order_paid: "💰",
  abandoned_checkout: "🛒",
};

// ==================== COMPONENT ====================
export default function Services() {
  const {
    services,
    activeServices,
    trialActive,
    trialDaysLeft,
    isFrozen
  } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (fetcher.data?.success) {
      setToastMessage("Service updated!");
      setToastActive(true);
    }
  }, [fetcher.data]);

  const renderServiceCard = (service) => {
    const isActive = activeServices.includes(service.id);

    return (
      <div
        key={service.id}
        style={{
          background: "#ffffff",
          border: isActive ? "2px solid #22c55e" : "1px solid #e5e7eb",
          borderRadius: "14px",
          padding: "22px",
          marginBottom: "14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: isActive ? "0 4px 20px rgba(34,197,94,0.1)" : "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: "250px" }}>
          <div
            style={{
              width: "48px", height: "48px", borderRadius: "12px",
              background: isActive ? "#dcfce7" : "#f3f4f6",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px", flexShrink: 0,
            }}
          >
            {SERVICE_ICONS[service.serviceKey] || "📌"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Text variant="bodyMd" fontWeight="bold" as="span">
                {service.name}
              </Text>
              {isActive && <Badge tone="success">Active</Badge>}
            </div>
            <Text variant="bodySm" tone="subdued" as="p">
              {service.description}
            </Text>
          </div>
        </div>
        <div>
          <Button onClick={() => navigate(`/app/services/${service.serviceKey}`)}>
            Settings
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Frame>
      <Page title="Services" subtitle="Configure WhatsApp notification services for your store.">

      {isFrozen && (
          <Box paddingBlockEnd="400">
            <div style={{
              background: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
              borderRadius: "14px", padding: "20px 24px", color: "white",
              display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px",
              border: "1px solid rgba(239,68,68,0.3)",
            }}>
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700" }}>⚠️ Your trial has ended</div>
                <div style={{ fontSize: "13px", opacity: 0.85, marginTop: "4px" }}>
                  Messages are paused. Subscribe to a plan to resume sending WhatsApp notifications.
                </div>
              </div>
              <button
                onClick={() => navigate("/app/plans")}
                style={{ padding: "10px 24px", borderRadius: "8px", border: "none", background: "#ffffff", color: "#991b1b", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}
              >
                View Plans →
              </button>
            </div>
          </Box>
        )}
        
        {trialActive && (
          <Box paddingBlockEnd="400">
            <div
              style={{
                background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
                borderRadius: "16px", padding: "28px 32px", color: "white",
                display: "flex", flexDirection: "column", gap: "20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: "800", marginBottom: "4px" }}>
                    🚀 Free Trial Active
                  </div>
                  <div style={{ fontSize: "14px", opacity: 0.8 }}>
                    Try all services free — no credit card required
                  </div>
                </div>
                <div style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", padding: "8px 22px", borderRadius: "24px", fontSize: "13px", fontWeight: "700" }}>
                  {trialDaysLeft} days remaining
                </div>
              </div>
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                {[
                  { value: trialDaysLeft, label: "Days Left" },
                  { value: activeServices.length, label: "Services Active" },
                  { value: "FREE", label: "Trial Active" },
                ].map((item, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px 24px", textAlign: "center", flex: 1, minWidth: "120px" }}>
                    <div style={{ fontSize: "26px", fontWeight: "800" }}>{item.value}</div>
                    <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "2px" }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Box>
        )}

        {services.map(renderServiceCard)}
        <Box paddingBlockEnd="800" />
        {toastActive && (
          <Toast content={toastMessage} onDismiss={() => setToastActive(false)} duration={3000} />
        )}
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};