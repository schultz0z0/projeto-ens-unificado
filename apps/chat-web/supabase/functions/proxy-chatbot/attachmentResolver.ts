import { extractAttachmentText } from "./attachmentTextExtraction.ts";
import type { PreparedAttachment } from "./attachmentTransport.ts";
import { CHAT_ATTACHMENT_BUCKET, CHAT_ATTACHMENT_MAX_DOWNLOAD_BYTES, CHAT_ATTACHMENT_SIGNED_URL_TTL_SECONDS, assertAttachmentAccess } from "./attachmentPolicy.ts";
import type { ProxyChatAttachment } from "./multimodalPayload.ts";

type StorageDownloadResponse = {
  data: Blob | null;
  error: { message?: string } | null;
};

type StorageSignedUrlResponse = {
  data: { signedUrl?: string } | null;
  error: { message?: string } | null;
};

type StorageBucketApi = {
  download: (path: string) => Promise<StorageDownloadResponse>;
  createSignedUrl: (path: string, expiresIn: number) => Promise<StorageSignedUrlResponse>;
};

type StorageAdminClient = {
  storage: {
    from: (bucket: string) => StorageBucketApi;
  };
};

const encodeBase64 = (bytes: Uint8Array) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const buildInlineDataUrl = (mimeType: string, bytes: Uint8Array) => `data:${mimeType};base64,${encodeBase64(bytes)}`;

const readAttachmentBytes = async (bucketApi: StorageBucketApi, attachment: ProxyChatAttachment) => {
  const { data, error } = await bucketApi.download(attachment.storage_path);
  if (error || !data) {
    throw new Error("attachment_fetch_failed");
  }

  if (data.size > CHAT_ATTACHMENT_MAX_DOWNLOAD_BYTES) {
    throw new Error("attachment_too_large");
  }

  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength > CHAT_ATTACHMENT_MAX_DOWNLOAD_BYTES) {
    throw new Error("attachment_too_large");
  }

  return bytes;
};

const createAttachmentSignedUrl = async (bucketApi: StorageBucketApi, storagePath: string) => {
  const { data, error } = await bucketApi.createSignedUrl(storagePath, CHAT_ATTACHMENT_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error("attachment_signed_url_failed");
  }

  return data.signedUrl;
};

export const resolveAttachmentForUser = async ({
  supabaseAdmin,
  attachment,
  userId,
  sessionId,
}: {
  supabaseAdmin: StorageAdminClient;
  attachment: ProxyChatAttachment;
  userId: string;
  sessionId: string;
}): Promise<PreparedAttachment> => {
  assertAttachmentAccess({ attachment, userId, sessionId });

  const bucketApi = supabaseAdmin.storage.from(CHAT_ATTACHMENT_BUCKET);
  const [bytes, signedUrl] = await Promise.all([
    readAttachmentBytes(bucketApi, attachment),
    createAttachmentSignedUrl(bucketApi, attachment.storage_path),
  ]);

  return {
    ...attachment,
    signed_url: signedUrl,
    original_signed_url: signedUrl,
    inline_data_url: buildInlineDataUrl(attachment.mime_type, bytes),
    extracted_text: extractAttachmentText(attachment, bytes) || undefined,
  };
};
