"""
Supabase Service

Provides tools for interacting with Supabase database and storage.

Security Features:
- Input validation through Pydantic schemas
- SQL injection prevention via sanitized table/column names
- Required filters for update/delete operations
- Proper error handling without exposing sensitive information
"""

import asyncio
import re
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlencode, urljoin

import aiohttp

from goat.decorators.tool import Tool
from .parameters import (
    SelectRowsParameters,
    InsertRowsParameters,
    UpdateRowsParameters,
    DeleteRowsParameters,
    CallRpcParameters,
    ListBucketsParameters,
    ListFilesParameters,
    CreateSignedUrlParameters,
)


class SupabaseService:
    """
    Supabase service for database and storage operations.
    
    Implements security best practices:
    - URL validation to prevent SSRF
    - Table/column name sanitization
    - Required filters for destructive operations
    - Retry logic with exponential backoff
    """
    
    # Request timeout in seconds
    REQUEST_TIMEOUT = 30
    
    # Maximum retry attempts
    MAX_RETRIES = 3
    
    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        service_role_key: Optional[str] = None
    ):
        """
        Initialize the Supabase service.
        
        Args:
            supabase_url: Your Supabase project URL
            supabase_key: Your Supabase anon/public key
            service_role_key: Optional service role key for admin operations
        """
        # Validate URL format to prevent SSRF attacks
        if not self._is_valid_supabase_url(supabase_url):
            raise ValueError("Invalid Supabase URL format. URL must be a valid HTTPS Supabase endpoint.")
        
        # Validate API key format
        if not supabase_key or len(supabase_key) < 20:
            raise ValueError("Invalid Supabase API key. Key appears to be malformed.")
        
        self.supabase_url = supabase_url.rstrip("/")
        self.supabase_key = supabase_key
        self.service_role_key = service_role_key
    
    def _is_valid_supabase_url(self, url: str) -> bool:
        """Validate that the URL is a proper Supabase URL to prevent SSRF attacks."""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            
            # Must be HTTPS
            if parsed.scheme != "https":
                return False
            
            # Should be a supabase domain or localhost for development
            valid_domains = [".supabase.co", ".supabase.in", "localhost", "127.0.0.1"]
            hostname = parsed.hostname or ""
            is_valid = any(
                hostname.endswith(domain) or hostname == domain.lstrip(".")
                for domain in valid_domains
            ) or "supabase" in hostname
            
            return is_valid
        except Exception:
            return False
    
    def _sanitize_table_name(self, table_name: str) -> str:
        """Sanitize table name to prevent SQL injection."""
        sanitized = re.sub(r"[^a-zA-Z0-9_]", "", table_name)
        if sanitized != table_name:
            raise ValueError(f"Invalid table name: '{table_name}'")
        if not sanitized or len(sanitized) > 63:
            raise ValueError("Table name must be between 1 and 63 characters")
        return sanitized
    
    def _sanitize_select_columns(self, select: str) -> str:
        """Sanitize column names for select queries."""
        columns = [col.strip() for col in select.split(",")]
        for col in columns:
            if not re.match(r"^[\w*().,:\s-]+$", col):
                raise ValueError(f"Invalid column specification: '{col}'")
        return ",".join(columns)
    
    def _build_filter_query(self, filter_dict: Dict[str, Any]) -> Dict[str, str]:
        """Build filter query parameters for PostgREST."""
        params = {}
        
        for key, value in filter_dict.items():
            # Validate key format
            if not re.match(r"^[\w.]+$", key):
                raise ValueError(f"Invalid filter key: '{key}'")
            
            if value is None:
                params[key] = "is.null"
            elif isinstance(value, dict):
                # Handle operator objects
                for op, op_value in value.items():
                    valid_operators = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"]
                    if op not in valid_operators:
                        raise ValueError(f"Invalid filter operator: '{op}'")
                    params[key] = f"{op}.{op_value}"
            else:
                params[key] = f"eq.{value}"
        
        return params
    
    def _get_headers(self, use_service_role: bool = False) -> Dict[str, str]:
        """Get request headers with appropriate API key."""
        key = self.service_role_key if use_service_role and self.service_role_key else self.supabase_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
    
    async def _request_with_retry(
        self,
        method: str,
        url: str,
        headers: Dict[str, str],
        json_data: Optional[Any] = None,
        retry_count: int = 0
    ) -> Dict[str, Any]:
        """Make a request with retry logic for transient errors."""
        timeout = aiohttp.ClientTimeout(total=self.REQUEST_TIMEOUT)
        
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.request(
                    method,
                    url,
                    headers=headers,
                    json=json_data
                ) as response:
                    # Handle rate limiting with exponential backoff
                    if response.status == 429 and retry_count < self.MAX_RETRIES:
                        retry_after = response.headers.get("Retry-After")
                        wait_time = int(retry_after) if retry_after else (2 ** retry_count)
                        await asyncio.sleep(wait_time)
                        return await self._request_with_retry(
                            method, url, headers, json_data, retry_count + 1
                        )
                    
                    # Handle server errors with retry
                    if response.status >= 500 and retry_count < self.MAX_RETRIES:
                        await asyncio.sleep(2 ** retry_count)
                        return await self._request_with_retry(
                            method, url, headers, json_data, retry_count + 1
                        )
                    
                    text = await response.text()
                    data = None
                    error = None
                    
                    if text:
                        try:
                            import json
                            parsed = json.loads(text)
                            if not response.ok:
                                error = {
                                    "message": parsed.get("message") or parsed.get("error") or "Unknown error",
                                    "code": parsed.get("code"),
                                    "details": parsed.get("details"),
                                    "hint": parsed.get("hint"),
                                }
                            else:
                                data = parsed
                        except Exception:
                            if not response.ok:
                                error = {"message": text or f"HTTP {response.status}"}
                    
                    if not response.ok and not error:
                        error = {"message": f"HTTP {response.status}: {response.reason}"}
                    
                    return {"data": data, "error": error}
                    
        except asyncio.TimeoutError:
            return {"data": None, "error": {"message": "Request timed out"}}
        except aiohttp.ClientError as e:
            # Retry on network errors
            if retry_count < self.MAX_RETRIES:
                await asyncio.sleep(2 ** retry_count)
                return await self._request_with_retry(
                    method, url, headers, json_data, retry_count + 1
                )
            return {"data": None, "error": {"message": str(e)}}
        except Exception as e:
            return {"data": None, "error": {"message": f"Unexpected error: {str(e)}"}}
    
    def _format_response(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Format response for consistent output."""
        if response.get("error"):
            return {
                "success": False,
                "error": response["error"].get("message", "Unknown error"),
            }
        return {
            "success": True,
            "data": response.get("data"),
        }

    @Tool({
        "description": "Select/query rows from a Supabase database table. Supports filtering, ordering, and pagination.",
        "parameters_schema": SelectRowsParameters
    })
    async def select_rows(self, parameters: dict) -> Dict[str, Any]:
        """Select rows from a Supabase table."""
        params = SelectRowsParameters(**parameters)
        
        table_name = self._sanitize_table_name(params.table_name)
        url = f"{self.supabase_url}/rest/v1/{table_name}"
        
        query_params = {}
        
        if params.select:
            query_params["select"] = self._sanitize_select_columns(params.select)
        
        if params.filter:
            query_params.update(self._build_filter_query(params.filter))
        
        if params.order:
            direction = "asc" if params.order.ascending else "desc"
            query_params["order"] = f"{params.order.column}.{direction}"
        
        if params.limit:
            query_params["limit"] = str(params.limit)
        
        if params.offset:
            query_params["offset"] = str(params.offset)
        
        if query_params:
            url = f"{url}?{urlencode(query_params)}"
        
        response = await self._request_with_retry("GET", url, self._get_headers())
        return self._format_response(response)

    @Tool({
        "description": "Insert one or more rows into a Supabase database table. Supports upsert (insert or update on conflict).",
        "parameters_schema": InsertRowsParameters
    })
    async def insert_rows(self, parameters: dict) -> Dict[str, Any]:
        """Insert rows into a Supabase table."""
        params = InsertRowsParameters(**parameters)
        
        table_name = self._sanitize_table_name(params.table_name)
        url = f"{self.supabase_url}/rest/v1/{table_name}"
        
        if params.on_conflict:
            url = f"{url}?on_conflict={params.on_conflict}"
        
        headers = self._get_headers()
        if params.upsert:
            headers["Prefer"] = "resolution=merge-duplicates,return=representation"
        
        # Performance warning for large batches
        if isinstance(params.data, list) and len(params.data) > 100:
            print(f"Warning: Inserting {len(params.data)} rows. Consider batching for better performance.")
        
        response = await self._request_with_retry("POST", url, headers, params.data)
        return self._format_response(response)

    @Tool({
        "description": "Update existing rows in a Supabase database table. REQUIRES a filter to prevent accidental full table updates.",
        "parameters_schema": UpdateRowsParameters
    })
    async def update_rows(self, parameters: dict) -> Dict[str, Any]:
        """Update rows in a Supabase table."""
        params = UpdateRowsParameters(**parameters)
        
        table_name = self._sanitize_table_name(params.table_name)
        url = f"{self.supabase_url}/rest/v1/{table_name}"
        
        # Build filter query
        filter_params = self._build_filter_query(params.filter)
        if filter_params:
            url = f"{url}?{urlencode(filter_params)}"
        
        response = await self._request_with_retry("PATCH", url, self._get_headers(), params.data)
        return self._format_response(response)

    @Tool({
        "description": "Delete rows from a Supabase database table. REQUIRES a filter to prevent accidental full table deletion.",
        "parameters_schema": DeleteRowsParameters
    })
    async def delete_rows(self, parameters: dict) -> Dict[str, Any]:
        """Delete rows from a Supabase table."""
        params = DeleteRowsParameters(**parameters)
        
        table_name = self._sanitize_table_name(params.table_name)
        url = f"{self.supabase_url}/rest/v1/{table_name}"
        
        # Build filter query
        filter_params = self._build_filter_query(params.filter)
        if filter_params:
            url = f"{url}?{urlencode(filter_params)}"
        
        response = await self._request_with_retry("DELETE", url, self._get_headers())
        return self._format_response(response)

    @Tool({
        "description": "Call a Supabase RPC (Remote Procedure Call) function.",
        "parameters_schema": CallRpcParameters
    })
    async def call_rpc(self, parameters: dict) -> Dict[str, Any]:
        """Call an RPC function."""
        params = CallRpcParameters(**parameters)
        
        # Validate function name
        function_name = re.sub(r"[^a-zA-Z0-9_]", "", params.function_name)
        if function_name != params.function_name:
            return {
                "success": False,
                "error": f"Invalid function name: '{params.function_name}'"
            }
        
        url = f"{self.supabase_url}/rest/v1/rpc/{function_name}"
        
        response = await self._request_with_retry("POST", url, self._get_headers(), params.params)
        return self._format_response(response)

    @Tool({
        "description": "List all storage buckets in your Supabase project.",
        "parameters_schema": ListBucketsParameters
    })
    async def list_buckets(self, parameters: dict) -> Dict[str, Any]:
        """List storage buckets."""
        url = f"{self.supabase_url}/storage/v1/bucket"
        
        response = await self._request_with_retry("GET", url, self._get_headers(use_service_role=True))
        return self._format_response(response)

    @Tool({
        "description": "List files in a Supabase storage bucket. Supports path filtering and pagination.",
        "parameters_schema": ListFilesParameters
    })
    async def list_files(self, parameters: dict) -> Dict[str, Any]:
        """List files in a storage bucket."""
        params = ListFilesParameters(**parameters)
        
        url = f"{self.supabase_url}/storage/v1/object/list/{params.bucket_name}"
        
        body = {
            "prefix": params.path,
            "limit": params.limit,
            "offset": params.offset,
        }
        
        response = await self._request_with_retry("POST", url, self._get_headers(use_service_role=True), body)
        return self._format_response(response)

    @Tool({
        "description": "Create a signed URL for accessing a private file in Supabase storage.",
        "parameters_schema": CreateSignedUrlParameters
    })
    async def create_signed_url(self, parameters: dict) -> Dict[str, Any]:
        """Create a signed URL for a private file."""
        params = CreateSignedUrlParameters(**parameters)
        
        url = f"{self.supabase_url}/storage/v1/object/sign/{params.bucket_name}/{params.file_path}"
        
        body = {"expiresIn": params.expires_in}
        
        response = await self._request_with_retry("POST", url, self._get_headers(use_service_role=True), body)
        return self._format_response(response)
