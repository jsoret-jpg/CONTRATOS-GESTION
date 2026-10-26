from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    auth,
    budgets,
    companies,
    computer_leasing,
    contracts,
    dashboard,
    health,
    invoices,
    licenses,
    monthly_payments,
    notifications,
    printer_leasing,
    providers,
    roles,
    servicios_productos,
    solpeds,
    users,
)

app = FastAPI(title="Control de Gestión API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(companies.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(roles.router, prefix="/api")
app.include_router(providers.router, prefix="/api")
app.include_router(solpeds.router, prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(contracts.router, prefix="/api")
app.include_router(monthly_payments.router, prefix="/api")
app.include_router(licenses.router, prefix="/api")
app.include_router(computer_leasing.router, prefix="/api")
app.include_router(printer_leasing.router, prefix="/api")
app.include_router(budgets.router, prefix="/api")
app.include_router(servicios_productos.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Control de Gestión API", "docs": "/docs"}
