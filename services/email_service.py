import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.notification import Notification


def send_email(to_addresses: list[str], subject: str, body: str) -> tuple[bool, str]:
    if not settings.SMTP_HOST:
        return False, "SMTP no está configurado (falta SMTP_HOST en las variables de entorno)"
    if not to_addresses:
        return False, "No hay destinatarios configurados"

    message = MIMEMultipart()
    message["From"] = settings.SMTP_FROM or settings.SMTP_USER or "no-reply@controlgestion.local"
    message["To"] = ", ".join(to_addresses)
    message["Subject"] = subject
    message.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(message["From"], to_addresses, message.as_string())
        return True, f"Correo enviado a {len(to_addresses)} destinatario(s)"
    except Exception as exc:  # noqa: BLE001
        return False, f"No se pudo enviar el correo: {exc}"


def build_digest(db: Session) -> str:
    notifications = list(db.scalars(select(Notification).where(Notification.leida.is_(False))).all())
    if not notifications:
        return "No hay alertas pendientes en Control de Gestión."

    lines = [f"Tienes {len(notifications)} alerta(s) pendiente(s) en Control de Gestión:", ""]
    for notification in notifications:
        lines.append(f"- [{notification.modulo}] {notification.mensaje}")
    return "\n".join(lines)
