from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_permission
from models.provider import Provider
from schemas.provider import ProviderCreate, ProviderOut

router = APIRouter(prefix="/providers", tags=["providers"])


@router.get("", response_model=list[ProviderOut], dependencies=[Depends(require_permission("solped", "view"))])
def list_providers(db: Session = Depends(get_db)):
    stmt = select(Provider).where(Provider.is_active.is_(True)).order_by(Provider.name)
    return db.scalars(stmt).all()


@router.post(
    "",
    response_model=ProviderOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("solped", "create"))],
)
def find_or_create_provider(payload: ProviderCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Provider).where(Provider.name.ilike(payload.name)))
    if existing:
        return existing

    provider = Provider(**payload.model_dump())
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider
