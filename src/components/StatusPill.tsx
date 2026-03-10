interface StatusPillProps {
  tone: "neutral" | "accent" | "success" | "warning";
  label: string;
}

export function StatusPill({ tone, label }: StatusPillProps) {
  return <span className={`status-pill status-pill-${tone}`}>{label}</span>;
}
