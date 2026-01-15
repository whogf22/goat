import { Tool } from "@goat-sdk/core";
import { SupabaseClient } from "@supabase/supabase-js";
import { DeleteDataParameters, InsertDataParameters, ReadDataParameters, UpdateDataParameters } from "./parameters";

export class SupabaseService {
    constructor(private client: SupabaseClient) {}

    @Tool({
        description: "Read data from a Supabase table",
        name: "supabase_read",
    })
    async read(parameters: ReadDataParameters) {
        let query = this.client.from(parameters.table).select(parameters.select);

        if (parameters.filters) {
            for (const filter of parameters.filters) {
                query = query.filter(filter.column, filter.operator, filter.value);
            }
        }

        if (parameters.orderBy) {
            query = query.order(parameters.orderBy, { ascending: parameters.orderDirection === "asc" });
        }

        if (parameters.limit) {
            query = query.limit(parameters.limit);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(error.message);
        }

        return data;
    }

    @Tool({
        description: "Insert data into a Supabase table",
        name: "supabase_insert",
    })
    async insert(parameters: InsertDataParameters) {
        const { data, error } = await this.client.from(parameters.table).insert(parameters.data).select();

        if (error) {
            throw new Error(error.message);
        }

        return data;
    }

    @Tool({
        description: "Update data in a Supabase table",
        name: "supabase_update",
    })
    async update(parameters: UpdateDataParameters) {
        if (!parameters.filters || parameters.filters.length === 0) {
            throw new Error("At least one filter is required to update data.");
        }

        let query = this.client.from(parameters.table).update(parameters.data);

        for (const filter of parameters.filters) {
            query = query.filter(filter.column, filter.operator, filter.value);
        }

        const { data, error } = await query.select();

        if (error) {
            throw new Error(error.message);
        }

        return data;
    }

    @Tool({
        description: "Delete data from a Supabase table",
        name: "supabase_delete",
    })
    async delete(parameters: DeleteDataParameters) {
        if (!parameters.filters || parameters.filters.length === 0) {
            throw new Error("At least one filter is required to delete data.");
        }

        let query = this.client.from(parameters.table).delete();

        for (const filter of parameters.filters) {
            query = query.filter(filter.column, filter.operator, filter.value);
        }

        const { data, error } = await query.select();

        if (error) {
            throw new Error(error.message);
        }

        return data;
    }
}
