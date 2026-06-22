"""Pydantic request/response models."""
from datetime import date, time, datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

# ---- order / payment status constants (mirrors DB CHECK constraints) ----
ORDER_STATUSES = ["ઓર્ડર બાકી", "તૈયાર થઈ રહ્યું છે", "તૈયાર", "આપી દીધો"]
PAYMENT_STATUSES = ["બાકી", "આંશિક ચૂકવણી", "પૂર્ણ ચૂકવણી"]

MOBILE_RE = r"^[6-9]\d{9}$"  # Indian 10-digit mobile


# ============================ AUTH ============================
class LoginRequest(BaseModel):
    password: str                    # PIN or password
    name: Optional[str] = None       # login by staff name (primary)
    mobile: Optional[str] = None     # login by mobile (fallback)


class StaffLite(BaseModel):
    id: str
    name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    employee: "EmployeeOut"


# ========================= EMPLOYEES =========================
class EmployeeCreate(BaseModel):
    name: str = Field(min_length=1)
    mobile: str = Field(pattern=MOBILE_RE)
    password: str = Field(min_length=6)
    role: str = Field(default="staff")

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("admin", "staff"):
            raise ValueError("role must be admin or staff")
        return v


class EmployeeOut(BaseModel):
    id: str
    name: str
    mobile: str
    role: str
    active: bool
    created_at: Optional[datetime] = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=6)


# ========================= CUSTOMERS =========================
class CustomerCreate(BaseModel):
    name_gujarati: str = Field(min_length=1)
    mobile: Optional[str] = Field(default=None, pattern=MOBILE_RE)
    notes: Optional[str] = None


class CustomerOut(BaseModel):
    id: str
    name_gujarati: str
    mobile: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class CustomerHistory(BaseModel):
    customer: CustomerOut
    orders_count: int
    last_order_date: Optional[date] = None
    recent_items: list[str] = []


# =========================== ITEMS ===========================
class ItemCreate(BaseModel):
    item_name_gujarati: str = Field(min_length=1)
    active: bool = True


class ItemUpdate(BaseModel):
    item_name_gujarati: Optional[str] = None
    active: Optional[bool] = None


class ItemOut(BaseModel):
    id: str
    item_name_gujarati: str
    active: bool
    created_at: Optional[datetime] = None


# =========================== ORDERS ==========================
class OrderItemIn(BaseModel):
    item_id: Optional[str] = None          # null => one-time custom item
    item_name: str = Field(min_length=1)   # Gujarati name snapshot
    quantity: int = Field(ge=1)
    price: float = Field(ge=0)
    save_to_master: bool = False           # custom item: also add to items table


class OrderItemOut(BaseModel):
    id: str
    item_id: Optional[str] = None
    item_name: str
    quantity: int
    price: float


class OrderCreate(BaseModel):
    # customer: either an existing id, or name+mobile to find-or-create
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_mobile: Optional[str] = Field(default=None, pattern=MOBILE_RE)

    pickup_date: date
    pickup_time: time
    advance_amount: float = Field(default=0, ge=0)
    notes: Optional[str] = None
    items: list[OrderItemIn] = Field(min_length=1)

    @field_validator("items")
    @classmethod
    def non_empty(cls, v):
        if not v:
            raise ValueError("ઓછામાં ઓછી એક વસ્તુ જરૂરી છે")  # at least one item
        return v


class OrderUpdate(BaseModel):
    pickup_date: Optional[date] = None
    pickup_time: Optional[time] = None
    advance_amount: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None
    items: Optional[list[OrderItemIn]] = None


class OrderStatusUpdate(BaseModel):
    order_status: str

    @field_validator("order_status")
    @classmethod
    def valid(cls, v):
        if v not in ORDER_STATUSES:
            raise ValueError("અમાન્ય ઓર્ડર સ્થિતિ")
        return v


class PaymentUpdate(BaseModel):
    # set a new advance/paid amount; payment_status is derived automatically
    advance_amount: float = Field(ge=0)


class OrderOut(BaseModel):
    id: str
    customer_id: str
    customer_name: Optional[str] = None
    customer_mobile: Optional[str] = None
    pickup_date: date
    pickup_time: time
    total_amount: float
    advance_amount: float
    remaining_amount: float
    order_status: str
    payment_status: str
    notes: Optional[str] = None
    created_by: str
    created_by_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_late: bool = False
    items: list[OrderItemOut] = []


# =========================== REPORTS =========================
class DashboardOut(BaseModel):
    todays_orders: int
    pending_orders: int
    ready_orders: int
    completed_orders: int
    pending_payments_amount: float
    todays_revenue: float
    tomorrows_orders: int


class ReportOut(BaseModel):
    period: str
    start_date: date
    end_date: date
    total_orders: int
    completed_orders: int
    pending_orders: int
    revenue: float
    pending_amount: float
    most_ordered_items: list[dict] = []


TokenResponse.model_rebuild()
