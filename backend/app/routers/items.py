"""Flower item (master list) management — staff + admin."""
from fastapi import APIRouter, Depends, HTTPException, status

from ..database import db
from ..deps import get_current_user, CurrentUser
from ..schemas import ItemCreate, ItemUpdate, ItemOut
from ..services import log_action

router = APIRouter(prefix="/items", tags=["items"])


def _out(i: dict) -> ItemOut:
    return ItemOut(id=i["id"], item_name_gujarati=i["item_name_gujarati"],
                   price=float(i["price"]), active=i["active"],
                   created_at=i.get("created_at"))


@router.get("", response_model=list[ItemOut])
def list_items(q: str | None = None, active_only: bool = True,
               user: CurrentUser = Depends(get_current_user)):
    query = db().table("items").select("*")
    if active_only:
        query = query.eq("active", True)
    if q:
        query = query.ilike("item_name_gujarati", f"%{q}%")
    res = query.order("item_name_gujarati").execute()
    return [_out(i) for i in res.data]


@router.post("", response_model=ItemOut, status_code=201)
def add_item(body: ItemCreate, user: CurrentUser = Depends(get_current_user)):
    res = db().table("items").insert({
        "item_name_gujarati": body.item_name_gujarati,
        "price": body.price,
        "active": body.active,
    }).execute()
    log_action(user.id, "item.create", "item", res.data[0]["id"])
    return _out(res.data[0])


@router.put("/{item_id}", response_model=ItemOut)
def edit_item(item_id: str, body: ItemUpdate,
              user: CurrentUser = Depends(get_current_user)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "કોઈ ફેરફાર નથી")
    res = db().table("items").update(patch).eq("id", item_id).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "વસ્તુ મળી નથી")
    log_action(user.id, "item.update", "item", item_id, patch)
    return _out(res.data[0])


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: str, user: CurrentUser = Depends(get_current_user)):
    """Deactivate (keep history intact). Pass nothing — soft via active=false."""
    res = db().table("items").update({"active": False}).eq("id", item_id).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "વસ્તુ મળી નથી")
    log_action(user.id, "item.delete", "item", item_id)
