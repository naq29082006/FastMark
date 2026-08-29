function normalizeKey(value) {
  return String(value || "").trim();
}

function isPlaceholderSupabaseKey(key) {
  const normalized = normalizeKey(key).toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized.includes("your-supabase") ||
    normalized.includes("your_anon") ||
    normalized.includes("your-service") ||
    normalized.startsWith("<") ||
    normalized === "changeme" ||
    normalized.includes("placeholder")
  );
}

function isJwtFormatKey(key) {
  const trimmed = normalizeKey(key);
  const parts = trimmed.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

function isNewFormatSupabaseKey(key) {
  const trimmed = normalizeKey(key);
  return trimmed.startsWith("sb_publishable_") || trimmed.startsWith("sb_secret_");
}

function isValidSupabaseApiKey(key) {
  return isNewFormatSupabaseKey(key) || isJwtFormatKey(key);
}

function resolveSupabaseApiKey({ serviceRoleKey, anonKey }) {
  const service = normalizeKey(serviceRoleKey);
  const anon = normalizeKey(anonKey);

  if (!isPlaceholderSupabaseKey(service) && isValidSupabaseApiKey(service)) {
    return {
      key: service,
      source: isNewFormatSupabaseKey(service) ? "secret" : "service_role",
    };
  }

  if (service && !isPlaceholderSupabaseKey(service)) {
    console.warn("[supabase] SUPABASE_SERVICE_ROLE_KEY không hợp lệ — bỏ qua key này.");
  } else if (service && isPlaceholderSupabaseKey(service)) {
    console.warn("[supabase] SUPABASE_SERVICE_ROLE_KEY đang là giá trị mẫu — bỏ qua key này.");
  }

  if (!isPlaceholderSupabaseKey(anon) && isValidSupabaseApiKey(anon)) {
    if (service) {
      console.warn("[supabase] Backend đang dùng anon/publishable key cho upload storage.");
    }
    return {
      key: anon,
      source: isNewFormatSupabaseKey(anon) ? "publishable" : "anon",
    };
  }

  if (anon && !isPlaceholderSupabaseKey(anon)) {
    console.warn("[supabase] SUPABASE_ANON_KEY không hợp lệ.");
  } else if (anon && isPlaceholderSupabaseKey(anon)) {
    console.warn("[supabase] SUPABASE_ANON_KEY đang là giá trị mẫu trong .env.");
  }

  return { key: null, source: null };
}

function describeSupabaseConfigIssue({ serviceRoleKey, anonKey, url }) {
  if (!normalizeKey(url)) {
    return "Thiếu SUPABASE_URL trong FastMark/.env.";
  }

  const service = normalizeKey(serviceRoleKey);
  const anon = normalizeKey(anonKey);

  if (isPlaceholderSupabaseKey(service) && isPlaceholderSupabaseKey(anon)) {
    return "Supabase chưa được cấu hình: thêm SUPABASE_ANON_KEY (sb_publishable_...) và SUPABASE_SERVICE_ROLE_KEY (sb_secret_...) trong FastMark/.env.";
  }

  if (!isValidSupabaseApiKey(service) && !isValidSupabaseApiKey(anon)) {
    return "Supabase API key không hợp lệ: dùng sb_publishable_... / sb_secret_... hoặc JWT legacy (eyJ...) từ Supabase Dashboard → Settings → API Keys.";
  }

  return "Supabase chưa sẵn sàng cho upload. Kiểm tra SUPABASE_URL, SUPABASE_ANON_KEY và SUPABASE_SERVICE_ROLE_KEY trong FastMark/.env.";
}

module.exports = {
  describeSupabaseConfigIssue,
  isJwtFormatKey,
  isNewFormatSupabaseKey,
  isPlaceholderSupabaseKey,
  isValidSupabaseApiKey,
  resolveSupabaseApiKey,
};
