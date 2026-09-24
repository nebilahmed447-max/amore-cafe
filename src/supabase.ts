import { createClient } from "@supabase/supabase-js";

// Supabase expects the project URL only (for example https://xxxx.supabase.co).
// If /rest/v1 was accidentally pasted into the URL, normalize it automatically.
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn("Supabase environment variables are missing. Local fallback is active.");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabasePublishableKey || "placeholder-publishable-key"
);
