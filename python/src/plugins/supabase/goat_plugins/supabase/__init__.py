"""
Supabase Plugin for GOAT SDK

Provides tools for interacting with Supabase:
- Database operations (select, insert, update, delete)
- RPC function calls
- Storage operations (list buckets, list files, signed URLs)

Security Features:
- Input validation and sanitization
- SQL injection prevention
- Required filters for destructive operations
- Proper error handling

Example:
    from goat_plugins.supabase import supabase, SupabasePluginOptions

    plugin = supabase(SupabasePluginOptions(
        supabase_url="https://your-project.supabase.co",
        supabase_key="your-anon-key",
        service_role_key="your-service-role-key",  # Optional
    ))
"""

from dataclasses import dataclass
from typing import Optional

from goat.classes.plugin_base import PluginBase
from .service import SupabaseService


@dataclass
class SupabasePluginOptions:
    """
    Configuration options for the Supabase plugin.
    
    Attributes:
        supabase_url: Your Supabase project URL (e.g., https://xxx.supabase.co)
        supabase_key: Your Supabase anon/public key
        service_role_key: Optional service role key for admin operations (storage, etc.)
    """
    supabase_url: str
    supabase_key: str
    service_role_key: Optional[str] = None


class SupabasePlugin(PluginBase):
    """
    Supabase Plugin for GOAT SDK.
    
    Provides secure, validated tools for interacting with Supabase
    database and storage services.
    """
    
    def __init__(self, options: SupabasePluginOptions):
        """
        Initialize the Supabase plugin.
        
        Args:
            options: Plugin configuration options
            
        Raises:
            ValueError: If required options are missing or invalid
        """
        if not options.supabase_url:
            raise ValueError("supabase_url is required for Supabase plugin")
        if not options.supabase_key:
            raise ValueError("supabase_key is required for Supabase plugin")
        
        service = SupabaseService(
            supabase_url=options.supabase_url,
            supabase_key=options.supabase_key,
            service_role_key=options.service_role_key,
        )
        
        super().__init__("supabase", [service])
    
    def supports_chain(self, chain) -> bool:
        """Supabase plugin supports all chains (it's chain-agnostic)."""
        return True


def supabase(options: SupabasePluginOptions) -> SupabasePlugin:
    """
    Factory function to create a Supabase plugin instance.
    
    Args:
        options: Plugin configuration options
        
    Returns:
        A configured SupabasePlugin instance
        
    Example:
        plugin = supabase(SupabasePluginOptions(
            supabase_url="https://your-project.supabase.co",
            supabase_key="your-anon-key",
        ))
    """
    return SupabasePlugin(options)


# Export public API
__all__ = [
    "SupabasePlugin",
    "SupabasePluginOptions",
    "supabase",
]
