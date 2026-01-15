"""
Supabase Plugin Parameters

Defines Pydantic models for all Supabase operations with proper validation.
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, field_validator
import re


class FilterOperator(BaseModel):
    """Filter operator for database queries."""
    eq: Optional[Union[str, int, float, bool]] = Field(None, description="Equal to")
    neq: Optional[Union[str, int, float, bool]] = Field(None, description="Not equal to")
    gt: Optional[Union[str, int, float]] = Field(None, description="Greater than")
    gte: Optional[Union[str, int, float]] = Field(None, description="Greater than or equal")
    lt: Optional[Union[str, int, float]] = Field(None, description="Less than")
    lte: Optional[Union[str, int, float]] = Field(None, description="Less than or equal")
    like: Optional[str] = Field(None, description="Pattern match (case-sensitive)")
    ilike: Optional[str] = Field(None, description="Pattern match (case-insensitive)")
    is_: Optional[str] = Field(None, alias="is", description="IS operator (null, true, false)")


class OrderConfig(BaseModel):
    """Configuration for ordering query results."""
    column: str = Field(..., description="Column name to order by")
    ascending: bool = Field(True, description="Sort in ascending order")
    
    @field_validator("column")
    @classmethod
    def validate_column_name(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", v):
            raise ValueError("Column name must start with a letter or underscore and contain only alphanumeric characters")
        return v


class SelectRowsParameters(BaseModel):
    """Parameters for selecting rows from a table."""
    table_name: str = Field(
        ...,
        min_length=1,
        max_length=63,
        description="The name of the table to query"
    )
    select: str = Field(
        "*",
        description="Columns to select, comma-separated (e.g., 'id,name,email' or '*' for all)"
    )
    filter: Optional[Dict[str, Any]] = Field(
        None,
        description="Filter conditions as key-value pairs"
    )
    order: Optional[OrderConfig] = Field(
        None,
        description="Order results by a column"
    )
    limit: int = Field(
        100,
        ge=1,
        le=1000,
        description="Maximum number of rows to return (1-1000)"
    )
    offset: int = Field(
        0,
        ge=0,
        description="Number of rows to skip (for pagination)"
    )
    
    @field_validator("table_name")
    @classmethod
    def validate_table_name(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", v):
            raise ValueError("Table name must start with a letter or underscore and contain only alphanumeric characters")
        return v


class InsertRowsParameters(BaseModel):
    """Parameters for inserting rows into a table."""
    table_name: str = Field(
        ...,
        min_length=1,
        max_length=63,
        description="The name of the table to insert into"
    )
    data: Union[Dict[str, Any], List[Dict[str, Any]]] = Field(
        ...,
        description="Data to insert. Can be a single object or an array of objects"
    )
    upsert: bool = Field(
        False,
        description="If true, update existing rows on conflict instead of failing"
    )
    on_conflict: Optional[str] = Field(
        None,
        description="Column(s) to check for conflicts when upserting"
    )
    
    @field_validator("table_name")
    @classmethod
    def validate_table_name(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", v):
            raise ValueError("Table name must start with a letter or underscore")
        return v
    
    @field_validator("data")
    @classmethod
    def validate_data(cls, v: Union[Dict[str, Any], List[Dict[str, Any]]]) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
        if isinstance(v, list):
            if len(v) == 0:
                raise ValueError("Data array cannot be empty")
        elif isinstance(v, dict):
            if len(v) == 0:
                raise ValueError("Data object cannot be empty")
        return v


class UpdateRowsParameters(BaseModel):
    """Parameters for updating rows in a table."""
    table_name: str = Field(
        ...,
        min_length=1,
        max_length=63,
        description="The name of the table to update"
    )
    data: Dict[str, Any] = Field(
        ...,
        description="Data to update as key-value pairs (column: newValue)"
    )
    filter: Dict[str, Any] = Field(
        ...,
        description="Filter conditions to identify rows to update. REQUIRED to prevent accidental full table updates"
    )
    
    @field_validator("table_name")
    @classmethod
    def validate_table_name(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", v):
            raise ValueError("Table name must start with a letter or underscore")
        return v
    
    @field_validator("data")
    @classmethod
    def validate_data(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if len(v) == 0:
            raise ValueError("Update data cannot be empty")
        return v
    
    @field_validator("filter")
    @classmethod
    def validate_filter(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if len(v) == 0:
            raise ValueError("Filter is required for update operations")
        return v


class DeleteRowsParameters(BaseModel):
    """Parameters for deleting rows from a table."""
    table_name: str = Field(
        ...,
        min_length=1,
        max_length=63,
        description="The name of the table to delete from"
    )
    filter: Dict[str, Any] = Field(
        ...,
        description="Filter conditions to identify rows to delete. REQUIRED to prevent accidental full table deletion"
    )
    
    @field_validator("table_name")
    @classmethod
    def validate_table_name(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", v):
            raise ValueError("Table name must start with a letter or underscore")
        return v
    
    @field_validator("filter")
    @classmethod
    def validate_filter(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        if len(v) == 0:
            raise ValueError("Filter is required for delete operations")
        return v


class CallRpcParameters(BaseModel):
    """Parameters for calling an RPC function."""
    function_name: str = Field(
        ...,
        min_length=1,
        max_length=63,
        description="The name of the RPC function to call"
    )
    params: Dict[str, Any] = Field(
        default_factory=dict,
        description="Parameters to pass to the RPC function"
    )
    
    @field_validator("function_name")
    @classmethod
    def validate_function_name(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", v):
            raise ValueError("Function name must start with a letter or underscore")
        return v


class ListBucketsParameters(BaseModel):
    """Parameters for listing storage buckets."""
    pass


class ListFilesParameters(BaseModel):
    """Parameters for listing files in a storage bucket."""
    bucket_name: str = Field(
        ...,
        min_length=1,
        max_length=63,
        description="The name of the storage bucket"
    )
    path: str = Field(
        "",
        description="Path prefix to filter files"
    )
    limit: int = Field(
        100,
        ge=1,
        le=1000,
        description="Maximum number of files to return"
    )
    offset: int = Field(
        0,
        ge=0,
        description="Number of files to skip (for pagination)"
    )
    
    @field_validator("bucket_name")
    @classmethod
    def validate_bucket_name(cls, v: str) -> str:
        if not re.match(r"^[\w-]+$", v):
            raise ValueError("Bucket name can only contain alphanumeric characters, underscores, and hyphens")
        return v


class CreateSignedUrlParameters(BaseModel):
    """Parameters for creating a signed URL."""
    bucket_name: str = Field(
        ...,
        min_length=1,
        max_length=63,
        description="The name of the storage bucket"
    )
    file_path: str = Field(
        ...,
        min_length=1,
        description="Path to the file within the bucket"
    )
    expires_in: int = Field(
        3600,
        ge=1,
        le=604800,
        description="URL expiration time in seconds (1 second to 1 week)"
    )
    
    @field_validator("bucket_name")
    @classmethod
    def validate_bucket_name(cls, v: str) -> str:
        if not re.match(r"^[\w-]+$", v):
            raise ValueError("Bucket name can only contain alphanumeric characters, underscores, and hyphens")
        return v
