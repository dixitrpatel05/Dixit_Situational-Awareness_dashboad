function arrow(direction) {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}

export default function MetricPanel({ title, rows }) {
  return (
    <section className="panel metric-panel">
      <h3>{title}</h3>
      <div className="metric-rows">
        {rows.map((row) => (
          <div className="metric-row" key={row.label}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            <span className={`trend ${row.direction}`}>{arrow(row.direction)}</span>
            <span className={`tag ${row.state}`}>{row.state}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
