"""FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from .config import settings
from .routers import auth, employees, items, customers, orders, reports

app = FastAPI(
    title="ફૂલ દુકાન ઓર્ડર સિસ્ટમ API",
    description="Flower Shop Order Management System backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc: RequestValidationError):
    # Return a friendly, single-message error for the UI
    first = exc.errors()[0] if exc.errors() else {}
    msg = first.get("msg", "અમાન્ય માહિતી")
    return JSONResponse(status_code=422, content={"detail": msg})


@app.get("/", tags=["health"])
def health():
    return {"status": "ok", "service": "flower-shop-api"}


app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(items.router)
app.include_router(customers.router)
app.include_router(orders.router)
app.include_router(reports.router)
