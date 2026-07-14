import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadTemplate } from "../services/templateService.server.js";
import {
  Page, Card, TextField, Select, Button, Banner, Toast, Frame,
  BlockStack, InlineStack, Text, Box, Divider, ButtonGroup, Popover,
  ActionList, InlineGrid, Badge, DropZone, Thumbnail,
} from "@shopify/polaris";

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const { updateTemplate } = await import("../services/templateService.server.js");
  return await updateTemplate(session, params.id, formData);
};

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  return await loadTemplate(session, params.id);
};

const VARIABLE_FIELDS = [
    { key: "customer_name", label: "Customer Name", sample: "John Doe", icon: "👤" },
    { key: "order_number", label: "Order Number", sample: "#1234", icon: "🔢" },
    { key: "total_amount", label: "Total Amount", sample: "PKR 1500", icon: "💰" },
    { key: "shop_name", label: "Shop Name", sample: "My Store", icon: "🏪" },
    { key: "product_names", label: "Product Names", sample: "Shirt x1", icon: "📦" },
    { key: "customer_address", label: "Customer Address", sample: "123 Main St", icon: "📍" },
    { key: "city", label: "City", sample: "Karachi", icon: "🏙️" },
    { key: "payment_method", label: "Payment Method", sample: "COD", icon: "💳" },
    { key: "order_date", label: "Order Date", sample: "May 25, 2026", icon: "📅" },
    { key: "order_id", label: "Order ID", sample: "123456789", icon: "🆔" },
    { key: "customer_phone", label: "Customer Phone", sample: "03001234567", icon: "📱" },
    { key: "product_quantities", label: "Product Quantities", sample: "1, 2", icon: "🔢" },
    { key: "product_prices", label: "Product Prices", sample: "PKR 500", icon: "🏷️" },
    { key: "delivery_charge", label: "Delivery Charge", sample: "PKR 200", icon: "🚚" },
    { key: "payment_status", label: "Payment Status", sample: "paid", icon: "✅" },
    { key: "tracking_number", label: "Tracking Number", sample: "TCS123456", icon: "📋" },
    { key: "tracking_url", label: "Tracking URL", sample: "https://track.example.com", icon: "🔗" },
    { key: "tracking_company", label: "Tracking Company", sample: "TCS", icon: "🚚" },
    { key: "checkout_url", label: "Checkout URL", sample: "https://checkout.example.com", icon: "🛒" },
    { key: "fulfillment_name", label: "Fulfillment Name", sample: "EU44639.1", icon: "📋" },
    { key: "fulfillment_items", label: "Fulfillment Items", sample: "Shirt x1, Pants x2", icon: "📦" },
    { key: "fulfillment_prices", label: "Fulfillment Prices", sample: "PKR 500, PKR 1000", icon: "🏷️" },
    { key: "fulfillment_total", label: "Fulfillment Total", sample: "PKR 749.95", icon: "💰" },
    { key: "discount_code", label: "Discount Code", sample: "SAVE20", icon: "🎟️" },
  ];
  
const LANGUAGES = [
  { value: "en", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "ur", label: "Urdu" },
  { value: "ar", label: "Arabic" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "hi", label: "Hindi" },
];

const STATUS_TONE = { approved: "success", pending: "attention", rejected: "critical", draft: undefined };

