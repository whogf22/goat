<div align="center">
<a href="https://github.com/goat-sdk/goat">

<img src="https://github.com/user-attachments/assets/5fc7f121-259c-492c-8bca-f15fe7eb830c" alt="GOAT" width="100px" height="auto" style="object-fit: contain;">
</a>
</div>

# Supabase GOAT Plugin (Python)

Interact with [Supabase](https://supabase.com/) databases and storage from your AI agents. This plugin provides secure, validated tools for database operations and file management.

## Features

- **Database Operations**: Select, insert, update, and delete rows
- **RPC Functions**: Call custom PostgreSQL functions
- **Storage Operations**: List buckets, list files, create signed URLs
- **Security First**: Input validation, SQL injection prevention, required filters for destructive operations

## Requirements

- Python 3.10+
- A Supabase project with a valid URL and API key
- Get your credentials from the [Supabase Dashboard](https://supabase.com/dashboard/project/_/settings/api)

## Installation

```bash
pip install goat-sdk-plugin-supabase
poetry add goat-sdk-plugin-supabase
```

## Setup

```python
from goat_plugins.supabase import supabase, SupabasePluginOptions
import os

plugin = supabase(SupabasePluginOptions(
    supabase_url=os.environ["SUPABASE_URL"],
    supabase_key=os.environ["SUPABASE_ANON_KEY"],
    # Optional: for storage and admin operations
    service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY"),
))
```

## Tools

### Database Tools

1. **select_rows** - Query rows from a table with filtering, ordering, and pagination
2. **insert_rows** - Insert one or more rows (supports upsert)
3. **update_rows** - Update rows matching a filter (filter required for safety)
4. **delete_rows** - Delete rows matching a filter (filter required for safety)
5. **call_rpc** - Call a PostgreSQL RPC function

### Storage Tools

6. **list_buckets** - List all storage buckets
7. **list_files** - List files in a bucket with path filtering
8. **create_signed_url** - Create a temporary signed URL for private files

## Security Features

This plugin implements several security measures:

- **Input Validation**: All table names, column names, and function names are validated using Pydantic
- **SQL Injection Prevention**: Table and column names are sanitized with regex patterns
- **Required Filters**: Update and delete operations require a filter to prevent accidental data loss
- **URL Validation**: Supabase URLs are validated to prevent SSRF attacks
- **Rate Limiting**: Automatic retry with exponential backoff for rate-limited requests
- **Timeout Protection**: Requests timeout after 30 seconds

## Examples

### Query Data

```python
# Select all users where age > 18
result = await plugin.select_rows({
    "table_name": "users",
    "select": "id,name,email",
    "filter": {"age": {"gt": 18}},
    "order": {"column": "created_at", "ascending": False},
    "limit": 10
})
```

### Insert Data

```python
# Insert a new user
result = await plugin.insert_rows({
    "table_name": "users",
    "data": {
        "name": "John Doe",
        "email": "john@example.com"
    }
})

# Upsert (insert or update on conflict)
result = await plugin.insert_rows({
    "table_name": "users",
    "data": {"id": 1, "name": "Jane Doe"},
    "upsert": True,
    "on_conflict": "id"
})
```

### Update Data

```python
# Update user's email (filter required)
result = await plugin.update_rows({
    "table_name": "users",
    "data": {"email": "newemail@example.com"},
    "filter": {"id": 1}
})
```

### Delete Data

```python
# Delete inactive users (filter required)
result = await plugin.delete_rows({
    "table_name": "users",
    "filter": {"status": "inactive"}
})
```

### Storage Operations

```python
# List files in a bucket
result = await plugin.list_files({
    "bucket_name": "avatars",
    "path": "users/",
    "limit": 50
})

# Create a signed URL (expires in 1 hour)
result = await plugin.create_signed_url({
    "bucket_name": "documents",
    "file_path": "reports/2024/q1.pdf",
    "expires_in": 3600
})
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
