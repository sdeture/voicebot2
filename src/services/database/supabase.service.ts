/**
 * Supabase Service
 * --------------
 * Provides access to the Supabase database client.
 */

import { createClient } from "@supabase/supabase-js";

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Create and export the client
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Default export for backward compatibility
export default supabaseClient;