export default function TemplateEdit() {
  const data = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const bodyRef = useRef(null);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const showToast = (message, error = false) => {
    setToastMessage(message);
    setToastError(error);
    setToastActive(true);
  };

  if (data.error) {
    return (
      <Frame>
        <Page title="Template" backAction={{ content: "Templates", onAction: () => navigate("/app/templates") }}>
          <Banner tone="critical"><p>{data.error}</p></Banner>
        </Page>
      </Frame>
    );
  }

  const { template, shopName } = data;
  const isEditable = template.status === "draft";

  const [displayName, setDisplayName] = useState(template.displayName);
  const [type, setType] = useState(template.type);
  const [language, setLanguage] = useState(template.language);
  const [headerType, setHeaderType] = useState(template.headerType);
  const [headerText, setHeaderText] = useState(template.headerText);
  const [headerMediaUrl, setHeaderMediaUrl] = useState(template.headerMediaUrl);
  const [headerMediaPreview, setHeaderMediaPreview] = useState(template.headerMediaUrl || "");
  const [headerFileName, setHeaderFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [body, setBody] = useState(template.body);
  const [footer, setFooter] = useState(template.footer);
  const [buttons, setButtons] = useState(Array.isArray(template.buttons) ? template.buttons : []);
  const [variablesMap, setVariablesMap] = useState(
    typeof template.variablesMap === "object" && template.variablesMap ? template.variablesMap : {}
  );
  const [showButtonMenu, setShowButtonMenu] = useState(false);

  const handleDropZoneDrop = useCallback(async (_dropFiles, acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setHeaderFileName(file.name);
    setHeaderMediaPreview(URL.createObjectURL(file));
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json();

      if (result.success && result.url) {
        setHeaderMediaUrl(result.url);
        setHeaderMediaPreview(result.url);
        showToast("File uploaded successfully!");
      } else {
        showToast(result.error || "Upload failed.", true);
      }
    } catch (error) {
      console.warn("Upload error:", error);
      showToast("Upload failed.", true);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const removeMedia = () => {
    setHeaderMediaUrl("");
    setHeaderMediaPreview("");
    setHeaderFileName("");
  };

  const getAcceptType = () => {
    if (headerType === "image") return "image/jpeg,image/png,image/webp";
    if (headerType === "video") return "video/mp4,video/3gpp";
    if (headerType === "document") return "application/pdf";
    return "*/*";
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.metaError) {
        showToast(`Saved as draft. Meta error: ${fetcher.data.metaError}`, true);
      } else if (fetcher.data.type === "updated") {
        showToast("Template saved!");
      } else if (fetcher.data.type === "submitted") {
        showToast("Template submitted to Meta!");
        setTimeout(() => navigate("/app/templates"), 1500);
      }
    }
    if (fetcher.data?.error) showToast(fetcher.data.error, true);
  }, [fetcher.data]);

  const handleSubmit = (actionType) => {
    const form = new FormData();
    form.set("actionType", actionType);
    form.set("displayName", displayName);
    form.set("type", type);
    form.set("language", language);
    form.set("headerType", headerType);
    form.set("headerText", headerText);
    form.set("headerMediaUrl", headerMediaUrl);
    form.set("body", body);
    form.set("footer", footer);
    if (buttons.length > 0) form.set("buttons", JSON.stringify(buttons));
    if (Object.keys(variablesMap).length > 0) form.set("variablesMap", JSON.stringify(variablesMap));
    fetcher.submit(form, { method: "POST" });
  };

  const extractVariables = (text) => {
    const regex = /\{\{(\d+)\}\}/g;
    const vars = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!vars.includes(match[1])) vars.push(match[1]);
    }
    return vars.sort((a, b) => parseInt(a) - parseInt(b));
  };

  const detectedVars = extractVariables(body);

  useEffect(() => {
    const currentMap = { ...variablesMap };
    let changed = false;
    for (const key of Object.keys(currentMap)) {
      if (!detectedVars.includes(key)) {
        delete currentMap[key];
        changed = true;
      }
    }
    if (changed) setVariablesMap(currentMap);
  }, [body]);


