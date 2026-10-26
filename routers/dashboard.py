from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.dashboard import DashboardSummary, GlobalInvoiceOut
from app.services.dashboard_service import build_summary, query_global_invoices

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary, dependencies=[Depends(get_current_user)])
def dashboard_summary(db: Session = Depends(get_db), anio: int | None = Query(None)):
    return build_summary(db, anio)


@router.get("/facturas", response_model=list[GlobalInvoiceOut], dependencies=[Depends(get_current_user)])
def dashboard_facturas(
    db: Session = Depends(get_db),
    estado: str | None = Query(None),
    company_id: int | None = Query(None),
):
    return query_global_invoices(db, estado, company_id)
