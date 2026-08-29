const path = require("path");

const { StorageClient } = require("@supabase/storage-js");
const {
  getSupabaseClient,
  getSupabaseConfigErrorMessage,
  getSupabaseStorageConfig,
} = require("../config/supabase");
const { supabaseStorageBucket, supabaseUrl } = require("../config/env");
const { isNewFormatSupabaseKey } = require("../utils/supabaseKey");

const MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function createUploadError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function resolveFileExtension(mimeType, originalName = "") {
  const fromMime = MIME_TO_EXTENSION[String(mimeType || "").toLowerCase()];
  if (fromMime) {
    return fromMime;
  }

  const ext = path.extname(originalName).replace(".", "").toLowerCase();
  if (ext) {
    return ext;
  }

  return "jpg";
}

function getStorageUploadClient(resolvedKey) {
  if (isNewFormatSupabaseKey(resolvedKey.key)) {
    const storageUrl = `${String(supabaseUrl || "").replace(/\/$/, "")}/storage/v1`;
    return new StorageClient(storageUrl, { apikey: resolvedKey.key });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  return supabase.storage;
}

async function uploadImageToSupabase({
  buffer,
  mimeType,
  folder,
  fileName,
  upsert = true,
}) {
  const resolved = getSupabaseStorageConfig();

  if (!supabaseUrl || !resolved.key) {
    throw createUploadError(getSupabaseConfigErrorMessage(), 503);
  }

  if (!buffer || !buffer.length) {
    throw createUploadError("File ảnh trống.", 400);
  }

  const storage = getStorageUploadClient(resolved);
  if (!storage) {
    throw createUploadError(getSupabaseConfigErrorMessage(), 503);
  }

  const bucket = supabaseStorageBucket;
  const storagePath = `${folder}/${fileName}`;

  const { error } = await storage.from(bucket).upload(storagePath, buffer, {
    contentType: mimeType || "image/jpeg",
    upsert,
  });

  if (error) {
    const invalidKeyHint = error.message.includes("Invalid Compact JWS")
      ? " Key Supabase không hợp lệ hoặc bị dính ký tự thừa trong FastMark/.env. Dùng sb_secret_... / sb_publishable_... từ Dashboard → Settings → API Keys."
      : "";
    const rlsHint = error.message.includes("row-level security policy")
      ? " Bucket đang bị chặn bởi RLS. Dùng SUPABASE_SERVICE_ROLE_KEY (sb_secret_...) hợp lệ hoặc mở policy INSERT cho bucket."
      : "";
    throw createUploadError(
      `Upload Supabase thất bại: ${error.message}.${invalidKeyHint}${rlsHint}`,
      502
    );
  }

  const publicUrl = `${String(supabaseUrl).replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${storagePath}`;

  return {
    bucket,
    path: storagePath,
    publicUrl,
  };
}

module.exports = {
  resolveFileExtension,
  uploadImageToSupabase,
};
