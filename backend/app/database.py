"""Supabase client singleton (service-role — backend only).

All database access in the backend goes through this client. The service
role key bypasses Row Level Security, so every endpoint is responsible for
its own authorization (see app/deps.py).
"""
from functools import lru_cache
import httpx
from supabase import create_client, Client

from .config import settings


@lru_cache
def get_supabase() -> Client:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. "
            "Copy backend/.env.example to backend/.env and fill them in."
        )
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    # The default PostgREST session uses HTTP/2 with long-lived keep-alive
    # connections. In a long-running server these go stale while idle and
    # Supabase closes them, so the next query fails with
    # `httpx.RemoteProtocolError: Server disconnected`. Swap in an HTTP/1.1
    # session that expires idle connections quickly, so a fresh connection is
    # opened instead of reusing a dead one.
    old = client.postgrest.session
    client.postgrest.session = httpx.Client(
        base_url=old.base_url,
        headers=old.headers,
        timeout=old.timeout,
        http2=False,
        limits=httpx.Limits(keepalive_expiry=5),
    )
    return client


# Convenience accessor used across routers
def db() -> Client:
    return get_supabase()
