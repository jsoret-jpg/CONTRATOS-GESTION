from datetime import date
from decimal import Decimal
from uuid import uuid4

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.imports.common import clean_str, normalize_match_key, parse_bool_flexible, parse_decimal_flexible, parse_int_flexible
from app.models.company import Company
from app.models.monthly_payment import MonthlyPayment

EXPECTED_COLUMNS = [
    "empresa",
    "tipo_servicio",
    "anio",
    "mes",
    "monto",
    "solped_registrada",
    "factura_registrada",
    "pagada",
    "observaciones",
]

CHECKLIST_COLUMNS = ["solped_registrada", "factura_registrada"]


def validate_and_prepare(
    df: pd.DataFrame, db: Session
) -> tuple[list[MonthlyPayment], list[MonthlyPayment], list[dict]]:
    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias en el Excel: {', '.join(missing)}")

    companies_by_key = {}
    for company in db.scalars(select(Company)):
        companies_by_key[normalize_match_key(company.name)] = company
        companies_by_key[normalize_match_key(company.code)] = company
    nombres_empresas_disponibles = ", ".join(sorted({c.name for c in companies_by_key.values()}))

    existing = {
        (p.company_id, p.tipo_servicio.strip().lower(), p.anio, p.mes): p
        for p in db.scalars(select(MonthlyPayment))
    }

    to_create: list[MonthlyPayment] = []
    to_update: list[MonthlyPayment] = []
    errors: list[dict] = []
    seen_in_file: dict[tuple, MonthlyPayment] = {}

    today = date.today()

    for idx, row in df.iterrows():
        fila = int(idx) + 2
        try:
            empresa_raw = clean_str(row.get("empresa"))
            company_id = None
            if empresa_raw:
                company = companies_by_key.get(normalize_match_key(empresa_raw))
                if not company:
                    raise ValueError(
                        f"empresa no reconocida: '{empresa_raw}'. Empresas disponibles: {nombres_empresas_disponibles}"
                    )
                company_id = company.id

            tipo_servicio = clean_str(row.get("tipo_servicio"))
            if not tipo_servicio:
                tipo_servicio = f"Servicio sin nombre (fila {fila}-{uuid4().hex[:4].upper()})"

            anio = parse_int_flexible(row.get("anio"), "anio", default=today.year)
            mes = parse_int_flexible(row.get("mes"), "mes", default=today.month)
            if not 1 <= mes <= 12:
                raise ValueError(f"mes inválido: {mes} (debe estar entre 1 y 12)")

            monto = parse_decimal_flexible(row.get("monto"), "monto", default=Decimal("0"))

            checklist = {col: parse_bool_flexible(row.get(col)) for col in CHECKLIST_COLUMNS}
            pagada = parse_bool_flexible(row.get("pagada"))

            if pagada and not all(checklist.values()):
                raise ValueError(
                    "no se puede marcar 'pagada' sin completar antes solped_registrada y factura_registrada"
                )

            observaciones = clean_str(row.get("observaciones"))

            key = (company_id, tipo_servicio.strip().lower(), anio, mes)

            data = {
                "company_id": company_id,
                "tipo_servicio": tipo_servicio,
                "anio": anio,
                "mes": mes,
                "monto": monto,
                "pagada": pagada,
                "observaciones": observaciones,
                **checklist,
            }

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
                target = MonthlyPayment(**data)
                db.add(target)
                to_create.append(target)

            seen_in_file[key] = target

        except ValueError as exc:
            errors.append({"fila": fila, "mensaje": str(exc)})
        except Exception as exc:  # noqa: BLE001
            errors.append({"fila": fila, "mensaje": f"error inesperado: {exc}"})

    return to_create, to_update, errors
