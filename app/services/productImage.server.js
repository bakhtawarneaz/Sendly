// ==================== PRODUCT IMAGE (Shopify Admin REST) ====================

export async function getProductImageUrl(shopDomain, accessToken, order) {
    try {
      const lineItems = order?.line_items || [];
      if (lineItems.length === 0) return null;
  
      const productId = lineItems[0]?.product_id;
      if (!productId) return null;
  
      const response = await fetch(
        `https://${shopDomain}/admin/api/2024-10/products/${productId}/images.json`,
        {
          headers: { "X-Shopify-Access-Token": accessToken },
        }
      );
  
      if (!response.ok) return null;
  
      const data = await response.json();
      return data?.images?.[0]?.src || null;
    } catch (error) {
      console.warn("Product image fetch error:", error.message);
      return null;
    }
  }