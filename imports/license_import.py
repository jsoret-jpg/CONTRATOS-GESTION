from decimal import Decimal
from uuid import uuid4

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.imports.common import clean_str, normalize_match_key, parse_date_flexible, parse_decimal_flexible
from app.models.company import Company
from app.models.license import License

EXPECTED_COLUMNS = [
    "empresa",
    "area",
    "proceso",
    "tipo",
    "usuario",
    "cuenta",
    "precio",
    "moneda",
    "fecha_renovacion",
    "observaciones",
]

MONEDAS_VALIDAS = {"PEN", "USD"}
DEFAULT_MONEDA = "PEN"


def validate_and_prepare(df: pd.DataFrame, db: Session) -> tuple[list[License], list[License], list[dict]]:
    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias en el Excel: {', '.join(missing)}")

    companies_by_key = {}
    for company in db.scalars(select(Company)):
        companies_by_key[normalize_match_key(company.name)] = company
        companies_by_key[normalize_match_key(company.code)] = company
    nombres_empresas_disponibles = ", ".join(sorted({c.name for c in companies_by_key.values()}))

    existing = {
        (lic.company_id, lic.cuenta.strip().lower(), lic.tipo.strip().lower()): lic
        for lic in db.scalars(select(License))
    }

    to_create: list[License] = []
    to_update: list[License] = []
    errors: list[dict] = []
    seen_in_file: dict[tuple, License] = {}

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

            tipo = clean_str(row.get("tipo")) or "Sin tipo"

            cuenta = clean_str(row.get("cuenta")) or f"sin-cuenta-f{fila}-{uuid4().hex[:6]}"

            area = clean_str(row.get("area"))
            proceso = clean_str(row.get("proceso"))
            usuario = clean_str(row.get("usuario"))

            precio = parse_decimal_flexible(row.get("precio"), "precio", default=Decimal("0"))

            moneda_raw = clean_str(row.get("moneda"))
            if moneda_raw:
                moneda = moneda_raw.strip().upper()
                if moneda not in MONEDAS_VALIDAS:
                    raise ValueError(f"moneda inválida: '{moneda_raw}' (usa PEN o USD)")
            else:
                moneda = DEFAULT_MONEDA

            observaciones = clean_str(row.get("observaciones"))
            fecha_renovacion = parse_date_flexible(row.get("fecha_renovacion"))

            key = (company_id, cuenta.strip().lower(), tipo.strip().lower())

            data = {
                "company_id": company_id,
                "area": area,
                "proceso": proceso,
                "tipo": tipo,
                "usuario": usuario,
                "cuenta": cuenta,
                "precio": precio,
                "moneda": moneda,
                "fecha_renovacion": fecha_renovacion,
                "observaciones": observaciones,
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
                target = License(**data)
                db.add(target)
                to_create.append(target)

            seen_in_file[key] = target

        except ValueError as exc:
            errors.append({"fila": fila, "mensaje": str(exc)})
        except Exception as exc:  # noqa: BLE001
            errors.append({"fila": fila, "mensaje": f"error inesperado: {exc}"})

    return to_create, to_update, errors
