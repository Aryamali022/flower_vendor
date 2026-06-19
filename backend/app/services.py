"""Shared business logic used by the routers."""
from datetime import datetime, date, time, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, status

from .database import db
from .schemas import OrderItemIn, PAYMENT_STATUSES

# India Standard Time (the shop runs in IST). Used for "today" / late checks.
IST = timezone(timedelta(hours=5, minutes=30))


def log_action(employee_id: str, action: str, entity: str = "",
               entity_id: str = "", detail: Optional[dict] = None) -> None:
    """Best-effort activity log; never breaks the request if logging fails."""
    try:
        db().table("activity_log").insert({
            "employee_id": employee_id,
            "action": action,
            "entity": entity,
            "entity_id": str(entity_id),
            "detail": detail or {},
        }).execute()
    except Exception:
        pass


def find_or_create_customer(customer_id: Optional[str],
                            name: Optional[str],
                            mobile: Optional[str]) -> str:
    """Return a customer id, creating/looking up by mobile when needed."""
    if customer_id:
        return customer_id
    if not mobile:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "ગ્રાહક અથવા મોબાઇલ નંબર જરૂરી છે")
    existing = db().table("customers").select("id").eq("mobile", mobile).execute()
    if existing.data:
        return existing.data[0]["id"]
    if not name:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            "નવા ગ્રાહક માટે નામ જરૂરી છે")
    created = db().table("customers").insert(
        {"name_gujarati": name, "mobile": mobile}
    ).execute()
    return created.data[0]["id"]


def compute_totals(items: list[OrderItemIn], advance: float) -> tuple[float, float, str]:
    """Return (total, remaining, payment_status)."""
    total = round(sum(i.price * i.quantity for i in items), 2)
    advance = round(min(advance, total), 2)  # never over-advance
    remaining = round(total - advance, 2)
    if advance <= 0:
        payment_status = PAYMENT_STATUSES[0]      # બાકી
    elif remaining <= 0:
        payment_status = PAYMENT_STATUSES[2]      # પૂર્ણ ચૂકવણી
    else:
        payment_status = PAYMENT_STATUSES[1]      # આંશિક ચૂકવણી
    return total, remaining, payment_status


def derive_payment_status(total: float, advance: float) -> tuple[float, float, str]:
    advance = round(min(max(advance, 0), total), 2)
    remaining = round(total - advance, 2)
    if advance <= 0:
        return advance, remaining, PAYMENT_STATUSES[0]
    if remaining <= 0:
        return advance, remaining, PAYMENT_STATUSES[2]
    return advance, remaining, PAYMENT_STATUSES[1]


def is_order_late(pickup_date: str, pickup_time: str, order_status: str) -> bool:
    """Late = pickup datetime has passed and order not yet handed over."""
    if order_status == "આપી દીધો":
        return False
    try:
        d = date.fromisoformat(str(pickup_date))
        t = time.fromisoformat(str(pickup_time))
        pickup_dt = datetime.combine(d, t, tzinfo=IST)
        return datetime.now(IST) > pickup_dt
    except Exception:
        return False


def today_ist() -> date:
    return datetime.now(IST).date()


def assemble_order(order: dict, include_relations: bool = True) -> dict:
    """Flatten a Supabase order row (+ joined relations) into OrderOut shape."""
    customer = order.get("customers") or {}
    creator = order.get("employees") or {}
    raw_items = order.get("order_items") or []
    items = [{
        "id": oi["id"],
        "item_id": oi.get("item_id"),
        "item_name": oi["item_name"],
        "quantity": oi["quantity"],
        "price": float(oi["price"]),
    } for oi in raw_items]
    return {
        "id": order["id"],
        "customer_id": order["customer_id"],
        "customer_name": customer.get("name_gujarati"),
        "customer_mobile": customer.get("mobile"),
        "pickup_date": order["pickup_date"],
        "pickup_time": order["pickup_time"],
        "total_amount": float(order["total_amount"]),
        "advance_amount": float(order["advance_amount"]),
        "remaining_amount": float(order["remaining_amount"]),
        "order_status": order["order_status"],
        "payment_status": order["payment_status"],
        "notes": order.get("notes"),
        "created_by": order["created_by"],
        "created_by_name": creator.get("name"),
        "created_at": order.get("created_at"),
        "updated_at": order.get("updated_at"),
        "is_late": is_order_late(order["pickup_date"], order["pickup_time"],
                                 order["order_status"]),
        "items": items,
    }


# Select string that pulls related customer / employee / items in one query
ORDER_SELECT = (
    "*, customers(id,name_gujarati,mobile), "
    "employees!orders_created_by_fkey(id,name), "
    "order_items(*)"
)
