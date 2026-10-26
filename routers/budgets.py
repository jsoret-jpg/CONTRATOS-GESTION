from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user, require_permission
from models.budget import Budget, BudgetMovement
from models.company import Company
from models.servicio_producto import ServicioProducto
from models.user import User
from schemas.budget import (
    AnnualBudgetOut,
    AnnualBudgetUpsert,
    BudgetCreate,
    BudgetMovementOut,
    BudgetOut,
    BudgetSummary,
    BudgetUpdate,
    CompensationCreate,
)
from app.services.budget_service import (
    compute_budget_figures,
    list_annual_budgets,
    query_budgets,
    upsert_annual_budget,
)

router = APIRouter(prefix="/budgets", tags=["budgets"])


def _serialize(db: Session, budget: Budget) -> BudgetOut:
    figures = compute_budget_figures(db, budget)
    servicio_producto = db.get(ServicioProducto, budget.servicio_producto_id)
    return BudgetOut(
        id=budget.id,
        company_id=budget.company_id,
        servicio_producto_id=budget.servicio_producto_id,
        servicio_producto_nombre=servicio_producto.nombre if servicio_producto else "—",
        anio=budget.anio,
        mes=budget.mes,
        monto_mensual=budget.monto_mensual,
        monto_anual=budget.monto_anual,
        created_at=budget.created_at,
        updated_at=budget.updated_at,
        **figures,
    )


# --- Vista anual (año + empresa + servicio/producto con los 12 meses) ---


@router.get(
    "/annual", response_model=list[AnnualBudgetOut], dependencies=[Depends(require_permission("presupuesto", "view"))]
)
def list_annual(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    servicio_producto_id: int | None = Query(None),
    anio: int | None = Query(None),
):
    return list_annual_budgets(db, company_id, servicio_producto_id, anio)


@router.post(
    "/annual",
    response_model=AnnualBudgetOut,
    dependencies=[Depends(require_permission("presupuesto", "create"))],
)
def upsert_annual(payload: AnnualBudgetUpsert, db: Session = Depends(get_db)):
    if not db.get(Company, payload.company_id):
        raise HTTPException(status_code=400, detail="Empresa no válida")
    if not db.get(ServicioProducto, payload.servicio_producto_id):
        raise HTTPException(status_code=400, detail="Servicio/producto no válido")
    montos = {int(mes): monto for mes, monto in payload.montos.items()}
    resultado = upsert_annual_budget(db, payload.company_id, payload.servicio_producto_id, payload.anio, montos)
    return resultado


@router.get(
    "/summary/dashboard",
    response_model=BudgetSummary,
    dependencies=[Depends(require_permission("presupuesto", "view"))],
)
def budget_summary(
    db: Session = Depends(get_db),
    anio: int | None = Query(None),
    company_id: int | None = Query(None),
    servicio_producto_id: int | None = Query(None),
):
    budgets = query_budgets(db, company_id=company_id, servicio_producto_id=servicio_producto_id, anio=anio)
    total_asignado = Decimal("0")
    total_ejecutado = Decimal("0")
    excedidos = 0
    for budget in budgets:
        figures = compute_budget_figures(db, budget)
        total_asignado += figures["presupuesto_asignado"]
        total_ejecutado += figures["ejecutado"]
        if figures["excedido"]:
            excedidos += 1
    return BudgetSummary(
        total_asignado=total_asignado,
        total_ejecutado=total_ejecutado,
        total_disponible=total_asignado - total_ejecutado,
        presupuestos_excedidos=excedidos,
    )


@router.get("", response_model=list[BudgetOut], dependencies=[Depends(require_permission("presupuesto", "view"))])
def list_budgets(
    db: Session = Depends(get_db),
    company_id: int | None = Query(None),
    servicio_producto_id: int | None = Query(None),
    anio: int | None = Query(None),
    mes: int | None = Query(None),
):
    budgets = query_budgets(db, company_id, servicio_producto_id, anio, mes)
    return [_serialize(db, b) for b in budgets]


@router.post(
    "",
    response_model=BudgetOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("presupuesto", "create"))],
)
def create_budget(payload: BudgetCreate, db: Session = Depends(get_db)):
    if not db.get(Company, payload.company_id):
        raise HTTPException(status_code=400, detail="Empresa no válida")
    if not db.get(ServicioProducto, payload.servicio_producto_id):
        raise HTTPException(status_code=400, detail="Servicio/producto no válido")
    existing = db.scalar(
        select(Budget).where(
            Budget.company_id == payload.company_id,
            Budget.servicio_producto_id == payload.servicio_producto_id,
            Budget.anio == payload.anio,
            Budget.mes == payload.mes,
        )
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Ya existe un presupuesto para esa empresa, servicio y periodo"
        )
    budget = Budget(**payload.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return _serialize(db, budget)


@router.put(
    "/{budget_id}", response_model=BudgetOut, dependencies=[Depends(require_permission("presupuesto", "edit"))]
)
def update_budget(budget_id: int, payload: BudgetUpdate, db: Session = Depends(get_db)):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(budget, field, value)
    db.commit()
    db.refresh(budget)
    return _serialize(db, budget)


@router.delete(
    "/{budget_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("presupuesto", "delete"))],
)
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    db.delete(budget)
    db.commit()


@router.get(
    "/{budget_id}/movements",
    response_model=list[BudgetMovementOut],
    dependencies=[Depends(require_permission("presupuesto", "view"))],
)
def list_movements(budget_id: int, db: Session = Depends(get_db)):
    if not db.get(Budget, budget_id):
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    stmt = select(BudgetMovement).where(BudgetMovement.budget_id == budget_id).order_by(BudgetMovement.fecha.desc())
    return db.scalars(stmt).all()


@router.post(
    "/{budget_id}/compensations",
    response_model=BudgetMovementOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("presupuesto", "edit"))],
)
def create_compensation(
    budget_id: int,
    payload: CompensationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

    movement = BudgetMovement(
        budget_id=budget_id,
        tipo="compensacion",
        monto=payload.monto,
        fecha=payload.fecha,
        usuario_id=current_user.id,
        origen=payload.origen,
        anio_origen=payload.anio_origen,
        mes_origen=payload.mes_origen,
        motivo=payload.motivo,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


@router.delete(
    "/movements/{movement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("presupuesto", "delete"))],
)
def delete_movement(movement_id: int, db: Session = Depends(get_db)):
    movement = db.get(BudgetMovement, movement_id)
    if not movement:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    if movement.tipo == "ejecucion" and movement.solped_id:
        raise HTTPException(
            status_code=400,
            detail=(
                "Este movimiento proviene de una SOLPED; edita el monto ejecutado desde la SOLPED "
                "en vez de eliminarlo aquí"
            ),
        )
    db.delete(movement)
    db.commit()
