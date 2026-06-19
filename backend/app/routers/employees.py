"""Employee management — Admin only (add / remove / reset password / logs)."""
from fastapi import APIRouter, Depends, HTTPException, status

from ..database import db
from ..security import hash_password
from ..deps import require_admin, CurrentUser
from ..schemas import EmployeeCreate, EmployeeOut, PasswordReset
from ..services import log_action

router = APIRouter(prefix="/employees", tags=["employees"])


def _out(e: dict) -> EmployeeOut:
    return EmployeeOut(id=e["id"], name=e["name"], mobile=e["mobile"],
                       role=e["role"], active=e.get("active", True),
                       created_at=e.get("created_at"))


@router.get("", response_model=list[EmployeeOut])
def list_employees(admin: CurrentUser = Depends(require_admin)):
    res = db().table("employees").select("*").order("created_at").execute()
    return [_out(e) for e in res.data]


@router.post("", response_model=EmployeeOut, status_code=201)
def add_employee(body: EmployeeCreate, admin: CurrentUser = Depends(require_admin)):
    exists = db().table("employees").select("id").eq("mobile", body.mobile).execute()
    if exists.data:
        raise HTTPException(status.HTTP_409_CONFLICT, "આ મોબાઇલ નંબર પહેલેથી છે")
    payload = {
        "name": body.name,
        "mobile": body.mobile,
        "password_hash": hash_password(body.password),
        "role": body.role,
    }
    res = db().table("employees").insert(payload).execute()
    log_action(admin.id, "employee.create", "employee", res.data[0]["id"],
               {"name": body.name, "role": body.role})
    return _out(res.data[0])


@router.post("/{employee_id}/reset-password", response_model=EmployeeOut)
def reset_password(employee_id: str, body: PasswordReset,
                   admin: CurrentUser = Depends(require_admin)):
    res = db().table("employees").update(
        {"password_hash": hash_password(body.new_password)}
    ).eq("id", employee_id).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "કર્મચારી મળ્યો નથી")
    log_action(admin.id, "employee.reset_password", "employee", employee_id)
    return _out(res.data[0])


@router.delete("/{employee_id}", status_code=204)
def remove_employee(employee_id: str, admin: CurrentUser = Depends(require_admin)):
    if employee_id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "તમે તમારું પોતાનું ખાતું દૂર કરી શકતા નથી")
    # Soft-deactivate rather than hard delete (orders reference created_by).
    res = db().table("employees").update({"active": False}).eq("id", employee_id).execute()
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "કર્મચારી મળ્યો નથી")
    log_action(admin.id, "employee.deactivate", "employee", employee_id)


@router.get("/logs")
def system_logs(limit: int = 200, admin: CurrentUser = Depends(require_admin)):
    res = (db().table("activity_log").select("*, employees(name)")
           .order("created_at", desc=True).limit(min(limit, 1000)).execute())
    return res.data
