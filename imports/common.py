import re
import unicodedata
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

import pandas as pd

# Fecha base para convertir números de serie de Excel a fechas reales.
# Excel considera 1900 un año bisiesto (no lo es) y por eso la conversión
# estándar usa 1899-12-30 como "día cero", no 1900-01-01. openpyxl/pandas
# heredan esta misma convención cuando una celda de fecha se lee como número
# porque la columna de origen no quedó formateada como fecha en el Excel.
_EXCEL_EPOCH = datetime(1899, 12, 30)

CURRENCY_SYMBOLS = ("S/.", "S/", "US$", "USD", "$", "PEN")


def is_empty(value) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and pd.isna(value):
        return True
    if isinstance(value, str) and not value.strip():
        return True
    return False


def clean_str(value) -> str | None:
    if is_empty(value):
        return None
    text = str(value).strip()
    return text or None


def parse_date_flexible(value) -> date | None:
    """Acepta datetime/date de openpyxl, texto en varios formatos, o números
    de serie de Excel (cuando la celda no quedó formateada como fecha)."""
    if is_empty(value):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        try:
            return (_EXCEL_EPOCH + timedelta(days=float(value))).date()
        except (OverflowError, ValueError) as exc:
            raise ValueError(f"fecha inválida: '{value}'") from exc

    text = str(value).strip()
    if text.replace(".", "", 1).isdigit():
        try:
            return (_EXCEL_EPOCH + timedelta(days=float(text))).date()
        except (OverflowError, ValueError):
            pass

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"fecha inválida: '{value}' (usa el formato AAAA-MM-DD o DD/MM/AAAA)")


def parse_decimal_flexible(
    value, field_name: str, required: bool = False, default: Decimal | None = None
) -> Decimal | None:
    """Acepta números con símbolos de moneda (S/, $) y separadores de miles,
    además de números planos."""
    if is_empty(value):
        if required:
            raise ValueError(f"{field_name} es obligatorio")
        return default
    if isinstance(value, (int, float)):
        return Decimal(str(value))

    text = str(value).strip()
    for symbol in CURRENCY_SYMBOLS:
        text = text.replace(symbol, "")
    text = text.strip()

    if "," in text and "." in text:
        text = text.replace(",", "")
    elif "," in text:
        partes = text.rsplit(",", 1)
        if len(partes) == 2 and len(partes[1]) <= 2:
            text = text.replace(",", ".")
        else:
            text = text.replace(",", "")

    try:
        return Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"{field_name} inválido: '{value}'") from exc


def parse_int_flexible(value, field_name: str, default: int = 0) -> int:
    if is_empty(value):
        return default
    try:
        return int(float(str(value).strip().replace(",", "")))
    except (ValueError, TypeError) as exc:
        raise ValueError(f"{field_name} inválido: '{value}'") from exc


def parse_bool_flexible(value) -> bool:
    if is_empty(value):
        return False
    text = str(value).strip().lower()
    return text in {"si", "sí", "yes", "true", "1", "x"}


_LEGAL_SUFFIXES = re.compile(
    r"\b(s\.?a\.?c\.?|s\.?a\.?|s\.?r\.?l\.?|e\.?i\.?r\.?l\.?|sac|sa|srl|eirl)\b\.?\s*$",
    re.IGNORECASE,
)


def normalize_match_key(text: str) -> str:
    """Normaliza un nombre para comparación tolerante: quita acentos, colapsa
    espacios múltiples, pasa a minúsculas y quita sufijos legales comunes
    (SAC, S.A., SRL, EIRL...) para que 'Oregon Foods S.A.C.' y 'oregon  foods'
    se reconozcan como la misma empresa."""
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKD", text)
    normalized = "".join(c for c in normalized if not unicodedata.combining(c))
    normalized = normalized.strip().lower()
    normalized = re.sub(r"\s+", " ", normalized)
    normalized = _LEGAL_SUFFIXES.sub("", normalized).strip()
    return normalized
