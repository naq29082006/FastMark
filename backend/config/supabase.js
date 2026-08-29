const { createClient } = require("@supabase/supabase-js");
const {
  supabaseAnonKey,
  supabaseServiceRoleKey,
  supabaseUrl,
} = require("./env");
const {
  describeSupabaseConfigIssue,
  isNewFormatSupabaseKey,
  resolveSupabaseApiKey,
} = require("../utils/supabaseKey");

let supabaseClient;
let supabaseClientKeySource = null;

function getSupabaseClient() {
  const resolved = resolveSupabaseApiKey({
    serviceRoleKey: supabaseServiceRoleKey,
    anonKey: supabaseAnonKey,
  });

  if (!supabaseUrl || !resolved.key) {
    return null;
  }

  if (isNewFormatSupabaseKey(resolved.key)) {
    // createClient gửi Bearer + apikey; key mới không phải JWT → dùng StorageClient ở uploadService.
    return null;
  }

  if (!supabaseClient || supabaseClientKeySource !== resolved.source) {
    supabaseClient = createClient(supabaseUrl, resolved.key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    supabaseClientKeySource = resolved.source;
  }

  return supabaseClient;
}

function getSupabaseStorageConfig() {
  return resolveSupabaseApiKey({
    serviceRoleKey: supabaseServiceRoleKey,
    anonKey: supabaseAnonKey,
  });
}

function getSupabaseConfigErrorMessage() {
  return describeSupabaseConfigIssue({
    serviceRoleKey: supabaseServiceRoleKey,
    anonKey: supabaseAnonKey,
    url: supabaseUrl,
  });
}

function isSupabaseStorageConfigured() {
  const resolved = getSupabaseStorageConfig();
  return Boolean(supabaseUrl && resolved.key);
}

module.exports = {
  getSupabaseClient,
  getSupabaseConfigErrorMessage,
  getSupabaseStorageConfig,
  isSupabaseStorageConfigured,
};
