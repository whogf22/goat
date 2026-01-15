import { PluginBase } from "@goat-sdk/core";
import { SupabaseAPI, type SupabaseConfig } from "./api";
import { SupabaseService } from "./supabase.service";

/**
 * Supabase Plugin Options
 * 
 * @property supabaseUrl - Your Supabase project URL (e.g., https://xxx.supabase.co)
 * @property supabaseKey - Your Supabase anon/public key or service role key
 * @property serviceRoleKey - Optional service role key for admin operations (storage, etc.)
 */
export interface SupabasePluginOptions extends SupabaseConfig {}

/**
 * Supabase Plugin for GOAT SDK
 * 
 * Provides tools for interacting with Supabase:
 * - Database operations (select, insert, update, delete)
 * - RPC function calls
 * - Storage operations (list buckets, list files, signed URLs)
 * 
 * Security Features:
 * - Input validation and sanitization
 * - SQL injection prevention
 * - Required filters for destructive operations
 * - Proper error handling
 * 
 * @example
 * ```typescript
 * import { supabase } from "@goat-sdk/plugin-supabase";
 * 
 * const tools = await getOnChainTools({
 *     plugins: [
 *         supabase({
 *             supabaseUrl: process.env.SUPABASE_URL,
 *             supabaseKey: process.env.SUPABASE_ANON_KEY,
 *         })
 *     ]
 * });
 * ```
 */
export class SupabasePlugin extends PluginBase {
    constructor(options: SupabasePluginOptions) {
        // Validate required options
        if (!options.supabaseUrl) {
            throw new Error("supabaseUrl is required for Supabase plugin");
        }
        if (!options.supabaseKey) {
            throw new Error("supabaseKey is required for Supabase plugin");
        }

        const api = new SupabaseAPI(options);
        const service = new SupabaseService(api);

        super("supabase", [service]);
    }

    supportsChain = () => true;
}

/**
 * Factory function to create a Supabase plugin instance
 * 
 * @param options - Plugin configuration options
 * @returns A configured SupabasePlugin instance
 * 
 * @example
 * ```typescript
 * import { supabase } from "@goat-sdk/plugin-supabase";
 * 
 * const plugin = supabase({
 *     supabaseUrl: "https://your-project.supabase.co",
 *     supabaseKey: "your-anon-key",
 *     // Optional: for storage and admin operations
 *     serviceRoleKey: "your-service-role-key",
 * });
 * ```
 */
export function supabase(options: SupabasePluginOptions): SupabasePlugin {
    return new SupabasePlugin(options);
}
