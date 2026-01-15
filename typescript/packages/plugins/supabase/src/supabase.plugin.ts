import { Chain, PluginBase } from "@goat-sdk/core";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseService } from "./supabase.service";

export class SupabasePlugin extends PluginBase {
    constructor(client: SupabaseClient) {
        super("supabase", [new SupabaseService(client)]);
    }

    supportsChain(chain: Chain) {
        return true; // Supabase is chain-agnostic
    }
}

export const supabase = (client: SupabaseClient) => new SupabasePlugin(client);
