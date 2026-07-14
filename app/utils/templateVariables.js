// ==================== DYNAMIC TEMPLATE VARIABLES ====================

export const VARIABLE_FIELDS = [
    { key: "customer_name", label: "Customer Name", sample: "John Doe" },
    { key: "order_number", label: "Order Number", sample: "#1234" },
    { key: "total_amount", label: "Total Amount", sample: "PKR 1500" },
    { key: "shop_name", label: "Shop Name", sample: "My Store" },
    { key: "product_names", label: "Product Names", sample: "Shirt x1" },
    { key: "customer_address", label: "Customer Address", sample: "123 Main St" },
    { key: "city", label: "City", sample: "Karachi" },
    { key: "payment_method", label: "Payment Method", sample: "COD" },
    { key: "order_date", label: "Order Date", sample: "May 25, 2026" },
    { key: "order_id", label: "Order ID", sample: "123456789" },
    { key: "customer_phone", label: "Customer Phone", sample: "03001234567" },
    { key: "product_quantities", label: "Product Quantities", sample: "1, 2" },
    { key: "product_prices", label: "Product Prices", sample: "PKR 500" },
    { key: "delivery_charge", label: "Delivery Charge", sample: "PKR 200" },
    { key: "payment_status", label: "Payment Status", sample: "paid" },
    { key: "tracking_number", label: "Tracking Number", sample: "TCS123456" },
    { key: "tracking_url", label: "Tracking URL", sample: "https://track.example.com" },
    { key: "tracking_company", label: "Tracking Company", sample: "TCS" },
    { key: "checkout_url", label: "Abandoned Checkout URL", sample: "https://checkout.example.com" },
    { key: "fulfillment_name", label: "Fulfillment Name", sample: "EU44639.1" },
    { key: "fulfillment_items", label: "Fulfillment Items", sample: "Shirt x1, Pants x2" },
    { key: "fulfillment_prices", label: "Fulfillment Prices", sample: "PKR 500, PKR 1000" },
    { key: "fulfillment_total", label: "Fulfillment Total", sample: "PKR 749.95" },
    { key: "discount_code", label: "Discount Code", sample: "SAVE20" },
  ];
  
  // Map field keys to order data
  export function getOrderFieldValue(key, order, store, fulfillment = null) {
    const lineItems = order?.line_items || [];
    const fulfillments = order?.fulfillments || [];
    const latestFulfillment = fulfillments[fulfillments.length - 1] || {};
  
    const fieldMap = {
      customer_name: `${order?.billing_address?.first_name || order?.customer?.first_name || ""} ${order?.billing_address?.last_name || order?.customer?.last_name || ""}`.trim(),
      order_number: order?.name || order?.order_number || "",
      total_amount: `${order?.currency || store?.currency || "PKR"} ${order?.total_price || "0.00"}`,
      shop_name: store?.shopName || store?.shopDomain || "",
      product_names: lineItems.map(item => `${item.name || item.title} x${item.quantity}`).join(", "),
      customer_address: order?.shipping_address?.address1 || order?.billing_address?.address1 || "",
      city: order?.shipping_address?.city || order?.billing_address?.city || "",
      payment_method: order?.payment_gateway_names?.[0] || "N/A",
      order_date: order?.created_at ? new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "",
      order_id: String(order?.id || ""),
      customer_phone: order?.billing_address?.phone || order?.shipping_address?.phone || order?.customer?.phone || "",
      product_quantities: lineItems.map(item => String(item.quantity)).join(", "),
      product_prices: lineItems.map(item => `${order?.currency || "PKR"} ${item.price}`).join(", "),
      delivery_charge: `${order?.currency || "PKR"} ${order?.total_shipping_price_set?.shop_money?.amount || order?.shipping_lines?.[0]?.price || "0.00"}`,
      payment_status: order?.financial_status || "N/A",
      tracking_number: latestFulfillment.tracking_number || "N/A",
      tracking_url: latestFulfillment.tracking_url || "",
      tracking_company: latestFulfillment.tracking_company || "N/A",
      checkout_url: order?.abandoned_checkout_url || order?.order_status_url || "",
      discount_code: order?.discount_code || "",
      fulfillment_name: fulfillment?.name || (() => {
        const fulfillments = order?.fulfillments || [];
        return fulfillments.map(f => f.name).join(", ");
      })(),
      fulfillment_items: (() => {
        const f = fulfillment || (order?.fulfillments || []).slice(-1)[0] || {};
        return (f.line_items || []).map(item => `${item.name || item.title} x${item.quantity}`).join(", ");
      })(),
      fulfillment_prices: (() => {
        const f = fulfillment || (order?.fulfillments || []).slice(-1)[0] || {};
        const currency = order?.currency || store?.currency || "PKR";
        return (f.line_items || []).map(item => `${currency} ${item.price}`).join(", ");
      })(),
      fulfillment_total: (() => {
        const f = fulfillment || (order?.fulfillments || []).slice(-1)[0] || {};
        const currency = order?.currency || store?.currency || "PKR";
        const total = (f.line_items || []).reduce((sum, item) => sum + (parseFloat(item.price) || 0) * (item.quantity || 1), 0);
        return `${currency} ${total.toFixed(2)}`;
      })(),
    };
  
    return fieldMap[key] || "";
  }
  
  // Resolve template variables using variablesMap + order data
  export function resolveTemplateVariables(template, order, store, fulfillment = null) {
    const variablesMap = typeof template.variablesMap === "string" 
      ? JSON.parse(template.variablesMap) 
      : template.variablesMap;
  
    if (!variablesMap || Object.keys(variablesMap).length === 0) {
      return buildLegacyVariables(order, store);
    }
  
    const resolved = {};
    for (const [position, fieldKey] of Object.entries(variablesMap)) {
      resolved[position] = getOrderFieldValue(fieldKey, order, store, fulfillment);
    }
    return resolved;
  }
  
  function buildLegacyVariables(order, store) {
    const lineItems = order?.line_items || [];
    const fulfillments = order?.fulfillments || [];
    const latestFulfillment = fulfillments[fulfillments.length - 1] || {};
  
    return {
      "1": `${order?.billing_address?.first_name || order?.customer?.first_name || ""} ${order?.billing_address?.last_name || order?.customer?.last_name || ""}`.trim(),
      "2": String(order?.name || order?.order_number || ""),
      "3": `${order?.currency || store?.currency || "PKR"} ${order?.total_price || "0.00"}`,
      "4": store?.shopName || store?.shopDomain || "",
      "5": lineItems.map(item => `${item.name} x${item.quantity}`).join(", "),
      "6": order?.shipping_address?.address1 || order?.billing_address?.address1 || "",
      "7": order?.shipping_address?.city || order?.billing_address?.city || "",
      "8": order?.payment_gateway_names?.[0] || "N/A",
      "9": order?.created_at ? new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "",
      "10": String(order?.id || ""),
      "11": order?.billing_address?.phone || order?.shipping_address?.phone || order?.customer?.phone || "",
      "12": lineItems.map(item => String(item.quantity)).join(", "),
      "13": lineItems.map(item => `${order?.currency || "PKR"} ${item.price}`).join(", "),
      "14": `${order?.currency || "PKR"} ${order?.total_shipping_price_set?.shop_money?.amount || "0.00"}`,
      "15": order?.financial_status || "N/A",
      "16": latestFulfillment.tracking_number || "N/A",
      "17": latestFulfillment.tracking_url || "",
      "18": latestFulfillment.tracking_company || "N/A",
      "19": order?.abandoned_checkout_url || order?.order_status_url || "",
    };
  }