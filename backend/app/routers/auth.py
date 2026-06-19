"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from ..database import db
from ..security import verify_password, create_access_token
from ..deps import get_current_user, CurrentUser
from ..schemas import LoginRequest, TokenResponse, EmployeeOut, StaffLite
from ..services import log_action

router = APIRouter(prefix="/auth", tags=["auth"])


def _authenticate(password: str, name: str | None = None,
                  mobile: str | None = None) -> dict:
    query = db().table("employees").select("*")
    if name:
        query = query.eq("name", name)
    elif mobile:
        query = query.eq("mobile", mobile)
    else:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "નામ જરૂરી છે")
    res = query.execute()
    if not res.data:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "ખોટું નામ અથવા પિન")
    emp = res.data[0]
    if not emp.get("active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "આ ખાતું નિષ્ક્રિય છે")
    if not verify_password(password, emp["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "ખોટું નામ અથવા પિન")
    return emp


def _token_for(emp: dict) -> TokenResponse:
    token = create_access_token(emp["id"], emp["role"], emp["name"])
    return TokenResponse(
        access_token=token,
        employee=EmployeeOut(
            id=emp["id"], name=emp["name"], mobile=emp["mobile"],
            role=emp["role"], active=emp.get("active", True),
            created_at=emp.get("created_at"),
        ),
    )


@router.get("/staff", response_model=list[StaffLite])
def staff_list():
    """Public list of active staff names — powers the tap-to-login screen."""
    res = (db().table("employees").select("id, name")
           .eq("active", True).order("name").execute())
    return [StaffLite(id=e["id"], name=e["name"]) for e in res.data]


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    """JSON login — by staff name + PIN (or mobile fallback)."""
    emp = _authenticate(body.password, name=body.name, mobile=body.mobile)
    log_action(emp["id"], "auth.login", "employee", emp["id"])
    return _token_for(emp)


@router.post("/token", response_model=TokenResponse)
def login_oauth(form: OAuth2PasswordRequestForm = Depends()):
    """OAuth2 form login — powers the Swagger 'Authorize' button.
    username = staff name."""
    emp = _authenticate(form.password, name=form.username)
    return _token_for(emp)


@router.get("/me", response_model=EmployeeOut)
def me(user: CurrentUser = Depends(get_current_user)):
    res = db().table("employees").select("*").eq("id", user.id).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "કર્મચારી મળ્યો નથી")
    e = res.data[0]
    return EmployeeOut(id=e["id"], name=e["name"], mobile=e["mobile"],
                       role=e["role"], active=e.get("active", True),
                       created_at=e.get("created_at"))
