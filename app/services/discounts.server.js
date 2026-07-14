// ==================== FETCH ACTIVE DISCOUNT CODES ====================

export async function getDiscountCodes(admin) {
    try {
      const response = await admin.graphql(
        `#graphql
        query {
          codeDiscountNodes(first: 100, query: "status:active") {
            edges {
              node {
                id
                codeDiscount {
                  ... on DiscountCodeBasic {
                    title
                    status
                    codes(first: 1) { edges { node { code } } }
                  }
                  ... on DiscountCodeBxgy {
                    title
                    status
                    codes(first: 1) { edges { node { code } } }
                  }
                  ... on DiscountCodeFreeShipping {
                    title
                    status
                    codes(first: 1) { edges { node { code } } }
                  }
                }
              }
            }
          }
        }`
      );
  
      const json = await response.json();
      const edges = json?.data?.codeDiscountNodes?.edges || [];
  
      return edges
        .map((e) => {
          const d = e.node.codeDiscount;
          const code = d?.codes?.edges?.[0]?.node?.code;
          if (!code) return null;
          return { code, title: d.title || code };
        })
        .filter(Boolean);
    } catch (e) {
      console.warn("Failed to fetch discount codes:", e.message);
      return [];
    }
  }