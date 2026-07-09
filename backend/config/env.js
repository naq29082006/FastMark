const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function readEnv(name, { required = false, fallback = "" } = {}) {
  const value = process.env[name];

  if (value === undefined || String(value).trim() === "") {
    if (required) {
      throw new Error(
        `Thiếu biến môi trường ${name}. Thêm vào backend/.env`
      );
    }

    return fallback;
  }

  let normalized = String(value).trim();

  // Tránh lỗi gõ nhầm FIREBASE_API_KEY==xxx trong .env
  if (name === "FIREBASE_API_KEY" && normalized.startsWith("=")) {
    normalized = normalized.slice(1).trim();
  }

  return normalized;
}

function readSupabaseEnv(...names) {
  for (const name of names) {
    const value = readEnv(name);
    if (value) {
      return value;
    }
  }

  return "";
}

module.exports = {
  port: Number(readEnv("PORT", { fallback: "500" })) || 500,
  mongoUri: readEnv("MONGO_URI", { required: true }),
  firebaseProjectId: readEnv("FIREBASE_PROJECT_ID", { required: true }),
  firebaseClientEmail: readEnv("FIREBASE_CLIENT_EMAIL", { required: true }),
  firebasePrivateKey: readEnv("FIREBASE_PRIVATE_KEY", { required: true }).replace(
    /\\n/g,
    "\n"
  ),
  firebaseApiKey: readEnv("FIREBASE_API_KEY", { required: true }),
  supabaseUrl: readSupabaseEnv("SUPABASE_URL", "VITE_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: readSupabaseEnv(
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY"
  ),
  supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseStorageBucket: readEnv("SUPABASE_STORAGE_BUCKET", {
    fallback: "product-images",
  }),
};
