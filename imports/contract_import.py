from datetime import date
from uuid import uuid4

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.imports.common import (
    clean_str,
    is_empty,
    normalize_match_key,
    parse_date_flexible,
    parse_decimal_flexible,
    parse_int_flexible,
)
from models.company import Company
from models.contract import Contract
from models.provider import Provider

EXPECTED_COLUMNS = [
    "numero_contrato",
    "empresa",
    "descripcion_servicio",
    "cantidad",
    "sede",
    "fecha_inicio",
    "fecha_fin",
    "tipo_contrato",
    "monto_igv",
    "proveedor",
    "observaciones",
]

# Solo son obligatorios los campos técnicamente indispensables: el
# identificador único (para poder detectar duplicados y actualizar en vez
# de duplicar) y la empresa (es una relación NOT NULL en la base de datos,
# no se puede adivinar). Todo lo demás se importa aunque venga vacío.
DEFAULT_TIPO_CONTRATO = "Contrato"


def validate_and_prepare(
    df: pd.DataFrame, db: Session
) -> tuple[list[Contract], list[Contract], list[dict]]:
    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias en el Excel: {', '.join(missing)}")

    companies_by_key = {}
    for company in db.scalars(select(Company)):
        companies_by_key[normalize_match_key(company.name)] = company
        companies_by_key[normalize_match_key(company.code)] = company
    nombres_empresas_disponibles = ", ".join(sorted({c.name for c in companies_by_key.values()}))

    providers_by_name = {normalize_match_key(p.name): p for p in db.scalars(select(Provider))}
    existing_contracts = {c.numero_contrato.strip(): c for c in db.scalars(select(Contract))}

    to_create: list[Contract] = []
    to_update: list[Contract] = []
    errors: list[dict] = []
    seen_in_file: dict[str, Contract] = {}

    for idx, row in df.iterrows():
        fila = int(idx) + 2
        try:
            numero_contrato = clean_str(row.get("numero_contrato"))
            if not numero_contrato:
                # numero_contrato es único y no nulo en la base de datos (restricción
                # técnica real), pero no es necesario que el usuario lo escriba: si la
                # celda viene vacía, se genera uno automáticamente para no rechazar
                # la fila completa.
                numero_contrato = f"SIN-NUMERO-F{fila}-{uuid4().hex[:6].upper()}"
            numero_contrato = numero_contrato.strip()

            empresa_raw = clean_str(row.get("empresa"))
            company_id = None
            if empresa_raw:
                company = companies_by_key.get(normalize_match_key(empresa_raw))
                if not company:
                    raise ValueError(
                        f"empresa no reconocida: '{empresa_raw}'. Empresas disponibles: {nombres_empresas_disponibles}"
                    )
                company_id = company.id

            # Campos opcionales: si vienen vacíos, el registro igual se
            # importa con un valor por defecto razonable, nunca se rechaza
            # la fila completa por esto.
            descripcion_servicio = clean_str(row.get("descripcion_servicio")) or ""
            cantidad = parse_int_flexible(row.get("cantidad"), "cantidad", default=1)
            sede = clean_str(row.get("sede"))

            fecha_inicio = parse_date_flexible(row.get("fecha_inicio"))
            fecha_fin = parse_date_flexible(row.get("fecha_fin"))
            if fecha_inicio is None:
                fecha_inicio = date.today()
            if fecha_fin is None:
                fecha_fin = fecha_inicio
            if fecha_fin < fecha_inicio:
                raise ValueError("fecha_fin no puede ser anterior a fecha_inicio")

            tipo_contrato = clean_str(row.get("tipo_contrato")) or DEFAULT_TIPO_CONTRATO

            monto_igv = parse_decimal_flexible(row.get("monto_igv"), "monto_igv", default=None)
            if monto_igv is None:
                monto_igv_valor = 0
            else:
                monto_igv_valor = monto_igv

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

            observaciones = clean_str(row.get("observaciones"))

            data = {
                "numero_contrato": numero_contrato,
                "company_id": company_id,
                "descripcion_servicio": descripcion_servicio,
                "cantidad": cantidad,
                "sede": sede,
                "fecha_inicio": fecha_inicio,
                "fecha_fin": fecha_fin,
                "tipo_contrato": tipo_contrato,
                "monto_igv": monto_igv_valor,
                "provider_id": provider.id if provider else None,
                "observaciones": observaciones,
            }

            target = seen_in_file.get(numero_contrato)
            if target is not None:
                for field, value in data.items():
                    setattr(target, field, value)
                continue

            target = existing_contracts.get(numero_contrato)
            if target is not None:
                for field, value in data.items():
                    setattr(target, field, value)
                to_update.append(target)
            else:
                target = Contract(**data)
                db.add(target)
                to_create.append(target)

            seen_in_file[numero_contrato] = target

        except ValueError as exc:
            errors.append({"fila": fila, "mensaje": str(exc)})
        except Exception as exc:  # noqa: BLE001
            errors.append({"fila": fila, "mensaje": f"error inesperado: {exc}"})

    return to_create, to_update, errors
