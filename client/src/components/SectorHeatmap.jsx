export default function SectorHeatmap({ sectors }) {
  const sorted = [...sectors].sort((a, b) => b.changePercent - a.changePercent);
  const top = sorted.slice(0, 3).map((s) => s.label);
  const bottom = sorted.slice(-3).map((s) => s.label);

  return (
    <section className="panel heatmap-panel">
      <h3>Sector Heatmap</h3>
      <div className="heatmap-list">
        {sorted.map((sector) => {
          const width = Math.min(100, Math.max(5, Math.abs(sector.changePercent) * 18));
          const cls = sector.changePercent >= 0 ? "up" : "down";
          return (
            <div className="heatmap-row" key={sector.key}>
              <span className="sector-label">{sector.label}</span>
              <div className="heatbar-wrap">
                <div className={`heatbar ${cls}`} style={{ width: `${width}%` }} />
              </div>
              <strong className={cls}>{sector.changePercent.toFixed(2)}%</strong>
            </div>
          );
        })}
      </div>
      <div className="leaders-laggards">
        <span>Leaders: {top.join(", ")}</span>
        <span>Laggards: {bottom.join(", ")}</span>
      </div>
    </section>
  );
}
