// ==================== PHONE FORMATTING HELPERS ====================

export function formatPhone(phone) {
    if (!phone) return null;
    let cleaned = phone.replace(/[\s\-\+]/g, "");
    if (cleaned.startsWith("03") && cleaned.length === 11) {
      cleaned = "92" + cleaned.substring(1);
    }
    if (!cleaned.startsWith("92") && cleaned.length === 10) {
      cleaned = "92" + cleaned;
    }
    return cleaned;
  }
  
  export function extractPhoneFromOrder(orderData) {
    const phone =
      orderData?.phone ||
      orderData?.billing_address?.phone ||
      orderData?.shipping_address?.phone ||
      orderData?.customer?.phone ||
      null;
    return formatPhone(phone);
  }