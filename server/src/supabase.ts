import { createClient } from "@supabase/supabase-js";
import { config, hasSupabaseAuth, hasSupabaseDatabase } from "./config.js";

export const supabaseAuthClient = hasSupabaseAuth
  ? createClient(config.supabaseUrl!, config.supabaseAnonKey!, {
      auth: { persistSession: false }
    })
  : null;

export const supabaseAdminClient = hasSupabaseDatabase
  ? createClient(config.supabaseUrl!, config.supabaseServiceRoleKey!, {
      auth: { persistSession: false }
    })
  : null;
