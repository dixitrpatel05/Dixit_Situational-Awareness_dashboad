function prettyLabel(key) {
  if (key === "macroLiquidity") return "Macro/Liquidity";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export default function ScoreBreakdown({ categoryScores, weights }) {
  return (
    <section className="panel score-panel">
      <h3>Scoring Breakdown</h3>
      <div className="score-list">
        {Object.entries(categoryScores).map(([key, score]) => {
          const w = weights[key] ?? 0;
          const contrib = (score * (w / 100)).toFixed(1);
          return (
            <div className="score-row" key={key}>
              <span>{prettyLabel(key)}</span>
              <span>{w}% weight</span>
              <strong>{score.toFixed(1)}</strong>
              <span>contrib {contrib}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
