import * as FileSystem from "expo-file-system/legacy";

import { API_CONFIG } from "../config/apiConfig";

export async function uploadServeRequestPdf(fileUri) {
  if (!fileUri) {
    throw new Error("Missing serve request PDF.");
  }

  const result = await FileSystem.uploadAsync(
    `${API_CONFIG.baseUrl}/api/v1/serve/request-pdf`,
    fileUri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: "application/pdf",
      parameters: {
        kind: "serve-request"
      }
    }
  );

  let payload = null;
  try {
    payload = result.body ? JSON.parse(result.body) : null;
  } catch {
    throw new Error("The server returned an invalid PDF upload response.");
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(payload?.message || "Unable to upload serve request PDF.");
  }

  return payload;
}
