import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { Toast, Frame, Page, Banner, Box } from "@shopify/polaris";
import { useState, useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadServiceConfig, saveServiceConfig, toggleService } from "../services/storeServiceConfig.server.js";
import "../styles/service.css";

const SERVICE_INFO = {
  order_confirmation_whatsapp: {
    name: "Order Confirmation (WhatsApp)", icon: "✓", color: "#16a34a",
    description: "Send WhatsApp confirmation message when new order is placed. Customer can confirm or cancel.",
    type: "advanced",
  },
  order_paid: {
    name: "Order Paid", icon: "💰", color: "#f59e0b",
    description: "Notify customers when their order payment is confirmed.",
    type: "template_based",
  },
  order_fulfillment: {
    name: "Order Fulfillment", icon: "📦", color: "#2563eb",
    description: "Notify customers when their order is fulfilled with shipment and tracking details.",
    type: "template_based",
  },
  order_delivered: {
    name: "Order Delivered", icon: "✅", color: "#16a34a",
    description: "Notify customers when their order has been delivered successfully.",
    type: "template_based",
  },
  order_cancelled: {
    name: "Order Cancelled", icon: "❌", color: "#dc2626",
    description: "Notify customers when their order is cancelled.",
    type: "template_based",
  },
  abandoned_checkout: {
    name: "Abandoned Checkout Recovery", icon: "🛒", color: "#ea580c",
    description: "Recover lost sales by sending WhatsApp reminders to customers who abandoned their cart.",
    type: "abandoned_cart",
  },

};



export const loader = async ({ request, params }) => {
  const {  admin, session } = await authenticate.admin(request);
  const { serviceKey } = params;
  const serviceInfo = SERVICE_INFO[serviceKey];
  if (!serviceInfo) return { error: "Service not found" };

  const data = await loadServiceConfig(session, serviceKey);
  if (data.error) return { error: data.error };

  let discountCodes = [];
  if (serviceKey === "abandoned_checkout") {
    const { getDiscountCodes } = await import("../services/discounts.server.js");
    discountCodes = await getDiscountCodes(admin);
  }


  return {
    error: null,
    serviceKey,
    serviceInfo,
    isEnabled: data.isEnabled,
    config: data.config,
    templates: data.templates,
    storeId: String(data.store.id),
    serviceId: String(data.service.id),
    discountCodes
  };
};

export const action = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const { serviceKey } = params;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "save_config") {
    return await saveServiceConfig(session, serviceKey, formData);
  }

  if (actionType === "toggle") {
    const enable = formData.get("enable") === "true";
    return await toggleService(admin, session, serviceKey, enable);
  }

  return { success: false };
};

