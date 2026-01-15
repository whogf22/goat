import { PluginBase } from "@goat-sdk/core";
import { SupabaseService } from "./supabase.service";

export class SupabasePlugin extends PluginBase {
    constructor(url: string, key: string) {
        super("supabase", [new SupabaseService(url, key)]);
    }

    supportsChain = () => true;
}

export const supabase = (url: string, key: string) => new SupabasePlugin(url, key);
