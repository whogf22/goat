import { Tool, createToolParameters } from "@goat-sdk/core";
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { z } from "zod";

export class QueryParameters extends createToolParameters(
    z.object({
        table: z.string().describe("The name of the table to query"),
        select: z.string().default("*").describe("The columns to select (comma separated)"),
        limit: z.number().optional().describe("The number of rows to return"),
        eq: z.record(z.any()).optional().describe("Filter by column equality (column: value)"),
    }),
) {}

export class SupabaseService {
    private client: SupabaseClient;

    constructor(url: string, key: string) {
        this.client = createClient(url, key);
    }

    @Tool({
        description: "Query data from a Supabase table",
    })
    async query(parameters: QueryParameters) {
        let query = this.client.from(parameters.table).select(parameters.select);

        if (parameters.eq) {
            for (const [key, value] of Object.entries(parameters.eq)) {
                query = query.eq(key, value);
            }
        }

        if (parameters.limit) {
            query = query.limit(parameters.limit);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Supabase query error: ${error.message}`);
        }

        return data;
    }
}
