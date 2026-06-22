"""Customer lookup, history, and search."""
from fastapi import APIRouter, Depends, HTTPException, status

from ..database import db
from ..deps import get_current_user, CurrentUser
from ..schemas import CustomerCreate, CustomerOut, CustomerHistory

router = APIRouter(prefix="/customers", tags=["customers"])


def _out(c: dict) -> CustomerOut:
    return CustomerOut(id=c["id"], name_gujarati=c["name_gujarati"],
                       mobile=c["mobile"], notes=c.get("notes"),
                       created_at=c.get("created_at"))


@router.get("", response_model=list[CustomerOut])
def search_customers(q: str | None = None, user: CurrentUser = Depends(get_current_user)):
    query = db().table("customers").select("*")
    if q:
        # match by name OR mobile
        query = query.or_(f"name_gujarati.ilike.%{q}%,mobile.ilike.%{q}%")
    res = query.order("name_gujarati").limit(500).execute()
    return [_out(c) for c in res.data]


@router.post("", response_model=CustomerOut, status_code=201)
def create_customer(body: CustomerCreate, user: CurrentUser = Depends(get_current_user)):
    if body.mobile:
        exists = db().table("customers").select("*").eq("mobile", body.mobile).execute()
        if exists.data:
            return _out(exists.data[0])  # idempotent on mobile
    row = {"name_gujarati": body.name_gujarati}
    if body.mobile:
        row["mobile"] = body.mobile
    if body.notes:
        row["notes"] = body.notes
    res = db().table("customers").insert(row).execute()
    return _out(res.data[0])


@router.get("/by-mobile/{mobile}", response_model=CustomerHistory | None)
def customer_by_mobile(mobile: str, user: CurrentUser = Depends(get_current_user)):
    """Used by the New Order screen to auto-fill repeat customers."""
    res = db().table("customers").select("*").eq("mobile", mobile).execute()
    if not res.data:
        return None
    customer = res.data[0]
    orders = (db().table("orders")
              .select("pickup_date, order_items(item_name)")
              .eq("customer_id", customer["id"]).eq("deleted", False)
              .order("pickup_date", desc=True).execute())
    recent_items: list[str] = []
    for o in orders.data[:3]:
        for oi in (o.get("order_items") or []):
            if oi["item_name"] not in recent_items:
                recent_items.append(oi["item_name"])
    last_date = orders.data[0]["pickup_date"] if orders.data else None
    return CustomerHistory(
        customer=_out(customer),
        orders_count=len(orders.data),
        last_order_date=last_date,
        recent_items=recent_items[:6],
    )
