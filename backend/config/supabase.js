const { createClient } = require("@supabase/supabase-js");
const {
  supabaseAnonKey,
  supabaseServiceRoleKey,
  supabaseUrl,
} = require("./env");

let supabaseClient;

function getSupabaseClient() {
  const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseClient;
}

module.exports = {
  getSupabaseClient,
};
