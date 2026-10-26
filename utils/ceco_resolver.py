CECO_PREFIX_TO_COMPANY: dict[str, str] = {
    "OF": "Oregon Foods",
    "VA": "Valora",
    "PG": "Protein Group",
    "MP": "MP San Antonio",
    "TA": "Tecnica Avicola",
}


def resolve_company_name_from_ceco(ceco: str) -> str | None:
    """Identifica la empresa a partir de los primeros caracteres del CECO,
    sin importar el resto del código. Ejemplos: 'OF-001-123' -> Oregon Foods,
    'OF123456' -> Oregon Foods, 'VA-002-456' -> Valora."""
    if not ceco:
        return None
    prefix = ceco.strip().upper()[:2]
    return CECO_PREFIX_TO_COMPANY.get(prefix)
