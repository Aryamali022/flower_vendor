"""Supabase client singleton (service-role — backend only).

All database access in the backend goes through this client. The service
role key bypasses Row Level Security, so every endpoint is responsible for
its own authorization (see app/deps.py).
"""
from functools import lru_cache
from supabase import create_client, Client

from .config import settings


@lru_cache
def get_supabase() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. "
            "Copy backend/.env.example to backend/.env and fill them in."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


# Convenience accessor used across routers
def db() -> Client:
    return get_supabase()
