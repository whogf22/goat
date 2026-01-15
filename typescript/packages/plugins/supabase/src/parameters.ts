import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class ReadDataParameters extends createToolParameters(
    z.object({
        table: z.string().describe("The table to read from"),
        select: z.string().optional().default("*").describe("The columns to select"),
        limit: z.number().optional().default(10).describe("The number of items to return"),
        orderBy: z.string().optional().describe("Column to order by"),
        orderDirection: z.enum(["asc", "desc"]).optional().default("desc").describe("Order direction"),
        filters: z
            .array(
                z.object({
                    column: z.string(),
                    operator: z.enum([
                        "eq",
                        "neq",
                        "gt",
                        "gte",
                        "lt",
                        "lte",
                        "like",
                        "ilike",
                        "is",
                        "in",
                        "cs",
                        "cd",
                        "sl",
                        "sr",
                        "nxl",
                        "nxr",
                        "adj",
                        "ov",
                        "fts",
                        "plfts",
                        "phfts",
                        "wfts",
                    ]),
                    value: z.any(),
                }),
            )
            .optional()
            .describe("Filters to apply"),
    }),
) {}

export class InsertDataParameters extends createToolParameters(
    z.object({
        table: z.string().describe("The table to insert into"),
        data: z.array(z.record(z.any())).describe("The data to insert (array of objects)"),
    }),
) {}

export class UpdateDataParameters extends createToolParameters(
    z.object({
        table: z.string().describe("The table to update"),
        data: z.record(z.any()).describe("The data to update"),
        filters: z
            .array(
                z.object({
                    column: z.string(),
                    operator: z.enum([
                        "eq",
                        "neq",
                        "gt",
                        "gte",
                        "lt",
                        "lte",
                        "like",
                        "ilike",
                        "is",
                        "in",
                        "cs",
                        "cd",
                        "sl",
                        "sr",
                        "nxl",
                        "nxr",
                        "adj",
                        "ov",
                        "fts",
                        "plfts",
                        "phfts",
                        "wfts",
                    ]),
                    value: z.any(),
                }),
            )
            .describe("Filters to identify rows to update"),
    }),
) {}

export class DeleteDataParameters extends createToolParameters(
    z.object({
        table: z.string().describe("The table to delete from"),
        filters: z
            .array(
                z.object({
                    column: z.string(),
                    operator: z.enum([
                        "eq",
                        "neq",
                        "gt",
                        "gte",
                        "lt",
                        "lte",
                        "like",
                        "ilike",
                        "is",
                        "in",
                        "cs",
                        "cd",
                        "sl",
                        "sr",
                        "nxl",
                        "nxr",
                        "adj",
                        "ov",
                        "fts",
                        "plfts",
                        "phfts",
                        "wfts",
                    ]),
                    value: z.any(),
                }),
            )
            .describe("Filters to identify rows to delete"),
    }),
) {}
