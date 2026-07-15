// ==================== PHONE FORMATTING HELPERS ====================

export function formatPhone(phone) {
  if (!phone) return null;

  let cleaned = String(phone).replace(/[\s\-().]/g, "");

  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }

  cleaned = cleaned.replace(/\D/g, "");

  if (cleaned.startsWith("0") && cleaned.length === 11) {
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