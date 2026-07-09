const path = require("path");

const { getSupabaseClient } = require("../config/supabase");
const { supabaseStorageBucket } = require("../config/env");

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

async function uploadImageToSupabase({
  buffer,
  mimeType,
  folder,
  fileName,
  upsert = true,
}) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw createUploadError(
      "Supabase chưa được cấu hình. Thêm SUPABASE_URL và SUPABASE_ANON_KEY vào backend/.env.",
      503
    );
  }

  if (!buffer || !buffer.length) {
    throw createUploadError("File ảnh trống.", 400);
  }

  const bucket = supabaseStorageBucket;
  const storagePath = `${folder}/${fileName}`;

  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: mimeType || "image/jpeg",
    upsert,
  });

  if (error) {
    const rlsHint = error.message.includes("row-level security policy")
      ? " Bucket đang bị chặn bởi RLS. Dùng SUPABASE_SERVICE_ROLE_KEY ở backend hoặc mở policy INSERT cho bucket."
      : "";
    throw createUploadError(
      `Upload Supabase thất bại: ${error.message}.${rlsHint}`,
      502
    );
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return {
    bucket,
    path: storagePath,
    publicUrl: data.publicUrl,
  };
}

module.exports = {
  resolveFileExtension,
  uploadImageToSupabase,
};
