// ==================== ORDER HELPERS ====================
import { extractPhoneFromOrder } from "../utils/phoneHelper.server.js";

export function isCodOrder(order) {
  const gateway = (order?.payment_gateway_names?.[0] || "").toLowerCase();
  const financialStatus = (order?.financial_status || "").toLowerCase();
  return gateway.includes("cod") || gateway.includes("cash") || financialStatus === "pending";
}

export function passesPaymentFilter(order, filter) {
  if (!filter || filter === "all") return true;
  if (filter === "cod") return isCodOrder(order);
  if (filter === "prepaid") {
    const financialStatus = (order?.financial_status || "").toLowerCase();
    return financialStatus === "paid" || financialStatus === "authorized";
  }
  return true;
}

export function extractCustomerPhone(order) {
  return extractPhoneFromOrder(order);
}

export function parseConfig(storeService) {
  let config = {};
  if (storeService?.config) {
    try {
      config = typeof storeService.config === "string"
        ? JSON.parse(storeService.config)
        : storeService.config;
    } catch (e) {}
  }
  return config;
}