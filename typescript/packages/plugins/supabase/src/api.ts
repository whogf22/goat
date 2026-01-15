/**
 * Supabase API Client
 * 
 * This client provides a secure wrapper around Supabase REST API operations.
 * 
 * Security considerations:
 * - API keys are never logged or exposed in error messages
 * - Input validation is performed before making requests
 * - SQL injection prevention through parameterized queries
 * - Rate limiting awareness through proper error handling
 */

export interface SupabaseConfig {
    supabaseUrl: string;
    supabaseKey: string;
    /** Optional service role key for admin operations (use with caution) */
    serviceRoleKey?: string;
}

export interface QueryOptions {
    select?: string;
    filter?: Record<string, unknown>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
    offset?: number;
    single?: boolean;
}

export interface SupabaseResponse<T = unknown> {
    data: T | null;
    error: SupabaseError | null;
    count?: number;
}

export interface SupabaseError {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
}

export class SupabaseAPI {
    private readonly supabaseUrl: string;
    private readonly supabaseKey: string;
    private readonly serviceRoleKey?: string;
    
    // Request timeout in milliseconds (default: 30 seconds)
    private readonly requestTimeout = 30000;
    
    // Maximum retry attempts for transient errors
    private readonly maxRetries = 3;
    
    constructor(config: SupabaseConfig) {
        // Validate URL format to prevent SSRF attacks
        if (!this.isValidSupabaseUrl(config.supabaseUrl)) {
            throw new Error("Invalid Supabase URL format. URL must be a valid HTTPS Supabase endpoint.");
        }
        
        // Validate API key format (basic validation)
        if (!config.supabaseKey || config.supabaseKey.length < 20) {
            throw new Error("Invalid Supabase API key. Key appears to be malformed.");
        }
        
        this.supabaseUrl = config.supabaseUrl.replace(/\/$/, ""); // Remove trailing slash
        this.supabaseKey = config.supabaseKey;
        this.serviceRoleKey = config.serviceRoleKey;
    }
    
    /**
     * Validates that the URL is a proper Supabase URL to prevent SSRF attacks
     */
    private isValidSupabaseUrl(url: string): boolean {
        try {
            const parsedUrl = new URL(url);
            // Must be HTTPS
            if (parsedUrl.protocol !== "https:") {
                return false;
            }
            // Should be a supabase domain or localhost for development
            const validDomains = [".supabase.co", ".supabase.in", "localhost", "127.0.0.1"];
            const isValidDomain = validDomains.some(
                (domain) => parsedUrl.hostname.endsWith(domain) || parsedUrl.hostname === domain.replace(".", "")
            );
            return isValidDomain || parsedUrl.hostname.includes("supabase");
        } catch {
            return false;
        }
    }
    
    /**
     * Sanitizes table names to prevent SQL injection
     */
    private sanitizeTableName(tableName: string): string {
        // Only allow alphanumeric characters, underscores, and hyphens
        const sanitized = tableName.replace(/[^a-zA-Z0-9_-]/g, "");
        if (sanitized !== tableName) {
            throw new Error(`Invalid table name: "${tableName}". Table names can only contain alphanumeric characters, underscores, and hyphens.`);
        }
        if (sanitized.length === 0 || sanitized.length > 63) {
            throw new Error("Table name must be between 1 and 63 characters.");
        }
        return sanitized;
    }
    
    /**
     * Sanitizes column names for select queries
     */
    private sanitizeSelectColumns(select: string): string {
        // Split by comma and validate each column
        const columns = select.split(",").map((col) => col.trim());
        for (const col of columns) {
            // Allow wildcards, column names, and basic PostgREST syntax
            if (!/^[\w*().,:\s-]+$/.test(col)) {
                throw new Error(`Invalid column specification: "${col}"`);
            }
        }
        return columns.join(",");
    }
    
    /**
     * Builds filter query string for PostgREST
     */
    private buildFilterQuery(filter: Record<string, unknown>): URLSearchParams {
        const params = new URLSearchParams();
        
        for (const [key, value] of Object.entries(filter)) {
            // Validate key format
            if (!/^[\w.]+$/.test(key)) {
                throw new Error(`Invalid filter key: "${key}"`);
            }
            
            if (value === null) {
                params.append(key, "is.null");
            } else if (typeof value === "object" && value !== null) {
                // Handle operator objects like { eq: value }, { gt: value }, etc.
                const operators = value as Record<string, unknown>;
                for (const [op, opValue] of Object.entries(operators)) {
                    const validOperators = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"];
                    if (!validOperators.includes(op)) {
                        throw new Error(`Invalid filter operator: "${op}"`);
                    }
                    params.append(key, `${op}.${String(opValue)}`);
                }
            } else {
                params.append(key, `eq.${String(value)}`);
            }
        }
        
        return params;
    }
    
