import { processButtonReply, processStatusUpdate, processReviewReply } from "../services/whatsappCallback.server.js";

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
        const phoneNumberId = change.value?.metadata?.phone_number_id || null;
        const messages = change.value?.messages || [];
        for (const msg of messages) {
          const phone = msg.from || null;
          const contextMessageId = msg.context?.id || null;
          const listReplyId = msg.interactive?.list_reply?.id || null;
          const buttonText = msg.button?.text || msg.interactive?.button_reply?.title || null;
          const textBody = msg.type === "text" ? msg.text?.body : null;

          const handledByReview = await processReviewReply({
            contextMessageId,
            phone,
            phoneNumberId,
            listReplyId,
            buttonText,
            textBody,
          });
          if (handledByReview) continue;

          if (msg.type === "button") {
            await processButtonReply({
              contextMessageId,
              buttonText: msg.button?.text,
              phoneNumberId,
            });
          } else if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
            await processButtonReply({
              contextMessageId,
              buttonText: msg.interactive.button_reply?.title,
              phoneNumberId,
            });
          }
        }
        const statuses = change.value?.statuses || [];
        for (const st of statuses) {
          await processStatusUpdate({
            whatsappMessageId: st.id,
            status: st.status,
            errorMessage: st.errors?.[0]?.title || st.errors?.[0]?.error_data?.details || null,
          });
        }
      }
    }
  } catch (e) {
    console.warn("Callback error:", e.message);
  }

  return new Response("OK", { status: 200 });
};