export default function ServiceSettings() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  if (data.error) {
    return (
      <Frame>
        <Page title="Service" backAction={{ content: "Services", onAction: () => navigate("/app/services") }}>
          <Banner tone="critical"><p>{data.error}</p></Banner>
        </Page>
      </Frame>
    );
  }

  const { serviceInfo, isEnabled: initialEnabled, config, templates, discountCodes = [] } = data;
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [templateId, setTemplateId] = useState(config.templateId);
  const [paymentFilter, setPaymentFilter] = useState(config.paymentFilter);
  const [delayMinutes, setDelayMinutes] = useState(config.delayMinutes);
  const [includeImage, setIncludeImage] = useState(config.includeImage);
  const [confirmTag, setConfirmTag] = useState(config.confirmTag);
  const [cancelTag, setCancelTag] = useState(config.cancelTag);

  const [useSeparateTemplates, setUseSeparateTemplates] = useState(config.useSeparateTemplates);
  const [codTemplateId, setCodTemplateId] = useState(config.codTemplateId);
  const [prepaidTemplateId, setPrepaidTemplateId] = useState(config.prepaidTemplateId);
  const [sendConfirmResponse, setSendConfirmResponse] = useState(config.sendConfirmResponse);
  const [confirmResponseTemplateId, setConfirmResponseTemplateId] = useState(config.confirmResponseTemplateId);
  const [sendCancelResponse, setSendCancelResponse] = useState(config.sendCancelResponse);
  const [cancelResponseTemplateId, setCancelResponseTemplateId] = useState(config.cancelResponseTemplateId);
  const [cancelOrderOnShopify, setCancelOrderOnShopify] = useState(config.cancelOrderOnShopify);
  const [noResponseTagEnabled, setNoResponseTagEnabled] = useState(config.noResponseTagEnabled);
  const [noResponseTag, setNoResponseTag] = useState(config.noResponseTag);
  const [noResponseAfter, setNoResponseAfter] = useState(config.noResponseAfter);

  const [reminders, setReminders] = useState(config.reminders);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [expiryDays, setExpiryDays] = useState(config.expiryDays || 7);
  const [activeReminder, setActiveReminder] = useState("first");



  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.type === "saved") {
        setToastMessage("Settings saved successfully!");
      } else if (fetcher.data.type === "toggled") {
        setIsEnabled(fetcher.data.isEnabled);
        setToastMessage(fetcher.data.isEnabled ? "Service enabled!" : "Service disabled.");
      }
      setToastActive(true);
    }
    if (fetcher.data && !fetcher.data.success && fetcher.data.error) {
      setToastMessage(fetcher.data.error);
      setToastActive(true);
    }
  }, [fetcher.data]);

  const handleSave = () => {

    const form = new FormData();
    form.set("actionType", "save_config");
    form.set("templateId", useSeparateTemplates ? "" : templateId);

    let extraConfig = {};

    if (serviceInfo.type === "advanced") {
      extraConfig = {
        paymentFilter,
        delayMinutes,
        includeImage,
        confirmTag,
        cancelTag,
        useSeparateTemplates: paymentFilter === "all" ? useSeparateTemplates : false,
        codTemplateId: (paymentFilter === "all" && useSeparateTemplates) ? codTemplateId : "",
        prepaidTemplateId: (paymentFilter === "all" && useSeparateTemplates) ? prepaidTemplateId : "",
        sendConfirmResponse,
        confirmResponseTemplateId: sendConfirmResponse ? confirmResponseTemplateId : "",
        sendCancelResponse,
        cancelResponseTemplateId: sendCancelResponse ? cancelResponseTemplateId : "",
        cancelOrderOnShopify,
        noResponseTagEnabled,
        noResponseTag: noResponseTagEnabled ? noResponseTag : "No Response",
        noResponseAfter: noResponseTagEnabled ? noResponseAfter : "2_days",
      };
    } else if (serviceInfo.type === "abandoned_cart") {
       extraConfig = { expiryDays, reminders };
    }  else if (serviceInfo.type === "template_based") {
      extraConfig = {
        paymentFilter,
        useSeparateTemplates: paymentFilter === "all" ? useSeparateTemplates : false,
        codTemplateId: (paymentFilter === "all" && useSeparateTemplates) ? codTemplateId : "",
        prepaidTemplateId: (paymentFilter === "all" && useSeparateTemplates) ? prepaidTemplateId : "",
      }
    } 

    form.set("extraConfig", JSON.stringify(extraConfig));
    fetcher.submit(form, { method: "POST" });
  };

  const handleToggle = () => {
    const form = new FormData();
    form.set("actionType", "toggle");
    form.set("enable", (!isEnabled).toString());
    fetcher.submit(form, { method: "POST" });
  };

  const updateReminder = (key, field, value) => {
    setReminders({ ...reminders, [key]: { ...reminders[key], [field]: value } });
  };

  const isSubmitting = fetcher.state === "submitting";

  const PAYMENT_OPTIONS = [
    { value: "all", label: "All Orders", desc: "Send to every order", icon: "📋" },
    { value: "cod", label: "COD Only", desc: "Only Cash on Delivery orders", icon: "💵" },
    { value: "prepaid", label: "Prepaid Only", desc: "Only prepaid/online payment", icon: "💳" },
  ];

  const NO_RESPONSE_DELAYS = [
    { value: "1_min", label: "1 minute" },
    { value: "30_min", label: "30 minutes" },
    { value: "1_hour", label: "1 hour" },
    { value: "2_hours", label: "2 hours" },
    { value: "6_hours", label: "6 hours" },
    { value: "12_hours", label: "12 hours" },
    { value: "1_day", label: "1 day" },
    { value: "2_days", label: "2 days" },
    { value: "3_days", label: "3 days" },
    { value: "5_days", label: "5 days" },
    { value: "7_days", label: "7 days" },
  ];

  const Toggle = ({ value, onChange }) => (
    <div onClick={() => onChange(!value)} style={{ width: "44px", height: "24px", borderRadius: "12px", cursor: "pointer", background: value ? "#005bd3" : "#b5b5b5", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "white", position: "absolute", top: "2px", left: value ? "22px" : "2px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}></div>
    </div>
  );

  return (
    <Frame>
      <Page
        title={serviceInfo.name}
        backAction={{ content: "Services", onAction: () => navigate("/app/services") }}
        primaryAction={{
          content: isSubmitting ? "Saving..." : "Save Settings",
          onAction: handleSave,
          loading: isSubmitting,
          disabled: isSubmitting,
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => navigate("/app/services") }]}
      >

      {/* SERVICE HEADER */}
      <div style={{ background: "white", border: "1px solid #e3e3e3", borderRadius: "12px", padding: "20px 24px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: `${serviceInfo.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", border: `1px solid ${serviceInfo.color}30` }}>{serviceInfo.icon}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px", fontWeight: "700", color: "#1a1a1a" }}>{serviceInfo.name}</span>
              <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", background: isEnabled ? "#e4f5e9" : "#f1f1f1", color: isEnabled ? "#1a8245" : "#616161" }}>{isEnabled ? "On" : "Off"}</span>
            </div>
            <div style={{ fontSize: "13px", color: "#616161", marginTop: "3px" }}>{serviceInfo.description}</div>
          </div>
        </div>
        <button onClick={handleToggle} disabled={isSubmitting} style={{ padding: "8px 20px", borderRadius: "8px", border: "none", fontSize: "14px", fontWeight: "600", cursor: "pointer", background: isEnabled ? "#fff0f0" : "#005bd3", color: isEnabled ? "#e51c00" : "white" }}>
          {isEnabled ? "Turn off" : "Turn on"}
        </button>
      </div>

      {/* ADVANCED — ORDER CONFIRMATION (WhatsApp) */}
      {serviceInfo.type === "advanced" && (
        <>
          <div className="svc-card">
            <div className="svc-title">Message Template</div>
            <div className="svc-desc">Select which approved WhatsApp template to use when this service triggers.</div>

            {paymentFilter === "all" && (
              <div className="toggle-row" style={{ borderBottom: "1px solid #e3e3e3", paddingTop: 0 }}>
                <div>
                  <div className="toggle-row-label">Use separate templates for COD & Prepaid</div>
                  <div className="toggle-row-desc">Send different templates based on payment method.</div>
                </div>
                <Toggle value={useSeparateTemplates} onChange={setUseSeparateTemplates} />
              </div>
            )}

            {paymentFilter === "all" && useSeparateTemplates ? (
              <div style={{ marginTop: "16px" }}>
                <div style={{ marginBottom: "14px" }}>
                  <label className="svc-label">💵 COD Template</label>
                  <select className="svc-select" value={codTemplateId} onChange={(e) => setCodTemplateId(e.target.value)}>
                    <option value="">— Select COD template —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.displayName} • {t.status.charAt(0).toUpperCase() + t.status.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="svc-label">💳 Prepaid Template</label>
                  <select className="svc-select" value={prepaidTemplateId} onChange={(e) => setPrepaidTemplateId(e.target.value)}>
                    <option value="">— Select Prepaid template —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.displayName} • {t.status.charAt(0).toUpperCase() + t.status.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "16px" }}>
                <label className="svc-label">Select Template</label>
                <select className="svc-select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">— Select a template —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.displayName} • {t.status.charAt(0).toUpperCase() + t.status.slice(1)}</option>)}
                </select>
              </div>
            )}

            {templates.length === 0 && <div className="svc-hint" style={{ marginTop: "8px" }}>No templates found. <span style={{ color: "#005bd3", cursor: "pointer", fontWeight: "600" }} onClick={() => navigate("/app/templates/create")}>Create one →</span></div>}
          </div>

          <div className="svc-card">
            <div className="svc-title">Message Recipients</div>
            <div className="svc-desc">Control which orders receive messages.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {PAYMENT_OPTIONS.map(opt => (
                <div key={opt.value} className={`payment-option ${paymentFilter === opt.value ? "active" : ""}`} onClick={() => setPaymentFilter(opt.value)}>
                  <div className={`payment-radio ${paymentFilter === opt.value ? "active" : ""}`}></div>
                  <div style={{ fontSize: "20px" }}>{opt.icon}</div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>{opt.label}</div>
                    <div style={{ fontSize: "12px", color: "#616161" }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="svc-card">
            <div className="toggle-row" style={{ padding: 0 }}>
              <div>
                <div className="svc-title" style={{ marginBottom: "2px" }}>Product Images</div>
                <div style={{ fontSize: "13px", color: "#616161" }}>Include product images with messages.</div>
              </div>
              <Toggle value={includeImage} onChange={setIncludeImage} />
            </div>
          </div>

          <div className="svc-card">
            <div className="svc-title">Customer Response Settings</div>
            <div className="svc-desc">Configure what happens when a customer confirms or cancels their order.</div>

            <div className="response-card">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#e4f5e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>✅</div>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#1a8245" }}>When Customer Confirms</span>
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label className="svc-label">Shopify Order Tag</label>
                <input className="svc-input" type="text" value={confirmTag} onChange={(e) => setConfirmTag(e.target.value)} placeholder="e.g. Order Confirmed" />
                <div className="svc-hint">This tag will be added to the order when customer confirms.</div>
              </div>
              <div className="toggle-row" style={{ borderTop: "1px solid #e3e3e3", marginTop: "4px" }}>
                <div>
                  <div className="toggle-row-label">Send confirmation response</div>
                  <div className="toggle-row-desc">Send a WhatsApp response template when customer confirms.</div>
                </div>
                <Toggle value={sendConfirmResponse} onChange={setSendConfirmResponse} />
              </div>
              {sendConfirmResponse && (
                <div className="conditional-section">
                  <label className="svc-label">Response Template</label>
                  <select className="svc-select" value={confirmResponseTemplateId} onChange={(e) => setConfirmResponseTemplateId(e.target.value)}>
                    <option value="">— Select response template —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.displayName} • {t.status.charAt(0).toUpperCase() + t.status.slice(1)}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="response-card">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#fff0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>❌</div>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#e51c00" }}>When Customer Cancels</span>
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label className="svc-label">Shopify Order Tag</label>
                <input className="svc-input" type="text" value={cancelTag} onChange={(e) => setCancelTag(e.target.value)} placeholder="e.g. Order Cancelled" />
                <div className="svc-hint">This tag will be added to the order when customer cancels.</div>
              </div>
              <div className="toggle-row" style={{ borderTop: "1px solid #e3e3e3", marginTop: "4px" }}>
                <div>
                  <div className="toggle-row-label">Send cancellation response</div>
                  <div className="toggle-row-desc">Send a WhatsApp response template when customer cancels.</div>
                </div>
                <Toggle value={sendCancelResponse} onChange={setSendCancelResponse} />
              </div>
              {sendCancelResponse && (
                <div className="conditional-section">
                  <label className="svc-label">Response Template</label>
                  <select className="svc-select" value={cancelResponseTemplateId} onChange={(e) => setCancelResponseTemplateId(e.target.value)}>
                    <option value="">— Select response template —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.displayName} • {t.status.charAt(0).toUpperCase() + t.status.slice(1)}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="svc-card">
            <div className="toggle-row" style={{ padding: 0 }}>
              <div>
                <div className="svc-title" style={{ marginBottom: "2px" }}>Cancel Order on Shopify</div>
                <div style={{ fontSize: "13px", color: "#616161" }}>When a customer cancels via WhatsApp, automatically mark the order as cancelled on Shopify.</div>
              </div>
              <Toggle value={cancelOrderOnShopify} onChange={setCancelOrderOnShopify} />
            </div>
          </div>

          <div className="svc-card">
            <div className="toggle-row" style={{ padding: 0, marginBottom: noResponseTagEnabled ? "16px" : 0 }}>
              <div>
                <div className="svc-title" style={{ marginBottom: "2px" }}>No Response Tag</div>
                <div style={{ fontSize: "13px", color: "#616161" }}>Automatically add a tag to the order if customer doesn't respond within a certain time.</div>
              </div>
              <Toggle value={noResponseTagEnabled} onChange={setNoResponseTagEnabled} />
            </div>
            {noResponseTagEnabled && (
              <div className="conditional-section">
                <div className="svc-row">
                  <div>
                    <label className="svc-label">Tag Name</label>
                    <input className="svc-input" type="text" value={noResponseTag} onChange={(e) => setNoResponseTag(e.target.value)} placeholder="e.g. No Response" />
                  </div>
                  <div>
                    <label className="svc-label">No Response After</label>
                    <select className="svc-select" value={noResponseAfter} onChange={(e) => setNoResponseAfter(e.target.value)}>
                      {NO_RESPONSE_DELAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="svc-card">
            <div className="svc-title">Message Delay</div>
            <div className="svc-desc">Set how long to wait before sending the message.</div>
            <label className="svc-label">Delay Duration</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input className="svc-input" type="number" value={delayMinutes} onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)} min="0" style={{ width: "100px" }} />
              <span style={{ fontSize: "14px", color: "#616161", fontWeight: "500" }}>minutes</span>
            </div>
            <div className="svc-hint">Set to 0 to send immediately.</div>
          </div>
        </>
      )}

      {/* TEMPLATE-BASED SERVICES (Fulfillment, Delivered, Cancelled, Paid) */}
      {serviceInfo.type === "template_based" && (
        <>
          <div className="svc-card">
            <div className="svc-title">Message Template</div>
            <div className="svc-desc">Select which approved WhatsApp template to use when this service triggers.</div>

            {/* Separate templates toggle — only shown when sending to All Orders */}
            {paymentFilter === "all" && (
              <div className="toggle-row" style={{ borderBottom: "1px solid #e3e3e3", paddingTop: 0 }}>
                <div>
                  <div className="toggle-row-label">Use separate templates for COD & Prepaid</div>
                  <div className="toggle-row-desc">Send different templates based on payment method.</div>
                </div>
                <Toggle value={useSeparateTemplates} onChange={setUseSeparateTemplates} />
              </div>
            )}

            {paymentFilter === "all" && useSeparateTemplates ? (
              <div style={{ marginTop: "16px" }}>
                <div style={{ marginBottom: "14px" }}>
                  <label className="svc-label">💵 COD Template</label>
                  <select className="svc-select" value={codTemplateId} onChange={(e) => setCodTemplateId(e.target.value)}>
                    <option value="">— Select COD template —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.displayName} • {t.status.charAt(0).toUpperCase() + t.status.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="svc-label">💳 Prepaid Template</label>
                  <select className="svc-select" value={prepaidTemplateId} onChange={(e) => setPrepaidTemplateId(e.target.value)}>
                    <option value="">— Select Prepaid template —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.displayName} • {t.status.charAt(0).toUpperCase() + t.status.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: "16px" }}>
                <label className="svc-label">Select Template</label>
                <select className="svc-select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">— Select a template —</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.displayName} • {t.status.charAt(0).toUpperCase() + t.status.slice(1)}</option>)}
                </select>
              </div>
            )}

            {templates.length === 0 && <div className="svc-hint" style={{ marginTop: "8px" }}>No templates found. <span style={{ color: "#005bd3", cursor: "pointer", fontWeight: "600" }} onClick={() => navigate("/app/templates/create")}>Create one →</span></div>}
          </div>

          <div className="svc-card">
            <div className="svc-title">Message Recipients</div>
            <div className="svc-desc">Control which orders receive messages.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {PAYMENT_OPTIONS.map(opt => (
                <div key={opt.value} className={`payment-option ${paymentFilter === opt.value ? "active" : ""}`} onClick={() => setPaymentFilter(opt.value)}>
                  <div className={`payment-radio ${paymentFilter === opt.value ? "active" : ""}`}></div>
                  <div style={{ fontSize: "20px" }}>{opt.icon}</div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "600", color: "#1a1a1a" }}>{opt.label}</div>
                    <div style={{ fontSize: "12px", color: "#616161" }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ==================== ABANDONED CART RECOVERY ==================== */}
      {serviceInfo.type === "abandoned_cart" && (
        <>
          <div className="svc-card">
            <div className="svc-title">Checkout Expiry</div>
            <div className="svc-desc">Stop sending reminders for abandoned checkouts older than this many days.</div>
            <label className="svc-label">Expiry days</label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input className="svc-input" type="number" value={expiryDays} onChange={(e) => setExpiryDays(parseInt(e.target.value) || 7)} min="1" max="90" style={{ width: "100px" }} />
              <span style={{ fontSize: "14px", color: "#616161", fontWeight: "500" }}>days</span>
            </div>
            <div className="svc-hint">Checkouts older than this will be ignored. Default: 7 days.</div>
          </div>

          <div className="svc-card">
            <div className="svc-title" style={{ marginBottom: "2px" }}>Abandoned Cart Recovery</div>
            <div className="svc-desc">Recover lost sales with automated cart reminders.</div>

            <div className="tab-bar">
              {[
                { key: "first", label: "First reminder" },
                { key: "second", label: "Second reminder" },
                { key: "third", label: "Third reminder" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`tab-btn ${activeReminder === tab.key ? "active" : ""}`}
                  onClick={() => setActiveReminder(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="toggle-row" style={{ paddingTop: 0, borderBottom: "1px solid #e3e3e3" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px", fontWeight: "600" }}>
                  {activeReminder.charAt(0).toUpperCase() + activeReminder.slice(1)} reminder is
                </span>
                <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", background: reminders[activeReminder]?.enabled ? "#e4f5e9" : "#f1f1f1", color: reminders[activeReminder]?.enabled ? "#1a8245" : "#616161" }}>
                  {reminders[activeReminder]?.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <Toggle value={reminders[activeReminder]?.enabled || false} onChange={(v) => updateReminder(activeReminder, "enabled", v)} />
            </div>

            {reminders[activeReminder]?.enabled && (
              <div style={{ marginTop: "20px" }}>
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>Template Settings</div>
                  <div style={{ fontSize: "12px", color: "#616161", marginBottom: "12px" }}>Choose a template for this reminder message.</div>
                  <label className="svc-label">Template</label>
                  <select className="svc-select" value={reminders[activeReminder]?.templateId || ""} onChange={(e) => updateReminder(activeReminder, "templateId", e.target.value)}>
                    <option value="">— Select template —</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.displayName} • {t.status.charAt(0).toUpperCase() + t.status.slice(1)}</option>)}
                  </select>
                </div>

                <div className="svc-divider"></div>

                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>Timing & Content</div>
                  <div style={{ fontSize: "12px", color: "#616161", marginBottom: "12px" }}>Configure when to send this reminder and what to include.</div>

                  <div style={{ marginBottom: "14px" }}>
                    <label className="svc-label">Send this reminder</label>
                    <select className="svc-select" value={reminders[activeReminder]?.delay || "30_min"} onChange={(e) => updateReminder(activeReminder, "delay", e.target.value)}>
                      <option value="5_min">5 minutes after checkout</option>
                      <option value="15_min">15 minutes after checkout</option>
                      <option value="30_min">30 minutes after checkout</option>
                      <option value="1_hour">1 hour after checkout</option>
                      <option value="2_hours">2 hours after checkout</option>
                      <option value="6_hours">6 hours after checkout</option>
                      <option value="12_hours">12 hours after checkout</option>
                      <option value="24_hours">24 hours after checkout</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: "14px" }}>
                    <label className="svc-label">Discount code</label>
                    <select className="svc-select" value={reminders[activeReminder]?.discountCode || ""} onChange={(e) => updateReminder(activeReminder, "discountCode", e.target.value)}>
                      <option value="">— No discount —</option>
                      {discountCodes.map((d) => <option key={d.code} value={d.code}>{d.code}{d.title !== d.code ? ` — ${d.title}` : ""}</option>)}
                    </select>
                    <div className="svc-hint">
                      {discountCodes.length === 0
                        ? "No active discount codes found. Create one in Shopify → Discounts."
                        : "Add a Discount Code variable to your template to include this code in the message."}
                    </div>
                  </div>

                  <div className="toggle-row" style={{ borderTop: "1px solid #e3e3e3", marginTop: "4px", paddingBottom: 0 }}>
                    <div>
                      <div className="toggle-row-label">Include product image</div>
                      <div className="toggle-row-desc">Include the first product image from the cart in the message.</div>
                    </div>
                    <Toggle value={reminders[activeReminder]?.productImage || false} onChange={(v) => updateReminder(activeReminder, "productImage", v)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <Box paddingBlockEnd="800" />
      {toastActive && <Toast content={toastMessage} onDismiss={() => setToastActive(false)} duration={3000} />}
    </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};