    /**
     * Makes a request with retry logic for transient errors
     */
    private async requestWithRetry<T>(
        url: string,
        options: RequestInit,
        retryCount = 0
    ): Promise<SupabaseResponse<T>> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            // Handle rate limiting with exponential backoff
            if (response.status === 429 && retryCount < this.maxRetries) {
                const retryAfter = response.headers.get("Retry-After");
                const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, retryCount) * 1000;
                await this.sleep(waitTime);
                return this.requestWithRetry<T>(url, options, retryCount + 1);
            }
            
            // Handle server errors with retry
            if (response.status >= 500 && retryCount < this.maxRetries) {
                await this.sleep(Math.pow(2, retryCount) * 1000);
                return this.requestWithRetry<T>(url, options, retryCount + 1);
            }
            
            const text = await response.text();
            let data: T | null = null;
            let error: SupabaseError | null = null;
            
            if (text) {
                try {
                    const parsed = JSON.parse(text);
                    if (!response.ok) {
                        error = {
                            message: parsed.message || parsed.error || "Unknown error",
                            code: parsed.code,
                            details: parsed.details,
                            hint: parsed.hint,
                        };
                    } else {
                        data = parsed;
                    }
                } catch {
                    if (!response.ok) {
                        error = { message: text || `HTTP ${response.status}` };
                    }
                }
            }
            
            if (!response.ok && !error) {
                error = { message: `HTTP ${response.status}: ${response.statusText}` };
            }
            
            // Get count from headers if available
            const countHeader = response.headers.get("content-range");
            let count: number | undefined;
            if (countHeader) {
                const match = countHeader.match(/\/(\d+|\*)/);
                if (match && match[1] !== "*") {
                    count = parseInt(match[1], 10);
                }
            }
            
            return { data, error, count };
        } catch (err) {
            clearTimeout(timeoutId);
            
            if (err instanceof Error) {
                if (err.name === "AbortError") {
                    return {
                        data: null,
                        error: { message: "Request timed out" },
                    };
                }
                
                // Retry on network errors
                if (retryCount < this.maxRetries && this.isNetworkError(err)) {
                    await this.sleep(Math.pow(2, retryCount) * 1000);
                    return this.requestWithRetry<T>(url, options, retryCount + 1);
                }
                
                return {
                    data: null,
                    error: { message: err.message },
                };
            }
            
            return {
                data: null,
                error: { message: "Unknown error occurred" },
            };
        }
    }
    
    private isNetworkError(err: Error): boolean {
        return (
            err.message.includes("network") ||
            err.message.includes("ECONNREFUSED") ||
            err.message.includes("ETIMEDOUT") ||
            err.message.includes("fetch failed")
        );
    }
    
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    
    private getHeaders(useServiceRole = false): Record<string, string> {
        const key = useServiceRole && this.serviceRoleKey ? this.serviceRoleKey : this.supabaseKey;
        return {
            "apikey": key,
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        };
    }
    
    /**
     * Select rows from a table
     */
    async select<T = unknown>(
        tableName: string,
        options: QueryOptions = {}
    ): Promise<SupabaseResponse<T[]>> {
        const sanitizedTable = this.sanitizeTableName(tableName);
        const url = new URL(`${this.supabaseUrl}/rest/v1/${sanitizedTable}`);
        
        if (options.select) {
            url.searchParams.set("select", this.sanitizeSelectColumns(options.select));
        }
        
        if (options.filter) {
            const filterParams = this.buildFilterQuery(options.filter);
            filterParams.forEach((value, key) => {
                url.searchParams.append(key, value);
            });
        }
        
        if (options.order) {
            const direction = options.order.ascending ? "asc" : "desc";
            url.searchParams.set("order", `${options.order.column}.${direction}`);
        }
        
        if (options.limit !== undefined) {
            if (options.limit < 0 || options.limit > 1000) {
                throw new Error("Limit must be between 0 and 1000");
            }
            url.searchParams.set("limit", options.limit.toString());
        }
        
        if (options.offset !== undefined) {
            if (options.offset < 0) {
                throw new Error("Offset must be non-negative");
            }
            url.searchParams.set("offset", options.offset.toString());
        }
        
        const headers = this.getHeaders();
        if (options.single) {
            headers["Accept"] = "application/vnd.pgrst.object+json";
        }
        
        return this.requestWithRetry<T[]>(url.toString(), {
            method: "GET",
            headers,
        });
    }
    
    /**
     * Insert rows into a table
     */
    async insert<T = unknown>(
        tableName: string,
        data: Record<string, unknown> | Record<string, unknown>[],
        options: { upsert?: boolean; onConflict?: string } = {}
    ): Promise<SupabaseResponse<T[]>> {
        const sanitizedTable = this.sanitizeTableName(tableName);
        const url = new URL(`${this.supabaseUrl}/rest/v1/${sanitizedTable}`);
        
        if (options.onConflict) {
            url.searchParams.set("on_conflict", options.onConflict);
        }
        
        const headers = this.getHeaders();
        if (options.upsert) {
            headers["Prefer"] = "resolution=merge-duplicates,return=representation";
        }
        
        return this.requestWithRetry<T[]>(url.toString(), {
            method: "POST",
            headers,
            body: JSON.stringify(data),
        });
    }
    
    /**
     * Update rows in a table
     */
    async update<T = unknown>(
        tableName: string,
        data: Record<string, unknown>,
        filter: Record<string, unknown>
    ): Promise<SupabaseResponse<T[]>> {
        const sanitizedTable = this.sanitizeTableName(tableName);
        const url = new URL(`${this.supabaseUrl}/rest/v1/${sanitizedTable}`);
        
        // Filter is required for update to prevent accidental full table updates
        if (!filter || Object.keys(filter).length === 0) {
            throw new Error("Filter is required for update operations to prevent accidental full table updates");
        }
        
        const filterParams = this.buildFilterQuery(filter);
        filterParams.forEach((value, key) => {
            url.searchParams.append(key, value);
        });
        
        return this.requestWithRetry<T[]>(url.toString(), {
            method: "PATCH",
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        });
    }
    
    /**
     * Delete rows from a table
     */
    async delete<T = unknown>(
        tableName: string,
        filter: Record<string, unknown>
    ): Promise<SupabaseResponse<T[]>> {
        const sanitizedTable = this.sanitizeTableName(tableName);
        const url = new URL(`${this.supabaseUrl}/rest/v1/${sanitizedTable}`);
        
        // Filter is required for delete to prevent accidental full table deletion
        if (!filter || Object.keys(filter).length === 0) {
            throw new Error("Filter is required for delete operations to prevent accidental full table deletion");
        }
        
        const filterParams = this.buildFilterQuery(filter);
        filterParams.forEach((value, key) => {
            url.searchParams.append(key, value);
        });
        
        return this.requestWithRetry<T[]>(url.toString(), {
            method: "DELETE",
            headers: this.getHeaders(),
        });
    }
    
    /**
     * Call an RPC (Remote Procedure Call) function
     */
    async rpc<T = unknown>(
        functionName: string,
        params: Record<string, unknown> = {}
    ): Promise<SupabaseResponse<T>> {
        // Validate function name
        const sanitizedName = functionName.replace(/[^a-zA-Z0-9_]/g, "");
        if (sanitizedName !== functionName) {
            throw new Error(`Invalid function name: "${functionName}"`);
        }
        
        const url = `${this.supabaseUrl}/rest/v1/rpc/${sanitizedName}`;
        
        return this.requestWithRetry<T>(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(params),
        });
    }
    
    /**
     * Get storage bucket information
     */
    async listBuckets(): Promise<SupabaseResponse<unknown[]>> {
        const url = `${this.supabaseUrl}/storage/v1/bucket`;
        
        return this.requestWithRetry(url, {
            method: "GET",
            headers: this.getHeaders(true), // Storage operations typically need service role
        });
    }
    
    /**
     * List files in a storage bucket
     */
    async listFiles(
        bucketName: string,
        path = "",
        options: { limit?: number; offset?: number } = {}
    ): Promise<SupabaseResponse<unknown[]>> {
        // Validate bucket name
        if (!/^[\w-]+$/.test(bucketName)) {
            throw new Error(`Invalid bucket name: "${bucketName}"`);
        }
        
        const url = `${this.supabaseUrl}/storage/v1/object/list/${bucketName}`;
        
        return this.requestWithRetry(url, {
            method: "POST",
            headers: this.getHeaders(true),
            body: JSON.stringify({
                prefix: path,
                limit: options.limit ?? 100,
                offset: options.offset ?? 0,
            }),
        });
    }
    
    /**
     * Get a signed URL for a private file
     */
    async createSignedUrl(
        bucketName: string,
        filePath: string,
        expiresIn = 3600
    ): Promise<SupabaseResponse<{ signedUrl: string }>> {
        // Validate bucket name
        if (!/^[\w-]+$/.test(bucketName)) {
            throw new Error(`Invalid bucket name: "${bucketName}"`);
        }
        
        // Validate expiry time (max 1 week)
        if (expiresIn < 1 || expiresIn > 604800) {
            throw new Error("Expiry time must be between 1 second and 1 week (604800 seconds)");
        }
        
        const url = `${this.supabaseUrl}/storage/v1/object/sign/${bucketName}/${filePath}`;
        
        return this.requestWithRetry(url, {
            method: "POST",
            headers: this.getHeaders(true),
            body: JSON.stringify({ expiresIn }),
        });
    }
}
