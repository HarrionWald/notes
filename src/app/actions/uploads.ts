"use server";

import { validateFile } from "@/lib/files/validate";
import { SUPABASE_FREE_MAX_FILE_BYTES } from "@/lib/limits";
import { createClient } from "@/lib/supabase/server";

export async function validateUploadMetadata(input: { name: string; size: number; type: string; limitBytes: number }) {
  const supabase = await createClient();
  if (!supabase) return { ok: false as const, error: "Supabase is not configured." };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, error: "Sign in before uploading files." };
  const limit = Math.min(input.limitBytes, SUPABASE_FREE_MAX_FILE_BYTES);
  return validateFile({ name: input.name, size: input.size, type: input.type, limitBytes: limit });
}
