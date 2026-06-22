"""FastAPI application entrypoint."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles

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


@app.get("/healthz", tags=["health"])
def health():
    return {"status": "ok", "service": "flower-shop-api"}


app.include_router(auth.router)
app.include_router(employees.router)
app.include_router(items.router)
app.include_router(customers.router)
app.include_router(orders.router)
app.include_router(reports.router)

# Serve the static frontend at "/" (mounted LAST so API routes above win).
# Path is resolved relative to this file: backend/app/main.py -> repo/frontend.
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
