import { authenticate } from "../shopify.server";
import { uploadMedia } from "../services/mediaUpload.server.js";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return Response.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return Response.json({ success: false, error: "File too large (max 15MB)" }, { status: 400 });
    }

    const { url } = await uploadMedia(admin, file);
    return Response.json({ success: true, url });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json({ success: false, error: error.message || "Upload failed" }, { status: 500 });
  }
};