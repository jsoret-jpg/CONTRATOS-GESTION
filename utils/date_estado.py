from datetime import date

# Umbrales de negocio compartidos para cualquier entidad con fecha de vencimiento:
# - vencido: la fecha de fin ya pasó
# - urgente: queda 1 mes o menos
# - proximo_vencer: quedan entre 2 y 3 meses
# - vigente: quedan más de 3 meses


def compute_meses_faltantes(fecha_fin: date, today: date | None = None) -> int:
    today = today or date.today()
    months = (fecha_fin.year - today.year) * 12 + (fecha_fin.month - today.month)
    if fecha_fin.day < today.day:
        months -= 1
    return months


def compute_estado(fecha_fin: date, today: date | None = None) -> str:
    today = today or date.today()
    if fecha_fin < today:
        return "vencido"
    meses = compute_meses_faltantes(fecha_fin, today)
    if meses <= 1:
        return "urgente"
    if meses <= 3:
        return "proximo_vencer"
    return "vigente"
