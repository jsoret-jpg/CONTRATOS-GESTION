from datetime import date


def compute_dias_para_renovacion(fecha_renovacion: date, today: date | None = None) -> int:
    today = today or date.today()
    return (fecha_renovacion - today).days


def compute_renovacion_texto(dias: int) -> str:
    if dias > 0:
        return f"Faltan {dias} días"
    if dias == 0:
        return "Renovación hoy"
    return f"Vencida hace {abs(dias)} días"


def compute_renovacion_estado(dias: int) -> str:
    if dias < 0:
        return "vencida"
    if dias == 0:
        return "renovar_hoy"
    if dias <= 30:
        return "renovacion_proxima"
    if dias <= 90:
        return "proxima_renovacion"
    return "vigente"
