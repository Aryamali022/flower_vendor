"""Create the first admin employee with a properly hashed password.

Usage (from the backend/ folder, with .env configured):
    python -m app.seed
    python -m app.seed --mobile 9876543210 --name "રમેશભાઈ" --password mypass

If the mobile already exists, the password is reset instead.
"""
import argparse
import sys

# Windows consoles default to cp1252; make stdout UTF-8 so Gujarati / ✓ print.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

from .database import db
from .security import hash_password


def main():
    parser = argparse.ArgumentParser(description="Seed the first admin user")
    parser.add_argument("--name", default="એડમિન")
    parser.add_argument("--mobile", default="9999999999")
    parser.add_argument("--password", default="admin123")
    args = parser.parse_args()

    client = db()
    existing = client.table("employees").select("id").eq("mobile", args.mobile).execute()
    payload = {
        "name": args.name,
        "mobile": args.mobile,
        "password_hash": hash_password(args.password),
        "role": "admin",
        "active": True,
    }
    if existing.data:
        client.table("employees").update(payload).eq("mobile", args.mobile).execute()
        print(f"✓ Updated existing admin ({args.mobile}).")
    else:
        client.table("employees").insert(payload).execute()
        print(f"✓ Created admin ({args.mobile}).")
    print(f"  Login mobile : {args.mobile}")
    print(f"  Password     : {args.password}")
    print("  ⚠ Change this password after first login.")


if __name__ == "__main__":
    main()
