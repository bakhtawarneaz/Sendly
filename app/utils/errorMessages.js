// ==================== WHATSAPP ERROR → HUMAN-READABLE ====================

export function humanizeWhatsappError(rawError = "") {
    const err = String(rawError || "").toLowerCase();
  
    if (err.includes("access token") || err.includes("#190") || err.includes("oauth") || err.includes("expired")) {
      return {
        message: "WhatsApp connection expired or invalid.",
        action: "Go to Settings and reconnect your WhatsApp account, then resend.",
        fixable: true,
      };
    }
  
    if (err.includes("131030") || err.includes("not in allowed list") || err.includes("recipient")) {
      return {
        message: "This number can't receive WhatsApp messages (not registered on WhatsApp, or not in your test list).",
        action: "Nothing to fix — this customer can't be reached on WhatsApp.",
        fixable: false,
      };
    }
  
    if (err.includes("invalid") && err.includes("phone")) {
      return {
        message: "The customer's phone number format is invalid.",
        action: "Check that the customer's phone number is correct in the order.",
        fixable: false,
      };
    }
  
    if (err.includes("132000") || err.includes("132001") || err.includes("template") || err.includes("does not exist")) {
      return {
        message: "The message template is not approved or doesn't match Meta's records.",
        action: "Go to Templates, make sure the template is approved, then resend.",
        fixable: true,
      };
    }
  
    if (err.includes("rate") || err.includes("131056") || err.includes("too many")) {
      return {
        message: "Too many messages were sent in a short time.",
        action: "Wait a few minutes, then resend.",
        fixable: true,
      };
    }
  
    if (err.includes("131047") || err.includes("re-engagement") || err.includes("outside")) {
      return {
        message: "Message couldn't be sent due to WhatsApp's messaging window.",
        action: "This usually resolves on its own — try resending.",
        fixable: true,
      };
    }
  
    if (err.includes("media") || err.includes("image") || err.includes("download")) {
      return {
        message: "There was a problem with the product image or media in the message.",
        action: "Check the template's media, or disable product images in the service settings.",
        fixable: true,
      };
    }
  
    return {
      message: rawError ? `Message failed: ${rawError}` : "Message failed to send.",
      action: "Try resending. If it keeps failing, check your WhatsApp connection in Settings.",
      fixable: true,
    };
  }