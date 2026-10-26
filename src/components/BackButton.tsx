import { ArrowLeft } from "lucide-react";

/**
 * Botón "← Atrás" consistente para usar en cualquier subpantalla o panel de
 * detalle (no en el modal, que ya trae el suyo propio). onClick típicamente
 * limpia el estado de "vista de detalle" para regresar a la lista principal
 * del módulo.
 */
export default function BackButton({ onClick, label = "Atrás" }: { onClick: () => void; label?: string }) {
  return (
    <button className="btn btn-secondary" onClick={onClick} style={{ marginBottom: 16 }}>
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}
