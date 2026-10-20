"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase() {
  const env = supabaseEnv();
  if (!env) return null;
  if (!browserClient) browserClient = createBrowserClient(env.url, env.anonKey);
  return browserClient;
}
