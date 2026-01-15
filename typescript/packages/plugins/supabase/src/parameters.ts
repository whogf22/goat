import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

/**
 * Filter operator schema for query operations
 * Supports various PostgREST operators for flexible filtering
 */
const FilterOperatorSchema = z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.object({
        eq: z.union([z.string(), z.number(), z.boolean()]).optional(),
        neq: z.union([z.string(), z.number(), z.boolean()]).optional(),
        gt: z.union([z.string(), z.number()]).optional(),
        gte: z.union([z.string(), z.number()]).optional(),
        lt: z.union([z.string(), z.number()]).optional(),
        lte: z.union([z.string(), z.number()]).optional(),
        like: z.string().optional(),
        ilike: z.string().optional(),
        in: z.array(z.union([z.string(), z.number()])).optional(),
        is: z.enum(["null", "true", "false"]).optional(),
    }),
]);

const FilterSchema = z.record(z.string(), FilterOperatorSchema);

const OrderSchema = z.object({
    column: z.string().describe("Column name to order by"),
    ascending: z.boolean().optional().default(true).describe("Sort in ascending order (default: true)"),
});

// ============================================
// Database Query Parameters
// ============================================

export class SelectRowsParameters extends createToolParameters(
    z.object({
        tableName: z
            .string()
            .min(1)
            .max(63)
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Table name must start with a letter or underscore and contain only alphanumeric characters and underscores")
            .describe("The name of the table to query"),
        select: z
            .string()
            .optional()
            .default("*")
            .describe("Columns to select, comma-separated (e.g., 'id,name,email' or '*' for all columns)"),
        filter: FilterSchema
            .optional()
            .describe("Filter conditions as key-value pairs. Values can be simple (equals) or objects with operators like {gt: 10}"),
        order: OrderSchema
            .optional()
            .describe("Order results by a column"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(1000)
            .optional()
            .default(100)
            .describe("Maximum number of rows to return (1-1000, default: 100)"),
        offset: z
            .number()
            .int()
            .min(0)
            .optional()
            .default(0)
            .describe("Number of rows to skip (for pagination)"),
    }),
) {}

export class InsertRowsParameters extends createToolParameters(
    z.object({
        tableName: z
            .string()
            .min(1)
            .max(63)
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Table name must start with a letter or underscore")
            .describe("The name of the table to insert into"),
        data: z
            .union([
                z.record(z.string(), z.unknown()),
                z.array(z.record(z.string(), z.unknown())),
            ])
            .describe("Data to insert. Can be a single object or an array of objects"),
        upsert: z
            .boolean()
            .optional()
            .default(false)
            .describe("If true, update existing rows on conflict instead of failing"),
        onConflict: z
            .string()
            .optional()
            .describe("Column(s) to check for conflicts when upserting (e.g., 'id' or 'email,tenant_id')"),
    }),
) {}

export class UpdateRowsParameters extends createToolParameters(
    z.object({
        tableName: z
            .string()
            .min(1)
            .max(63)
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Table name must start with a letter or underscore")
            .describe("The name of the table to update"),
        data: z
            .record(z.string(), z.unknown())
            .describe("Data to update as key-value pairs (column: newValue)"),
        filter: FilterSchema
            .describe("Filter conditions to identify rows to update. REQUIRED to prevent accidental full table updates"),
    }),
) {}

export class DeleteRowsParameters extends createToolParameters(
    z.object({
        tableName: z
            .string()
            .min(1)
            .max(63)
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Table name must start with a letter or underscore")
            .describe("The name of the table to delete from"),
        filter: FilterSchema
            .describe("Filter conditions to identify rows to delete. REQUIRED to prevent accidental full table deletion"),
    }),
) {}

export class CallRpcParameters extends createToolParameters(
    z.object({
        functionName: z
            .string()
            .min(1)
            .max(63)
            .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Function name must start with a letter or underscore")
            .describe("The name of the RPC function to call"),
        params: z
            .record(z.string(), z.unknown())
            .optional()
            .default({})
            .describe("Parameters to pass to the RPC function"),
    }),
) {}

// ============================================
// Storage Parameters
// ============================================

export class ListBucketsParameters extends createToolParameters(
    z.object({}),
) {}

export class ListFilesParameters extends createToolParameters(
    z.object({
        bucketName: z
            .string()
            .min(1)
            .max(63)
            .regex(/^[\w-]+$/, "Bucket name can only contain alphanumeric characters, underscores, and hyphens")
            .describe("The name of the storage bucket"),
        path: z
            .string()
            .optional()
            .default("")
            .describe("Path prefix to filter files (e.g., 'images/avatars/')"),
        limit: z
            .number()
            .int()
            .min(1)
            .max(1000)
            .optional()
            .default(100)
            .describe("Maximum number of files to return"),
        offset: z
            .number()
            .int()
            .min(0)
            .optional()
            .default(0)
            .describe("Number of files to skip (for pagination)"),
    }),
) {}

export class CreateSignedUrlParameters extends createToolParameters(
    z.object({
        bucketName: z
            .string()
            .min(1)
            .max(63)
            .regex(/^[\w-]+$/, "Bucket name can only contain alphanumeric characters, underscores, and hyphens")
            .describe("The name of the storage bucket"),
        filePath: z
            .string()
            .min(1)
            .describe("Path to the file within the bucket"),
        expiresIn: z
            .number()
            .int()
            .min(1)
            .max(604800)
            .optional()
            .default(3600)
            .describe("URL expiration time in seconds (1 second to 1 week, default: 1 hour)"),
    }),
) {}
