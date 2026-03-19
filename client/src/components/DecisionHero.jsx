function decisionClass(decision) {
  if (decision === "YES") return "yes";
  if (decision === "CAUTION") return "caution";
  return "no";
}

export default function DecisionHero({ decision, score, action, modeLabel, marketOpen, executionWindowScore }) {
  const degree = Math.max(0, Math.min(100, score)) * 3.6;
  return (
    <section className="panel hero-panel">
      <div className={`decision-badge ${decisionClass(decision)}`}>{decision}</div>
      <div className="score-ring" style={{ background: `conic-gradient(var(--green) ${degree}deg, var(--panel-border) 0deg)` }}>
        <div className="score-ring-inner">
          <strong>{score.toFixed(1)}%</strong>
          <span>Market Quality</span>
        </div>
      </div>
      <div className="hero-meta">
        <p className="action-line">{action}</p>
        <p>Execution Window: {executionWindowScore.toFixed(1)}%</p>
        <p>Mode: {modeLabel}</p>
        <p>{marketOpen ? "NSE cash market is OPEN" : "NSE cash market is CLOSED (showing latest session data)"}</p>
      </div>
    </section>
  );
}
