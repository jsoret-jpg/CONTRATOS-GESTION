import { ArrowLeft, X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  onBack?: () => void;
  children: ReactNode;
  width?: number;
}

/**
 * Ventana modal independiente: muestra únicamente lo que su contenido
 * incluye, con un botón "Cerrar" siempre presente y un botón "← Atrás"
 * opcional (cuando hay una vista anterior a la que volver dentro del mismo
 * flujo). Al cerrar, el llamador es responsable de regresar a la vista
 * principal (onClose ya hace eso).
 */
export default function Modal({ title, onClose, onBack, children, width = 640 }: ModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5vh 16px",
        zIndex: 100,
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: width, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {onBack && (
              <button className="btn-link" onClick={onBack} aria-label="Atrás" style={{ padding: 4 }}>
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 style={{ margin: 0 }}>{title}</h2>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            <X size={16} />
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
