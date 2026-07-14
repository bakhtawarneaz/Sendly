async function createStagedUpload(admin, filename, mimeType, fileSize) {
    const response = await admin.graphql(
      `#graphql
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters { name value }
          }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: [
            {
              filename,
              mimeType,
              fileSize: String(fileSize),
              httpMethod: "POST",
              resource: "FILE",
            },
          ],
        },
      }
    );
  
    const json = await response.json();
    const result = json?.data?.stagedUploadsCreate;
    if (result?.userErrors?.length) {
      throw new Error(result.userErrors[0].message);
    }
    return result.stagedTargets[0];
  }
  
  async function uploadToStagedTarget(target, fileBuffer, filename, mimeType) {
    const form = new FormData();
    for (const param of target.parameters) {
      form.append(param.name, param.value);
    }
    const blob = new Blob([fileBuffer], { type: mimeType });
    form.append("file", blob, filename);
  
    const uploadResponse = await fetch(target.url, {
      method: "POST",
      body: form,
    });
  
    if (!uploadResponse.ok) {
      throw new Error(`Staged upload failed: ${uploadResponse.status}`);
    }
  }
  
  async function createShopifyFile(admin, resourceUrl, mimeType) {
    const contentType = mimeType.startsWith("image/")
      ? "IMAGE"
      : mimeType.startsWith("video/")
        ? "VIDEO"
        : "FILE";
  
    const response = await admin.graphql(
      `#graphql
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            preview { image { url } }
            ... on GenericFile { url }
            ... on MediaImage { image { url } }
            ... on Video { sources { url } }
          }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          files: [{ originalSource: resourceUrl, contentType }],
        },
      }
    );
  
    const json = await response.json();
    const result = json?.data?.fileCreate;
    if (result?.userErrors?.length) {
      throw new Error(result.userErrors[0].message);
    }
  
    const file = result.files[0];
    const fileId = file.id;

    const url = await pollFileUrl(admin, fileId);
    return url;
  }
  
  async function pollFileUrl(admin, fileId, maxAttempts = 10) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await admin.graphql(
        `#graphql
        query getFile($id: ID!) {
          node(id: $id) {
            ... on MediaImage { image { url } fileStatus }
            ... on Video { sources { url } fileStatus }
            ... on GenericFile { url fileStatus }
          }
        }`,
        { variables: { id: fileId } }
      );
  
      const json = await response.json();
      const node = json?.data?.node;
  
      if (node?.fileStatus === "READY") {
        const url =
          node.image?.url ||
          node.sources?.[0]?.url ||
          node.url ||
          null;
        if (url) return url;
      }
  
      await new Promise((r) => setTimeout(r, 1000));
    }
  
    throw new Error("File processing timed out. Please try again.");
  }
  
  // ==================== MAIN: UPLOAD MEDIA ====================
  export async function uploadMedia(admin, file) {
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "application/octet-stream";
    const filename = file.name || "upload";
    const fileSize = fileBuffer.length;
  
    const target = await createStagedUpload(admin, filename, mimeType, fileSize);
    await uploadToStagedTarget(target, fileBuffer, filename, mimeType);
    const url = await createShopifyFile(admin, target.resourceUrl, mimeType);
  
    return { url };
  }