import { processButtonReply } from "../services/whatsappCallback.server.js";

// GET — Meta webhook verification
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
};

export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const entries = body?.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const messages = change.value?.messages || [];
        for (const msg of messages) {
          if (msg.type === "button") {
            await processButtonReply({
              contextMessageId: msg.context?.id,
              buttonText: msg.button?.text,
            });
          } else if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
            await processButtonReply({
              contextMessageId: msg.context?.id,
              buttonText: msg.interactive.button_reply?.title,
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn("Callback error:", e.message);
  }

  return new Response("OK", { status: 200 });
};