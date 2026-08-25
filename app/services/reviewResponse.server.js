import prisma from "../db.server";
import { sendInteractiveListMessage, sendTextMessage } from "./whatsappSender.server.js";
import { submitJudgeMeReview } from "./judgeme.server.js";

function buildRatingSections() {
  return [
    {
      title: "Rate your order",
      rows: [
        { id: "review_rating_5", title: "⭐⭐⭐⭐⭐ Excellent" },
        { id: "review_rating_4", title: "⭐⭐⭐⭐ Good" },
        { id: "review_rating_3", title: "⭐⭐⭐ Okay" },
        { id: "review_rating_2", title: "⭐⭐ Poor" },
        { id: "review_rating_1", title: "⭐ Bad" },
      ],
    },
  ];
}

export async function sendRatingList(store, reviewRequest) {
  const result = await sendInteractiveListMessage(store, reviewRequest.customerPhone, {
    bodyText: `Thanks${reviewRequest.customerName ? " " + reviewRequest.customerName : ""}! How would you rate your order ${reviewRequest.orderName || ""}?`,
    buttonText: "Rate now",
    sections: buildRatingSections(),
  });
  await prisma.reviewRequest.update({
    where: { id: reviewRequest.id },
    data: { status: "rating_sent", whatsappMessageId: result.messageId },
  });
  return result;
}

export async function handleRatingReply(store, reviewRequest, rating) {
  await prisma.reviewRequest.update({
    where: { id: reviewRequest.id },
    data: { rating, status: "rated" },
  });
  await sendTextMessage(
    store,
    reviewRequest.customerPhone,
    "Thank you! Please reply with a few words about your experience, and we'll add it as your review."
  );
}

export async function handleReviewText(store, reviewRequest, text) {
  await prisma.reviewRequest.update({
    where: { id: reviewRequest.id },
    data: { reviewText: text },
  });

  try {
    await submitJudgeMeReview(store, reviewRequest, text);
    await prisma.reviewRequest.update({
      where: { id: reviewRequest.id },
      data: { status: "submitted" },
    });
    await sendTextMessage(store, reviewRequest.customerPhone, "Your review has been submitted. Thank you for your feedback! 🙏");
  } catch (error) {
    console.error("Judge.me submit failed:", error.message);
    await prisma.reviewRequest.update({
      where: { id: reviewRequest.id },
      data: { status: "failed" },
    });
  }
}