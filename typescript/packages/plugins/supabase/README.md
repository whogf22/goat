<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Supabase GOAT Plugin

Interact with [Supabase](https://supabase.com/) databases and storage from your AI agents. This plugin provides secure, validated tools for database operations and file management.

## Features

- **Database Operations**: Select, insert, update, and delete rows
- **RPC Functions**: Call custom PostgreSQL functions
- **Storage Operations**: List buckets, list files, create signed URLs
- **Security First**: Input validation, SQL injection prevention, required filters for destructive operations

## Requirements

- A Supabase project with a valid URL and API key
- Get your credentials from the [Supabase Dashboard](https://supabase.com/dashboard/project/_/settings/api)

## Installation

```bash
npm install @goat-sdk/plugin-supabase
yarn add @goat-sdk/plugin-supabase
pnpm add @goat-sdk/plugin-supabase
```

## Setup

```typescript
import { supabase } from "@goat-sdk/plugin-supabase";

const tools = await getOnChainTools({
    plugins: [
        supabase({
            supabaseUrl: process.env.SUPABASE_URL,
            supabaseKey: process.env.SUPABASE_ANON_KEY,
            // Optional: for storage and admin operations
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        })
    ]
});
```

## Tools

### Database Tools

1. **supabase_select_rows** - Query rows from a table with filtering, ordering, and pagination
2. **supabase_insert_rows** - Insert one or more rows (supports upsert)
3. **supabase_update_rows** - Update rows matching a filter (filter required for safety)
4. **supabase_delete_rows** - Delete rows matching a filter (filter required for safety)
5. **supabase_call_rpc** - Call a PostgreSQL RPC function

### Storage Tools

6. **supabase_list_buckets** - List all storage buckets
7. **supabase_list_files** - List files in a bucket with path filtering
8. **supabase_create_signed_url** - Create a temporary signed URL for private files

## Security Features

This plugin implements several security measures:

- **Input Validation**: All table names, column names, and function names are validated
- **SQL Injection Prevention**: Table and column names are sanitized
- **Required Filters**: Update and delete operations require a filter to prevent accidental data loss
- **URL Validation**: Supabase URLs are validated to prevent SSRF attacks
- **Rate Limiting**: Automatic retry with exponential backoff for rate-limited requests
- **Timeout Protection**: Requests timeout after 30 seconds

## Examples

### Query Data

```typescript
// Select all users where age > 18
await tools.supabase_select_rows({
    tableName: "users",
    select: "id,name,email",
    filter: { age: { gt: 18 } },
    order: { column: "created_at", ascending: false },
    limit: 10
});
```

### Insert Data

```typescript
// Insert a new user
await tools.supabase_insert_rows({
    tableName: "users",
    data: {
        name: "John Doe",
        email: "john@example.com"
    }
});

// Upsert (insert or update on conflict)
await tools.supabase_insert_rows({
    tableName: "users",
    data: { id: 1, name: "Jane Doe" },
    upsert: true,
    onConflict: "id"
});
```

### Update Data

```typescript
// Update user's email (filter required)
await tools.supabase_update_rows({
    tableName: "users",
    data: { email: "newemail@example.com" },
    filter: { id: 1 }
});
```

### Delete Data

```typescript
// Delete inactive users (filter required)
await tools.supabase_delete_rows({
    tableName: "users",
    filter: { status: "inactive" }
});
```

### Storage Operations

```typescript
// List files in a bucket
await tools.supabase_list_files({
    bucketName: "avatars",
    path: "users/",
    limit: 50
});

// Create a signed URL (expires in 1 hour)
await tools.supabase_create_signed_url({
    bucketName: "documents",
    filePath: "reports/2024/q1.pdf",
    expiresIn: 3600
});
```

<footer>
<br/>
<br/>
<div>
<a href="https://github.com/goat-sdk/goat">
  <img src="https://github.com/user-attachments/assets/59fa5ddc-9d47-4d41-a51a-64f6798f94bd" alt="GOAT" width="100%" height="auto" style="object-fit: contain; max-width: 800px;">
</a>
</div>
</footer>
