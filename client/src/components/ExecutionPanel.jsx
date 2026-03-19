function scoreState(score) {
  if (score >= 75) return "healthy";
  if (score >= 55) return "watch";
  return "risk-off";
}

export default function ExecutionPanel({ score }) {
  const state = scoreState(score);
  return (
    <section className="panel execution-panel">
      <h3>Execution Window</h3>
      <div className="exec-score">{score.toFixed(1)}%</div>
      <div className={`exec-state ${state}`}>{state.toUpperCase()}</div>
      <ul>
        <li>Breakouts holding above pivots</li>
        <li>Pullbacks bought quickly</li>
        <li>Follow-through after breakout sessions</li>
        <li>Bullish F&O positioning proxy</li>
      </ul>
    </section>
  );
}
