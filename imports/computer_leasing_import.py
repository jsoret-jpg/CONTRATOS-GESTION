from datetime import date
from decimal import Decimal

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from imports.common import clean_str, normalize_match_key, parse_date_flexible, parse_decimal_flexible
from models.company import Company
from models.computer_leasing import ComputerLeasing
from models.provider import Provider

EXPECTED_COLUMNS = [
    "empresa",
    "area",
    "proceso",
    "usuario",
    "precio",
    "contrato",
    "proveedor",
    "fecha_asignacion",
    "fecha_renovacion",
    "equipo",
    "modelo",
    "observaciones",
]

DEFAULT_EQUIPO = "Equipo sin especificar"


def validate_and_prepare(df: pd.DataFrame, db: Session) -> tuple[list[ComputerLeasing], list[dict]]:
    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias en el Excel: {', '.join(missing)}")

    companies_by_key = {}
    for company in db.scalars(select(Company)):
        companies_by_key[normalize_match_key(company.name)] = company
        companies_by_key[normalize_match_key(company.code)] = company
    nombres_empresas_disponibles = ", ".join(sorted({c.name for c in companies_by_key.values()}))

    providers_by_name = {normalize_match_key(p.name): p for p in db.scalars(select(Provider))}

    to_create: list[ComputerLeasing] = []
    errors: list[dict] = []

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

            equipo = clean_str(row.get("equipo")) or DEFAULT_EQUIPO

            fecha_asignacion = parse_date_flexible(row.get("fecha_asignacion")) or date.today()
            fecha_renovacion = parse_date_flexible(row.get("fecha_renovacion")) or fecha_asignacion
            if fecha_renovacion < fecha_asignacion:
                raise ValueError("fecha_renovacion no puede ser anterior a fecha_asignacion")

            precio = parse_decimal_flexible(row.get("precio"), "precio", default=Decimal("0"))

            proveedor_raw = clean_str(row.get("proveedor"))
            provider = None
            if proveedor_raw:
                provider_key = normalize_match_key(proveedor_raw)
                provider = providers_by_name.get(provider_key)
                if not provider:
                    provider = Provider(name=proveedor_raw)
                    db.add(provider)
                    db.flush()
                    providers_by_name[provider_key] = provider

            data = {
                "company_id": company_id,
                "area": clean_str(row.get("area")),
                "proceso": clean_str(row.get("proceso")),
                "usuario": clean_str(row.get("usuario")),
                "precio": precio,
                "contrato": clean_str(row.get("contrato")),
                "provider_id": provider.id if provider else None,
                "fecha_asignacion": fecha_asignacion,
                "fecha_renovacion": fecha_renovacion,
                "equipo": equipo,
                "modelo": clean_str(row.get("modelo")),
                "observaciones": clean_str(row.get("observaciones")),
            }

            target = ComputerLeasing(**data)
            db.add(target)
            to_create.append(target)

        except ValueError as exc:
            errors.append({"fila": fila, "mensaje": str(exc)})
        except Exception as exc:  # noqa: BLE001
            errors.append({"fila": fila, "mensaje": f"error inesperado: {exc}"})

    return to_create, errors