const insertVariableField = (fieldKey) => {
    const alreadyUsed = Object.values(variablesMap).includes(fieldKey);
    if (alreadyUsed) {
      showToast("This variable is already in use", true);
      return;
    }
    const nextVar = detectedVars.length > 0 ? Math.max(...detectedVars.map(Number)) + 1 : 1;
    const textarea = bodyRef.current?.querySelector("textarea");
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const varText = `{{${nextVar}}}`;
      const newBody = body.substring(0, start) + varText + body.substring(end);
      setBody(newBody);
      setVariablesMap((prev) => ({ ...prev, [String(nextVar)]: fieldKey }));
      setTimeout(() => {
        textarea.focus();
        const newPos = start + varText.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      const varText = `{{${nextVar}}}`;
      setBody(body + varText);
      setVariablesMap((prev) => ({ ...prev, [String(nextVar)]: fieldKey }));
    }
  };

  const getFieldByKey = (key) => VARIABLE_FIELDS.find((f) => f.key === key);
  const isFieldUsed = (fieldKey) => Object.values(variablesMap).includes(fieldKey);

  const formatText = (format) => {
    const textarea = bodyRef.current?.querySelector("textarea");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.substring(start, end);
    let formatted = "";
    if (format === "bold") formatted = `*${selected || "text"}*`;
    else if (format === "italic") formatted = `_${selected || "text"}_`;
    else if (format === "strike") formatted = `~${selected || "text"}~`;
    setBody(body.substring(0, start) + formatted + body.substring(end));
  };

  const addButton = (buttonType) => {
    setShowButtonMenu(false);
    if (buttonType === "quick_reply") setButtons([...buttons, { type: "QUICK_REPLY", text: "" }]);
    else if (buttonType === "visit_website") setButtons([...buttons, { type: "URL", text: "Visit website", urlType: "static", url: "" }]);
    else if (buttonType === "call_phone") setButtons([...buttons, { type: "PHONE_NUMBER", text: "Call phone number", countryCode: "+92", phoneNumber: "" }]);
    else if (buttonType === "copy_offer") setButtons([...buttons, { type: "COPY_CODE", text: "Copy offer code", offerCode: "" }]);
  };

  const updateButton = (i, field, value) => {
    const u = [...buttons];
    u[i] = { ...u[i], [field]: value };
    setButtons(u);
  };

  const removeButton = (i) => setButtons(buttons.filter((_, idx) => idx !== i));

  const getPreviewText = (text) => {
    let preview = text || "";
    detectedVars.forEach((v) => {
      const fieldKey = variablesMap[v];
      const field = fieldKey ? getFieldByKey(fieldKey) : null;
      const sample = field ? field.sample : `{{${v}}}`;
      preview = preview.replace(new RegExp(`\\{\\{${v}\\}\\}`, "g"), sample);
    });
    return preview;
  };

  const primaryAction = isEditable ? {
    content: "Submit to Meta",
    onAction: () => handleSubmit("submit"),
    loading: fetcher.state === "submitting",
  } : undefined;
  const secondaryActions = isEditable ? [{ content: "Save Draft", onAction: () => handleSubmit("draft") }] : [];

  return (
    <Frame>
      <Page
        title={template.displayName}
        titleMetadata={
          <Badge tone={STATUS_TONE[template.status]}>
            {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
          </Badge>
        }
        backAction={{ content: "Templates", onAction: () => navigate("/app/templates") }}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      >
        {template.status === "rejected" && template.rejectionReason && (
          <Box paddingBlockEnd="400">
            <Banner tone="critical" title="Template Rejected"><p>{template.rejectionReason}</p></Banner>
          </Box>
        )}
        {!isEditable && template.status !== "draft" && (
          <Box paddingBlockEnd="400">
            <Banner tone="info">
              <p>This template is <strong>{template.status}</strong> and cannot be edited. Duplicate it from the templates list to make changes.</p>
            </Banner>
          </Box>
        )}

        <InlineGrid columns={{ xs: 1, md: ["twoThirds", "oneThird"] }} gap="400">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h2">Template info</Text>
                <TextField label="Template name" value={displayName} onChange={setDisplayName} disabled={!isEditable} helpText={`API name: ${template.name}`} autoComplete="off" />
                <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
                  <Select label="Type" options={[{ value: "utility", label: "Utility" }, { value: "marketing", label: "Marketing" }]} value={type} onChange={setType} disabled={!isEditable} />
                  <Select label="Language" options={LANGUAGES} value={language} onChange={setLanguage} disabled={!isEditable} />
                </InlineGrid>
                <InlineStack gap="400" wrap>
                  <Text variant="bodySm" tone="subdued">Created: {template.createdAt}</Text>
                  <Text variant="bodySm" tone="subdued">Updated: {template.updatedAt}</Text>
                  {template.metaTemplateId && <Text variant="bodySm" tone="subdued">Meta ID: {template.metaTemplateId}</Text>}
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h2">Message content</Text>
                <Select label="Header" options={[{ value: "none", label: "None" }, { value: "text", label: "Text" }, { value: "image", label: "Image" }, { value: "video", label: "Video" }, { value: "document", label: "Document" }]} value={headerType} onChange={setHeaderType} disabled={!isEditable} />

                {headerType === "text" && (
                  <TextField label="Header text" value={headerText} onChange={setHeaderText} disabled={!isEditable} placeholder="Header text" maxLength={60} showCharacterCount autoComplete="off" />
                )}

                {isEditable && (headerType === "image" || headerType === "video" || headerType === "document") && (
                  <BlockStack gap="200">
                    <Text variant="bodySm" fontWeight="semibold">Media sample</Text>
                    {!headerFileName && !headerMediaUrl ? (
                      <DropZone accept={getAcceptType()} type="file" onDrop={handleDropZoneDrop}>
                        <DropZone.FileUpload actionHint={`Upload ${headerType}`} />
                      </DropZone>
                    ) : (
                      <Card>
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="300" blockAlign="center">
                            {headerType === "image" && headerMediaPreview ? (<Thumbnail source={headerMediaPreview} alt="Header" size="small" />) : (<Text variant="bodySm">{headerType === "video" ? "🎬" : "📄"}</Text>)}
                            <BlockStack gap="050">
                              <Text variant="bodySm" fontWeight="semibold">{headerFileName || "Current media"}</Text>
                              {isUploading && <Text variant="bodySm" tone="subdued">Uploading...</Text>}
                              {!isUploading && headerMediaUrl && <Text variant="bodySm" tone="success">Uploaded</Text>}
                            </BlockStack>
                          </InlineStack>
                          <Button variant="plain" tone="critical" onClick={removeMedia}>Change</Button>
                        </InlineStack>
                      </Card>
                    )}
                  </BlockStack>
                )}

                {!isEditable && (headerType === "image" || headerType === "video" || headerType === "document") && headerMediaUrl && (
                  <BlockStack gap="200">
                    <Text variant="bodySm" fontWeight="semibold">Media</Text>
                    <Card>
                      <InlineStack gap="300" blockAlign="center">
                        {headerType === "image" ? (<Thumbnail source={headerMediaUrl} alt="Header" size="small" />) : (<Text variant="bodySm">{headerType === "video" ? "🎬 Video" : "📄 Document"}</Text>)}
                        <Text variant="bodySm" tone="subdued">Media attached</Text>
                      </InlineStack>
                    </Card>
                  </BlockStack>
                )}

                <Divider />

                {isEditable && (
                  <>
                    <InlineStack gap="200" align="end">
                      <ButtonGroup>
                        <Button size="slim" variant="tertiary" onClick={() => formatText("bold")}><Text fontWeight="bold" as="span">B</Text></Button>
                        <Button size="slim" variant="tertiary" onClick={() => formatText("italic")}><Text as="span"><em>I</em></Text></Button>
                        <Button size="slim" variant="tertiary" onClick={() => formatText("strike")}><Text as="span"><s>S</s></Text></Button>
                      </ButtonGroup>
                    </InlineStack>
                    <Card background="bg-surface-secondary">
                      <BlockStack gap="300">
                        <Text variant="headingSm" as="h3">Insert Variables</Text>
                        <Text variant="bodySm" tone="subdued">Click a variable to insert it into your message body. Variables are numbered automatically.</Text>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                          {VARIABLE_FIELDS.map((field) => {
                            const used = isFieldUsed(field.key);
                            const usedPosition = Object.entries(variablesMap).find(([, v]) => v === field.key)?.[0];
                            return (
                              <button
                                key={field.key}
                                onClick={() => !used && insertVariableField(field.key)}
                                style={{
                                  display: "flex", alignItems: "center", gap: "6px",
                                  padding: "6px 12px", borderRadius: "20px", border: "1px solid",
                                  borderColor: used ? "#bbf7d0" : "#e3e3e3",
                                  background: used ? "#f0fdf4" : "#ffffff",
                                  color: used ? "#166534" : "#303030",
                                  fontSize: "12px", fontWeight: "500",
                                  cursor: used ? "default" : "pointer", opacity: used ? 0.8 : 1,
                                }}
                              >
                                <span>{field.icon}</span>
                                <span>{field.label}</span>
                                {used && <span style={{ background: "#166534", color: "white", fontSize: "10px", padding: "0 5px", borderRadius: "8px", fontWeight: "700" }}>{`{{${usedPosition}}}`}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </BlockStack>
                    </Card>
                  </>
                )}

                <div ref={bodyRef}>
                    <TextField label="Body" value={body} onChange={setBody} disabled={!isEditable} multiline={4} maxLength={1024} showCharacterCount autoComplete="off" />
                </div>

                {detectedVars.length > 0 && (
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h3">Variable Mapping</Text>
                      <Text variant="bodySm" tone="subdued">Each variable is mapped to a data field. Sample values are shown for Meta review.</Text>
                      {detectedVars.map((v) => {
                        const fieldKey = variablesMap[v];
                        const field = fieldKey ? getFieldByKey(fieldKey) : null;
                        return (
                          <div key={v} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: "1px solid #f1f1f1" }}>
                            <Badge>{`{{${v}}}`}</Badge>
                            {field ? (
                              <>
                                <span style={{ fontSize: "13px", fontWeight: "600", color: "#1a1a1a" }}>{field.icon} {field.label}</span>
                                <span style={{ fontSize: "12px", color: "#616161", marginLeft: "auto" }}>Sample: {field.sample}</span>
                              </>
                            ) : (
                              <span style={{ fontSize: "13px", color: "#b91c1c" }}>⚠️ Not mapped — click a variable above to assign</span>
                            )}
                          </div>
                        );
                      })}
                    </BlockStack>
                  </Card>
                )}
                <Divider />
                <TextField label="Footer (optional)" value={footer} onChange={setFooter} disabled={!isEditable} placeholder="Optional footer" maxLength={60} showCharacterCount autoComplete="off" />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingSm" as="h2">Buttons</Text>
                {buttons.map((btn, i) => (
                  <Card key={i}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Badge>{btn.type === "QUICK_REPLY" ? "Quick Reply" : btn.type === "URL" ? "URL" : btn.type === "PHONE_NUMBER" ? "Phone" : "Copy Code"}</Badge>
                        {isEditable && <Button variant="plain" tone="critical" onClick={() => removeButton(i)}>Remove</Button>}
                      </InlineStack>
                      <TextField label="Button text" value={btn.text} onChange={(val) => updateButton(i, "text", val)} disabled={!isEditable} maxLength={25} showCharacterCount autoComplete="off" />
                      {btn.type === "URL" && (
                        <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
                          <Select label="URL type" options={[{ value: "static", label: "Static" }, { value: "dynamic", label: "Dynamic" }]} value={btn.urlType || "static"} onChange={(val) => updateButton(i, "urlType", val)} disabled={!isEditable} />
                          <TextField label="Website URL" value={btn.url || ""} onChange={(val) => updateButton(i, "url", val)} disabled={!isEditable} placeholder="https://..." autoComplete="off" />
                        </InlineGrid>
                      )}
                      {btn.type === "PHONE_NUMBER" && (
                        <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
                          <Select label="Country" options={[{ value: "+92", label: "Pakistan +92" }, { value: "+1", label: "US +1" }, { value: "+44", label: "UK +44" }]} value={btn.countryCode || "+92"} onChange={(val) => updateButton(i, "countryCode", val)} disabled={!isEditable} />
                          <TextField label="Phone number" value={btn.phoneNumber || ""} onChange={(val) => updateButton(i, "phoneNumber", val)} disabled={!isEditable} placeholder="3001234567" autoComplete="off" />
                        </InlineGrid>
                      )}
                      {btn.type === "QUICK_REPLY" && (
                        <Select label="Button action" options={[{ value: "none", label: "None" }, { value: "confirm", label: "Confirm Order" }, { value: "cancel", label: "Cancel Order" }]} value={btn.action || "none"} onChange={(val) => updateButton(i, "action", val)} disabled />
                      )}
                      {btn.type === "COPY_CODE" && (
                        <TextField label="Offer code" value={btn.offerCode || ""} onChange={(val) => updateButton(i, "offerCode", val)} disabled={!isEditable} placeholder="e.g. SAVE20" autoComplete="off" />
                      )}
                    </BlockStack>
                  </Card>
                ))}
                {isEditable && (
                  <Popover active={showButtonMenu} activator={<Button onClick={() => setShowButtonMenu(!showButtonMenu)}>+ Add button</Button>} onClose={() => setShowButtonMenu(false)}>
                    <ActionList sections={[
                      { title: "Quick reply", items: [{ content: "Custom reply", onAction: () => addButton("quick_reply") }] },
                      { title: "Call to action", items: [
                        { content: "Visit website", onAction: () => addButton("visit_website") },
                        { content: "Call phone number", onAction: () => addButton("call_phone") },
                        { content: "Copy offer code", onAction: () => addButton("copy_offer") },
                      ]},
                    ]} />
                  </Popover>
                )}
                {buttons.length === 0 && !isEditable && <Text variant="bodySm" tone="subdued">No buttons configured.</Text>}
              </BlockStack>
            </Card>
          </BlockStack>

          <div style={{ position: "sticky", top: "60px" }}>
            <Card padding="0">
              <div style={{ background: "#075e54", color: "white", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: "700" }}>
                  {(shopName || "S").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "600" }}>{shopName}</div>
                  <div style={{ fontSize: "11px", opacity: 0.8 }}>Business Account</div>
                </div>
              </div>

              <div style={{ background: "#e5ddd5", padding: "20px 14px", minHeight: "380px" }}>
                <div style={{ maxWidth: "280px" }}>
                  <div style={{ background: "white", borderRadius: "0 8px 8px 8px", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
                    {headerType === "image" && headerMediaUrl && (<img src={headerMediaUrl} alt="Header" style={{ width: "100%", height: "140px", objectFit: "cover", display: "block" }} />)}
                    {headerType === "image" && !headerMediaUrl && (<div style={{ background: "#e5e7eb", height: "140px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>🖼️</div>)}
                    {headerType === "video" && (<div style={{ background: "#1a1a1a", height: "140px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "white" }}>▶️</div>)}
                    {headerType === "document" && (<div style={{ background: "#f3f4f6", height: "50px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: "#616161" }}>📄 Document</div>)}

                    <div style={{ padding: "8px 10px" }}>
                      {headerType === "text" && headerText && (<div style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a1a", marginBottom: "4px" }}>{getPreviewText(headerText)}</div>)}
                      <div style={{ fontSize: "13px", color: "#303030", lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {getPreviewText(body) || "Message preview..."}
                      </div>
                      {footer && (<div style={{ fontSize: "12px", color: "#8696a0", marginTop: "4px" }}>{footer}</div>)}
                      <div style={{ fontSize: "11px", color: "#8696a0", textAlign: "right", marginTop: "4px" }}>
                        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>

                  {buttons.length > 0 && buttons.map((btn, i) => (
                    <div key={i} style={{ background: "white", textAlign: "center", padding: "8px", fontSize: "13px", color: "#00a5f4", fontWeight: "500", borderTop: "1px solid #f0f0f0", marginTop: i === 0 ? "2px" : "0", borderRadius: i === buttons.length - 1 ? "0 0 8px 8px" : "0", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      {btn.type === "URL" && "🔗"}{btn.type === "PHONE_NUMBER" && "📞"}{btn.type === "QUICK_REPLY" && "↩️"}{btn.type === "COPY_CODE" && "📋"}
                      {btn.text || `Button ${i + 1}`}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </InlineGrid>

        <Box paddingBlockEnd="800" />
        {toastActive && (<Toast content={toastMessage} error={toastError} onDismiss={() => setToastActive(false)} duration={3000} />)}
      </Page>
    </Frame>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};