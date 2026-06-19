"""Dashboard + daily / weekly / monthly reports."""
from collections import Counter
from datetime import date, timedelta
from fastapi import APIRouter, Depends

from ..database import db
from ..deps import get_current_user, CurrentUser
from ..schemas import DashboardOut, ReportOut
from ..services import today_ist

router = APIRouter(prefix="/reports", tags=["reports"])

DONE = "આપી દીધો"
PENDING = "ઓર્ડર બાકી"
READY = "તૈયાર"


def _orders_between(start: date, end: date) -> list[dict]:
    res = (db().table("orders")
           .select("*, order_items(item_name, quantity)")
           .eq("deleted", False)
           .gte("pickup_date", start.isoformat())
           .lte("pickup_date", end.isoformat())
           .execute())
    return res.data


# ----------------------------------------------------------------------
@router.get("/dashboard", response_model=DashboardOut)
def dashboard(user: CurrentUser = Depends(get_current_user)):
    today = today_ist()
    tomorrow = today + timedelta(days=1)
    todays = _orders_between(today, today)
    tomorrows = _orders_between(tomorrow, tomorrow)

    # Pending payments across all active (non-deleted) orders
    pend = (db().table("orders").select("remaining_amount")
            .eq("deleted", False).neq("payment_status", "પૂર્ણ ચૂકવણી").execute())

    return DashboardOut(
        todays_orders=len(todays),
        pending_orders=sum(1 for o in todays if o["order_status"] == PENDING),
        ready_orders=sum(1 for o in todays if o["order_status"] == READY),
        completed_orders=sum(1 for o in todays if o["order_status"] == DONE),
        pending_payments_amount=round(sum(float(o["remaining_amount"]) for o in pend.data), 2),
        todays_revenue=round(sum(float(o["advance_amount"]) for o in todays), 2),
        tomorrows_orders=len(tomorrows),
    )


def _build_report(period: str, start: date, end: date) -> ReportOut:
    orders = _orders_between(start, end)
    completed = [o for o in orders if o["order_status"] == DONE]
    pending = [o for o in orders if o["order_status"] != DONE]

    item_counter: Counter = Counter()
    for o in orders:
        for oi in (o.get("order_items") or []):
            item_counter[oi["item_name"]] += oi["quantity"]
    most = [{"item": name, "quantity": qty}
            for name, qty in item_counter.most_common(10)]

    return ReportOut(
        period=period, start_date=start, end_date=end,
        total_orders=len(orders),
        completed_orders=len(completed),
        pending_orders=len(pending),
        revenue=round(sum(float(o["advance_amount"]) for o in orders), 2),
        pending_amount=round(sum(float(o["remaining_amount"]) for o in orders), 2),
        most_ordered_items=most,
    )


@router.get("/daily", response_model=ReportOut)
def daily(day: date | None = None, user: CurrentUser = Depends(get_current_user)):
    d = day or today_ist()
    return _build_report("daily", d, d)


@router.get("/weekly", response_model=ReportOut)
def weekly(user: CurrentUser = Depends(get_current_user)):
    end = today_ist()
    start = end - timedelta(days=6)
    return _build_report("weekly", start, end)


@router.get("/monthly", response_model=ReportOut)
def monthly(user: CurrentUser = Depends(get_current_user)):
    today = today_ist()
    start = today.replace(day=1)
    return _build_report("monthly", start, today)
