"""Order management — the heart of the system.

Includes the Live Order Queue (sorted by pickup time, late orders first),
create / edit / soft-delete, status & payment updates, and search.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..database import db
from ..deps import get_current_user, CurrentUser
from ..schemas import (
    OrderCreate, OrderUpdate, OrderOut, OrderStatusUpdate, PaymentUpdate,
    OrderItemIn,
)
from ..services import (
    find_or_create_customer, compute_totals, derive_payment_status,
    assemble_order, log_action, ORDER_SELECT, is_order_late,
)

router = APIRouter(prefix="/orders", tags=["orders"])


# ----------------------------------------------------------------------
#  helpers
# ----------------------------------------------------------------------
def _persist_items(order_id: str, items: list[OrderItemIn], created_by: str):
    """Insert order_items rows; optionally promote custom items to master."""
    rows = []
    for it in items:
        item_id = it.item_id
        if item_id is None and it.save_to_master:
            created = db().table("items").insert({
                "item_name_gujarati": it.item_name, "price": it.price,
            }).execute()
            item_id = created.data[0]["id"]
        rows.append({
            "order_id": order_id, "item_id": item_id,
            "item_name": it.item_name, "quantity": it.quantity, "price": it.price,
        })
    db().table("order_items").insert(rows).execute()


def _fetch_order(order_id: str) -> dict:
    res = db().table("orders").select(ORDER_SELECT).eq("id", order_id).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ઓર્ડર મળ્યો નથી")
    return res.data[0]


def _sort_queue(orders: list[dict]) -> list[dict]:
    """Late orders first, then by pickup datetime ascending."""
    def key(o):
        late = o["is_late"]
        return (0 if late else 1, o["pickup_date"], o["pickup_time"])
    return sorted(orders, key=key)


# ----------------------------------------------------------------------
#  Live queue
# ----------------------------------------------------------------------
@router.get("/queue", response_model=list[OrderOut])
def live_queue(include_done: bool = False,
               user: CurrentUser = Depends(get_current_user)):
    """Live Order Queue — the home screen. Pending/active orders, late first."""
    query = (db().table("orders").select(ORDER_SELECT)
             .eq("deleted", False))
    if not include_done:
        query = query.neq("order_status", "આપી દીધો")
    res = query.execute()
    orders = [assemble_order(o) for o in res.data]
    return _sort_queue(orders)


# ----------------------------------------------------------------------
#  Pending bills  (payment not fully collected)
# ----------------------------------------------------------------------
@router.get("/pending-bills", response_model=list[OrderOut])
def pending_bills(user: CurrentUser = Depends(get_current_user)):
    res = (db().table("orders").select(ORDER_SELECT)
           .eq("deleted", False)
           .neq("payment_status", "પૂર્ણ ચૂકવણી")
           .gt("remaining_amount", 0)
           .execute())
    orders = [assemble_order(o) for o in res.data]
    # biggest dues first, then by pickup date
    orders.sort(key=lambda o: (-o["remaining_amount"], o["pickup_date"]))
    return orders


# ----------------------------------------------------------------------
#  Search / list
# ----------------------------------------------------------------------
@router.get("", response_model=list[OrderOut])
def search_orders(
    customer: str | None = Query(None, description="name or mobile"),
    order_status: str | None = None,
    payment_status: str | None = None,
    pickup_date: str | None = None,
    item: str | None = None,
    user: CurrentUser = Depends(get_current_user),
):
    query = db().table("orders").select(ORDER_SELECT).eq("deleted", False)
    if order_status:
        query = query.eq("order_status", order_status)
    if payment_status:
        query = query.eq("payment_status", payment_status)
    if pickup_date:
        query = query.eq("pickup_date", pickup_date)
    res = query.order("pickup_date", desc=True).order("pickup_time").limit(300).execute()

    orders = [assemble_order(o) for o in res.data]
    # post-filter on related fields (PostgREST can't easily filter joins here)
    if customer:
        c = customer.lower()
        orders = [o for o in orders if
                  (o["customer_name"] and c in o["customer_name"].lower())
                  or (o["customer_mobile"] and c in o["customer_mobile"])]
    if item:
        orders = [o for o in orders
                  if any(item in i["item_name"] for i in o["items"])]
    return orders


# ----------------------------------------------------------------------
#  Create
# ----------------------------------------------------------------------
@router.post("", response_model=OrderOut, status_code=201)
def create_order(body: OrderCreate, user: CurrentUser = Depends(get_current_user)):
    customer_id = find_or_create_customer(
        body.customer_id, body.customer_name, body.customer_mobile)
    total, remaining, pay_status = compute_totals(body.items, body.advance_amount)

    order = db().table("orders").insert({
        "customer_id": customer_id,
        "pickup_date": body.pickup_date.isoformat(),
        "pickup_time": body.pickup_time.isoformat(),
        "total_amount": total,
        "advance_amount": min(body.advance_amount, total),
        "remaining_amount": remaining,
        "payment_status": pay_status,
        "notes": body.notes,
        "created_by": user.id,
    }).execute().data[0]

    _persist_items(order["id"], body.items, user.id)
    log_action(user.id, "order.create", "order", order["id"],
               {"total": total, "customer_id": customer_id})
    return assemble_order(_fetch_order(order["id"]))


# ----------------------------------------------------------------------
#  Read one
# ----------------------------------------------------------------------
@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: str, user: CurrentUser = Depends(get_current_user)):
    return assemble_order(_fetch_order(order_id))


# ----------------------------------------------------------------------
#  Edit (full)  — replaces items if provided, recomputes totals
# ----------------------------------------------------------------------
@router.put("/{order_id}", response_model=OrderOut)
def edit_order(order_id: str, body: OrderUpdate,
               user: CurrentUser = Depends(get_current_user)):
    current = _fetch_order(order_id)
    if current["deleted"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "કાઢી નાખેલ ઓર્ડર")

    patch: dict = {}
    if body.pickup_date is not None:
        patch["pickup_date"] = body.pickup_date.isoformat()
    if body.pickup_time is not None:
        patch["pickup_time"] = body.pickup_time.isoformat()
    if body.notes is not None:
        patch["notes"] = body.notes

    # Determine total: from new items if given, else keep existing total
    if body.items is not None:
        db().table("order_items").delete().eq("order_id", order_id).execute()
        _persist_items(order_id, body.items, user.id)
        total = round(sum(i.price * i.quantity for i in body.items), 2)
    else:
        total = float(current["total_amount"])

    advance = body.advance_amount if body.advance_amount is not None \
        else float(current["advance_amount"])
    advance, remaining, pay_status = derive_payment_status(total, advance)
    patch.update({
        "total_amount": total, "advance_amount": advance,
        "remaining_amount": remaining, "payment_status": pay_status,
    })

    db().table("orders").update(patch).eq("id", order_id).execute()
    log_action(user.id, "order.update", "order", order_id, patch)
    return assemble_order(_fetch_order(order_id))


# ----------------------------------------------------------------------
#  Update status
# ----------------------------------------------------------------------
@router.patch("/{order_id}/status", response_model=OrderOut)
def update_status(order_id: str, body: OrderStatusUpdate,
                  user: CurrentUser = Depends(get_current_user)):
    res = db().table("orders").update({"order_status": body.order_status}) \
        .eq("id", order_id).eq("deleted", False).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ઓર્ડર મળ્યો નથી")
    log_action(user.id, "order.status", "order", order_id,
               {"status": body.order_status})
    return assemble_order(_fetch_order(order_id))


# ----------------------------------------------------------------------
#  Update payment
# ----------------------------------------------------------------------
@router.patch("/{order_id}/payment", response_model=OrderOut)
def update_payment(order_id: str, body: PaymentUpdate,
                   user: CurrentUser = Depends(get_current_user)):
    current = _fetch_order(order_id)
    total = float(current["total_amount"])
    advance, remaining, pay_status = derive_payment_status(total, body.advance_amount)
    db().table("orders").update({
        "advance_amount": advance, "remaining_amount": remaining,
        "payment_status": pay_status,
    }).eq("id", order_id).execute()
    log_action(user.id, "order.payment", "order", order_id,
               {"advance": advance, "status": pay_status})
    return assemble_order(_fetch_order(order_id))


# ----------------------------------------------------------------------
#  Soft delete
# ----------------------------------------------------------------------
@router.delete("/{order_id}", status_code=204)
def soft_delete_order(order_id: str, user: CurrentUser = Depends(get_current_user)):
    res = db().table("orders").update({
        "deleted": True, "deleted_by": user.id,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", order_id).eq("deleted", False).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ઓર્ડર મળ્યો નથી")
    log_action(user.id, "order.delete", "order", order_id)
