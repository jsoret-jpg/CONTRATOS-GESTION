import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from imports.common import clean_str
from models.printer_leasing import CostCenter, PecuariaCompany
from utils.ceco_resolver import resolve_company_name_from_ceco

EXPECTED_COLUMNS = ["nombre", "proceso"]


def validate_and_prepare(
    df: pd.DataFrame, db: Session
) -> tuple[list[CostCenter], list[CostCenter], list[dict]]:
    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias en el Excel: {', '.join(missing)}")

    pecuarias_by_name = {p.name.strip().lower(): p for p in db.scalars(select(PecuariaCompany))}
    existing = {cc.name.strip().lower(): cc for cc in db.scalars(select(CostCenter))}

    to_create: list[CostCenter] = []
    to_update: list[CostCenter] = []
    errors: list[dict] = []
    seen_in_file: dict[str, CostCenter] = {}

    for idx, row in df.iterrows():
        fila = int(idx) + 2
        try:
            nombre = clean_str(row.get("nombre"))
            if not nombre:
                raise ValueError("nombre (CECO) es obligatorio")

            empresa_nombre = resolve_company_name_from_ceco(nombre)
            if not empresa_nombre:
                prefijo = nombre.strip().upper()[:2]
                raise ValueError(
                    f"prefijo de CECO no reconocido: '{prefijo}' (usa OF, VA, PG, MP o TA al inicio del CECO)"
                )
            pecuaria = pecuarias_by_name.get(empresa_nombre.strip().lower())
            if not pecuaria:
                raise ValueError(f"empresa '{empresa_nombre}' no está sembrada en el catálogo de pecuarias")

            proceso = clean_str(row.get("proceso"))

            key = nombre.strip().lower()
            data = {"name": nombre, "pecuaria_company_id": pecuaria.id, "proceso": proceso, "is_active": True}

            target = seen_in_file.get(key)
            if target is not None:
                for field, value in data.items():
                    setattr(target, field, value)
                continue

            target = existing.get(key)
            if target is not None:
                for field, value in data.items():
                    setattr(target, field, value)
                to_update.append(target)
            else:
                target = CostCenter(**data)
                db.add(target)
                to_create.append(target)

            seen_in_file[key] = target

        except ValueError as exc:
            errors.append({"fila": fila, "mensaje": str(exc)})
        except Exception as exc:  # noqa: BLE001
            errors.append({"fila": fila, "mensaje": f"error inesperado: {exc}"})

    return to_create, to_update, errors
