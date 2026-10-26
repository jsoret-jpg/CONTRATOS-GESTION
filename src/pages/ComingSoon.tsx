import { Construction } from "lucide-react";

export default function ComingSoon({ moduleName, phase }: { moduleName: string; phase: string }) {
  return (
    <div>
      <h1>{moduleName}</h1>
      <div className="card" style={{ maxWidth: 480, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Construction size={20} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
          Este módulo se implementará en la {phase}.
        </p>
      </div>
    </div>
  );
}
