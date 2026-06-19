"""Seed the three Vijay Flower Center staff with 4-digit PINs.

Deactivates any pre-existing accounts (e.g. the demo admin) so only these
three appear on the tap-to-login screen.

Run from backend/:   python -m app.seed_staff
"""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

from .database import db
from .security import hash_password

# name (Gujarati) , login PIN , dummy mobile (mobile column is required/unique)
STAFF = [
    ("રૂપલ", "1111", "9000000001"),
    ("સોનુ", "2222", "9000000002"),
    ("ગિરધર", "3333", "9000000003"),
]


def main():
    client = db()

    # Deactivate everyone first so old accounts can't log in / show on screen.
    client.table("employees").update({"active": False}).neq("id", "00000000-0000-0000-0000-000000000000").execute()

    for name, pin, mobile in STAFF:
        existing = client.table("employees").select("id").eq("name", name).execute()
        payload = {
            "name": name,
            "mobile": mobile,
            "password_hash": hash_password(pin),
            "role": "staff",
            "active": True,
        }
        if existing.data:
            client.table("employees").update(payload).eq("name", name).execute()
            action = "updated"
        else:
            client.table("employees").insert(payload).execute()
            action = "created"
        print(f"✓ {action}: {name}  (PIN {pin})")

    print("\nDone. Login on the home screen by tapping a name and entering the PIN.")


if __name__ == "__main__":
    main()
