function TickerItem({ label, price, changePercent }) {
  const cls = changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat";
  return (
    <div className={`ticker-item ${cls}`}>
      <span>{label}</span>
      <strong>{typeof price === "number" ? price.toFixed(2) : "--"}</strong>
      <span>{typeof changePercent === "number" ? `${changePercent.toFixed(2)}%` : "--"}</span>
    </div>
  );
}

export default function TopTicker({ ticker, updating, secondsAgo, onRefresh }) {
  const entries = [
    { label: "Nifty 50", ...ticker.nifty50 },
    { label: "Bank Nifty", ...ticker.bankNifty },
    { label: "India VIX", ...ticker.indiaVix },
    { label: "USD/INR", ...ticker.usdInr },
    { label: "10Y G-Sec", ...ticker.gsec10y },
    ...ticker.sectors
      .filter((s) => ["Nifty IT", "Nifty Pharma", "Nifty Auto", "Nifty Metal"].includes(s.label))
      .map((s) => ({ label: s.label, price: s.value, changePercent: s.changePercent }))
  ];

  return (
    <header className="top-ticker">
      <div className="ticker-strip">
        <div className="ticker-track">
          {entries.concat(entries).map((item, idx) => (
            <TickerItem key={`${item.label}-${idx}`} {...item} />
          ))}
        </div>
      </div>
      <div className="top-controls">
        <div className={`status-dot ${updating ? "updating" : "live"}`}>{updating ? "UPDATING" : "LIVE"}</div>
        <div className="updated-at">updated {secondsAgo}s ago</div>
        <button onClick={onRefresh} className="refresh-btn" type="button">
          Refresh
        </button>
      </div>
    </header>
  );
}
