from datetime import date
from decimal import Decimal
from uuid import uuid4

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from imports.common import clean_str, parse_decimal_flexible, parse_int_flexible
from models.printer_leasing import CostCenter, PrinterConsumption

EXPECTED_COLUMNS = ["centro_costo", "usuario", "proceso", "anio", "mes", "consumo"]


def validate_and_prepare(
    df: pd.DataFrame, db: Session
) -> tuple[list[PrinterConsumption], list[PrinterConsumption], list[dict]]:
    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias en el Excel: {', '.join(missing)}")

    cost_centers_by_name = {cc.name.strip().lower(): cc for cc in db.scalars(select(CostCenter))}
    existing = {
        (row.cost_center_id, row.usuario.strip().lower(), row.anio, row.mes): row
        for row in db.scalars(select(PrinterConsumption))
    }

    to_create: list[PrinterConsumption] = []
    to_update: list[PrinterConsumption] = []
    errors: list[dict] = []
    seen_in_file: dict[tuple, PrinterConsumption] = {}

    today = date.today()

    for idx, row in df.iterrows():
        fila = int(idx) + 2
        try:
            centro_raw = clean_str(row.get("centro_costo"))
            if not centro_raw:
                raise ValueError("centro_costo es obligatorio (identifica a qué centro pertenece el consumo)")
            cost_center = cost_centers_by_name.get(centro_raw.strip().lower())
            if not cost_center:
                raise ValueError(f"centro de costo no reconocido: '{centro_raw}' (regístralo primero)")

            usuario = clean_str(row.get("usuario")) or f"Usuario sin especificar (fila {fila})"

            proceso = clean_str(row.get("proceso")) or cost_center.proceso

            anio = parse_int_flexible(row.get("anio"), "anio", default=today.year)
            mes = parse_int_flexible(row.get("mes"), "mes", default=today.month)
            if not 1 <= mes <= 12:
                raise ValueError(f"mes inválido: {mes} (debe estar entre 1 y 12)")

            consumo = parse_decimal_flexible(row.get("consumo"), "consumo", default=Decimal("0"))
            if consumo < 0:
                raise ValueError("consumo no puede ser negativo")

            key = (cost_center.id, usuario.strip().lower(), anio, mes)
            data = {
                "cost_center_id": cost_center.id,
                "usuario": usuario,
                "proceso": proceso,
                "anio": anio,
                "mes": mes,
                "consumo": consumo,
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
                target = PrinterConsumption(**data)
                db.add(target)
                to_create.append(target)

            seen_in_file[key] = target

        except ValueError as exc:
            errors.append({"fila": fila, "mensaje": str(exc)})
        except Exception as exc:  # noqa: BLE001
            errors.append({"fila": fila, "mensaje": f"error inesperado: {exc}"})

    return to_create, to_update, errors
