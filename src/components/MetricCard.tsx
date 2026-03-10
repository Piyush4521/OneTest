interface MetricCardProps {
  eyebrow: string;
  value: string;
  detail: string;
}

export function MetricCard({ eyebrow, value, detail }: MetricCardProps) {
  return (
    <article className="metric-card">
      <span className="metric-eyebrow">{eyebrow}</span>
      <strong className="metric-value">{value}</strong>
      <p className="metric-detail">{detail}</p>
    </article>
  );
}
