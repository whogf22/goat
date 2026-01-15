import { Tool } from "@goat-sdk/core";
import { SupabaseAPI, type SupabaseResponse } from "./api";
import {
    SelectRowsParameters,
    InsertRowsParameters,
    UpdateRowsParameters,
    DeleteRowsParameters,
    CallRpcParameters,
    ListBucketsParameters,
    ListFilesParameters,
    CreateSignedUrlParameters,
} from "./parameters";

/**
 * Supabase Service
 * 
 * Provides tools for interacting with Supabase database and storage.
 * 
 * Security Features:
 * - Input validation through Zod schemas
 * - SQL injection prevention via sanitized table/column names
 * - Required filters for update/delete operations
 * - Proper error handling without exposing sensitive information
 */
export class SupabaseService {
    constructor(protected api: SupabaseAPI) {}

    /**
     * Formats the response for consistent output
     */
    private formatResponse<T>(response: SupabaseResponse<T>): {
        success: boolean;
        data?: T;
        error?: string;
        count?: number;
    } {
        if (response.error) {
            return {
                success: false,
                error: response.error.message,
            };
        }
        
        return {
            success: true,
            data: response.data ?? undefined,
            count: response.count,
        };
    }

    @Tool({
        name: "supabase_select_rows",
        description: "Select/query rows from a Supabase database table. Supports filtering, ordering, and pagination. Use this to retrieve data from the database.",
    })
    async selectRows(parameters: SelectRowsParameters) {
        const { tableName, select, filter, order, limit, offset } = parameters;
        
        const response = await this.api.select(tableName, {
            select,
            filter: filter as Record<string, unknown> | undefined,
            order: order ? { column: order.column, ascending: order.ascending } : undefined,
            limit,
            offset,
        });
        
        return this.formatResponse(response);
    }

    @Tool({
        name: "supabase_insert_rows",
        description: "Insert one or more rows into a Supabase database table. Supports upsert (insert or update on conflict). Returns the inserted rows.",
    })
    async insertRows(parameters: InsertRowsParameters) {
        const { tableName, data, upsert, onConflict } = parameters;
        
        // Validate data is not empty
        if (Array.isArray(data)) {
            if (data.length === 0) {
                return {
                    success: false,
                    error: "Data array cannot be empty",
                };
            }
            // Performance warning for large batches
            if (data.length > 100) {
                console.warn(`Inserting ${data.length} rows. Consider batching for better performance.`);
            }
        } else if (Object.keys(data).length === 0) {
            return {
                success: false,
                error: "Data object cannot be empty",
            };
        }
        
        const response = await this.api.insert(
            tableName,
            data as Record<string, unknown> | Record<string, unknown>[],
            { upsert, onConflict }
        );
        
        return this.formatResponse(response);
    }

    @Tool({
        name: "supabase_update_rows",
        description: "Update existing rows in a Supabase database table. REQUIRES a filter to prevent accidental full table updates. Returns the updated rows.",
    })
    async updateRows(parameters: UpdateRowsParameters) {
        const { tableName, data, filter } = parameters;
        
        // Validate data is not empty
        if (Object.keys(data).length === 0) {
            return {
                success: false,
                error: "Update data cannot be empty",
            };
        }
        
        // Ensure filter is provided (additional safety check)
        if (!filter || Object.keys(filter).length === 0) {
            return {
                success: false,
                error: "Filter is required for update operations to prevent accidental full table updates",
            };
        }
        
        const response = await this.api.update(
            tableName,
            data as Record<string, unknown>,
            filter as Record<string, unknown>
        );
        
        return this.formatResponse(response);
    }

    @Tool({
        name: "supabase_delete_rows",
        description: "Delete rows from a Supabase database table. REQUIRES a filter to prevent accidental full table deletion. Returns the deleted rows.",
    })
    async deleteRows(parameters: DeleteRowsParameters) {
        const { tableName, filter } = parameters;
        
        // Ensure filter is provided (additional safety check)
        if (!filter || Object.keys(filter).length === 0) {
            return {
                success: false,
                error: "Filter is required for delete operations to prevent accidental full table deletion",
            };
        }
        
        const response = await this.api.delete(
            tableName,
            filter as Record<string, unknown>
        );
        
        return this.formatResponse(response);
    }

    @Tool({
        name: "supabase_call_rpc",
        description: "Call a Supabase RPC (Remote Procedure Call) function. Use this to execute custom PostgreSQL functions defined in your Supabase database.",
    })
    async callRpc(parameters: CallRpcParameters) {
        const { functionName, params } = parameters;
        
        const response = await this.api.rpc(
            functionName,
            params as Record<string, unknown>
        );
        
        return this.formatResponse(response);
    }

    @Tool({
        name: "supabase_list_buckets",
        description: "List all storage buckets in your Supabase project. Returns bucket names, IDs, and metadata.",
    })
    async listBuckets(_parameters: ListBucketsParameters) {
        const response = await this.api.listBuckets();
        return this.formatResponse(response);
    }

    @Tool({
        name: "supabase_list_files",
        description: "List files in a Supabase storage bucket. Supports path filtering and pagination.",
    })
    async listFiles(parameters: ListFilesParameters) {
        const { bucketName, path, limit, offset } = parameters;
        
        const response = await this.api.listFiles(bucketName, path, { limit, offset });
        return this.formatResponse(response);
    }

    @Tool({
        name: "supabase_create_signed_url",
        description: "Create a signed URL for accessing a private file in Supabase storage. The URL expires after the specified time.",
    })
    async createSignedUrl(parameters: CreateSignedUrlParameters) {
        const { bucketName, filePath, expiresIn } = parameters;
        
        const response = await this.api.createSignedUrl(bucketName, filePath, expiresIn);
        return this.formatResponse(response);
    }
}
