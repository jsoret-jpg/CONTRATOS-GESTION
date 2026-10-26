from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_permission
from models.notification import Notification, NotificationRecipient
from schemas.notification import (
    NotificationOut,
    NotificationRecipientCreate,
    NotificationRecipientOut,
    NotificationSummary,
    SendEmailResult,
)
from services.email_service import build_digest, send_email
from services.notification_service import generate_alerts

router = APIRouter(prefix="/notifications", tags=["notifications"])


# --- Rutas estáticas primero ---


@router.get(
    "/summary", response_model=NotificationSummary, dependencies=[Depends(require_permission("alerta", "view"))]
)
def notification_summary(db: Session = Depends(get_db)):
    generate_alerts(db)
    notifications = db.scalars(select(Notification)).all()
    por_tipo: dict[str, int] = {}
    no_leidas = 0
    for notification in notifications:
        por_tipo[notification.tipo] = por_tipo.get(notification.tipo, 0) + 1
        if not notification.leida:
            no_leidas += 1
    return NotificationSummary(total=len(notifications), no_leidas=no_leidas, por_tipo=por_tipo)


@router.put(
    "/read-all", response_model=dict, dependencies=[Depends(require_permission("alerta", "view"))]
)
def mark_all_read(db: Session = Depends(get_db)):
    notifications = db.scalars(select(Notification).where(Notification.leida.is_(False))).all()
    for notification in notifications:
        notification.leida = True
    db.commit()
    return {"marcadas": len(notifications)}


@router.get(
    "/recipients",
    response_model=list[NotificationRecipientOut],
    dependencies=[Depends(require_permission("alerta", "view"))],
)
def list_recipients(db: Session = Depends(get_db)):
    return db.scalars(select(NotificationRecipient).order_by(NotificationRecipient.email)).all()


@router.post(
    "/recipients",
    response_model=NotificationRecipientOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("alerta", "edit"))],
)
def create_recipient(payload: NotificationRecipientCreate, db: Session = Depends(get_db)):
    if db.scalar(select(NotificationRecipient).where(NotificationRecipient.email == payload.email)):
        raise HTTPException(status_code=400, detail="Ese correo ya está registrado")
    recipient = NotificationRecipient(email=payload.email)
    db.add(recipient)
    db.commit()
    db.refresh(recipient)
    return recipient


@router.delete(
    "/recipients/{recipient_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("alerta", "edit"))],
)
def delete_recipient(recipient_id: int, db: Session = Depends(get_db)):
    recipient = db.get(NotificationRecipient, recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado")
    db.delete(recipient)
    db.commit()


@router.post(
    "/send-email", response_model=SendEmailResult, dependencies=[Depends(require_permission("alerta", "edit"))]
)
def send_digest_email(db: Session = Depends(get_db)):
    generate_alerts(db)
    recipients = [
        r.email for r in db.scalars(select(NotificationRecipient).where(NotificationRecipient.activo.is_(True)))
    ]
    body = build_digest(db)
    success, message = send_email(recipients, "Control de Gestión — Alertas pendientes", body)
    return SendEmailResult(enviado=success, mensaje=message)


# --- Listado y acciones sobre una notificación puntual ---


@router.get("", response_model=list[NotificationOut], dependencies=[Depends(require_permission("alerta", "view"))])
def list_notifications(
    db: Session = Depends(get_db),
    leida: bool | None = Query(None),
    modulo: str | None = Query(None),
):
    generate_alerts(db)
    stmt = select(Notification)
    if leida is not None:
        stmt = stmt.where(Notification.leida.is_(leida))
    if modulo:
        stmt = stmt.where(Notification.modulo == modulo)
    stmt = stmt.order_by(Notification.created_at.desc())
    return db.scalars(stmt).all()


@router.put(
    "/{notification_id}/read",
    response_model=NotificationOut,
    dependencies=[Depends(require_permission("alerta", "view"))],
)
def mark_read(notification_id: int, db: Session = Depends(get_db)):
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    notification.leida = True
    db.commit()
    db.refresh(notification)
    return notification
