import { useEffect, useMemo, useState } from "react";
import { fetchDashboard } from "./api";
import AlertBanner from "./components/AlertBanner";
import DecisionHero from "./components/DecisionHero";
import ExecutionPanel from "./components/ExecutionPanel";
import MetricPanel from "./components/MetricPanel";
import ScoreBreakdown from "./components/ScoreBreakdown";
import SectorHeatmap from "./components/SectorHeatmap";
import TopTicker from "./components/TopTicker";

const REFRESH_MS = 45000;

function directionFromNumeric(value, flat = 0.1) {
  if (value > flat) return "up";
  if (value < -flat) return "down";
  return "flat";
}

function buildPanelRows(data) {
  const vol = data.panels.volatility;
  const trend = data.panels.trend;
  const breadth = data.panels.breadth;
  const mom = data.panels.momentum;
  const macro = data.panels.macro;

  return {
    volatility: [
      {
        label: "India VIX",
        value: vol.vixLevel.toFixed(2),
        direction: directionFromNumeric(-vol.vix5dSlope),
        state: vol.vixLevel < 15 ? "healthy" : vol.vixLevel > 18 ? "risk-off" : "watch"
      },
      {
        label: "Nifty PCR",
        value: vol.pcr.toFixed(2),
        direction: directionFromNumeric(vol.pcr - 1),
        state: vol.pcr >= 0.9 && vol.pcr <= 1.2 ? "healthy" : "watch"
      }
    ],
    trend: [
      {
        label: "Nifty vs 20/50/200 MA",
        value: `${trend.niftyAbove20 ? "Y" : "N"}/${trend.niftyAbove50 ? "Y" : "N"}/${trend.niftyAbove200 ? "Y" : "N"}`,
        direction: trend.regime === "uptrend" ? "up" : trend.regime === "downtrend" ? "down" : "flat",
        state: trend.regime === "uptrend" ? "healthy" : trend.regime === "downtrend" ? "risk-off" : "watch"
      },
      {
        label: "Bank Nifty vs 50MA",
        value: trend.bankNiftyAbove50 ? "Above" : "Below",
        direction: trend.bankNiftyAbove50 ? "up" : "down",
        state: trend.bankNiftyAbove50 ? "healthy" : "risk-off"
      }
    ],
    breadth: [
      {
        label: "A/D Ratio",
        value: breadth.adRatio.toFixed(2),
        direction: directionFromNumeric(breadth.adRatio - 1, 0.05),
        state: breadth.adRatio >= 1 ? "healthy" : "risk-off"
      },
      {
        label: "% Above 50d",
        value: `${breadth.pctAbove50d.toFixed(0)}%`,
        direction: directionFromNumeric(breadth.pctAbove50d - 50, 3),
        state: breadth.pctAbove50d > 50 ? "healthy" : "watch"
      }
    ],
    momentum: [
      {
        label: "Top3-Bottom3 Spread",
        value: `${mom.spreadTop3Bottom3.toFixed(2)}%`,
        direction: directionFromNumeric(mom.spreadTop3Bottom3 - 1, 0.2),
        state: mom.spreadTop3Bottom3 > 1.2 ? "healthy" : "watch"
      },
      {
        label: "% N500 Higher Highs",
        value: `${mom.pctNifty500HigherHighs.toFixed(0)}%`,
        direction: directionFromNumeric(mom.pctNifty500HigherHighs - 40, 2),
        state: mom.pctNifty500HigherHighs > 45 ? "healthy" : "watch"
      }
    ],
    macro: [
      {
        label: "USD/INR Trend",
        value: macro.usdInrTrend.toUpperCase(),
        direction: macro.usdInrTrend,
        state: macro.usdInrTrend === "up" ? "risk-off" : "healthy"
      },
      {
        label: "FII Net Flow",
        value: macro.fiiNetCr === null ? "N/A" : `${macro.fiiNetCr.toFixed(0)} Cr`,
        direction: macro.fiiNetCr === null ? "flat" : directionFromNumeric(macro.fiiNetCr, 20),
        state: macro.fiiNetCr !== null && macro.fiiNetCr < 0 ? "risk-off" : "healthy"
      },
      {
        label: "RBI Stance",
        value: macro.rbiStance.toUpperCase(),
        direction: macro.rbiStance === "hawkish" ? "down" : macro.rbiStance === "dovish" ? "up" : "flat",
        state: macro.rbiStance === "hawkish" ? "risk-off" : "watch"
      }
    ]
  };
}

export default function App() {
  const [mode, setMode] = useState("swing");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const load = async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchDashboard(mode, force);
      setData(payload);
      setSecondsAgo(0);
    } catch (err) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const refreshTimer = setInterval(() => load(false), REFRESH_MS);
    const secondsTimer = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(secondsTimer);
    };
  }, [mode]);

  const panelRows = useMemo(() => (data ? buildPanelRows(data) : null), [data]);
  const qualityItems = useMemo(() => {
    if (!data) {
      return [];
    }
    return [
      { label: "Volatility", value: data.categoryScores.volatility },
      { label: "Trend", value: data.categoryScores.trend },
      { label: "Breadth", value: data.categoryScores.breadth },
      { label: "Momentum", value: data.categoryScores.momentum },
      { label: "Macro", value: data.categoryScores.macroLiquidity }
    ];
  }, [data]);

  return (
    <div className="terminal-shell">
      <TopTicker
        ticker={
          data?.ticker || {
            nifty50: {},
            bankNifty: {},
            indiaVix: {},
            usdInr: {},
            gsec10y: {},
            sectors: []
          }
        }
        updating={loading}
        secondsAgo={secondsAgo}
        onRefresh={() => load(true)}
      />

      <main className="dashboard-grid">
        <section className="title-row">
          <h1>Should I Be Trading?</h1>
          <div className="mode-toggle">
            <button className={mode === "swing" ? "active" : ""} type="button" onClick={() => setMode("swing")}>Swing Mode</button>
            <button className={mode === "positional" ? "active" : ""} type="button" onClick={() => setMode("positional")}>Positional Mode</button>
          </div>
          <div className="asof">IST {data?.meta?.asOfIST || "--"}</div>
        </section>

        {error && <div className="error-box">{error}</div>}
        {data?.alerts && <AlertBanner alerts={data.alerts} />}

        {data && !loading && (
          <section className="panel quality-strip">
            <div className={`quality-item decision ${data.decision.value.toLowerCase()}`}>
              <span>Decision</span>
              <strong>{data.decision.value}</strong>
              <small>{data.meta.modeLabel}</small>
            </div>
            <div className="quality-item total">
              <span>Total Score</span>
              <strong>{data.marketQualityScore.toFixed(1)} / 100</strong>
              <small>{data.decision.action}</small>
            </div>
            {qualityItems.map((item) => (
              <div className="quality-item metric" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value.toFixed(0)}</strong>
                <div className="mini-bar">
                  <div className="mini-fill" style={{ width: `${Math.max(2, item.value)}%` }} />
                </div>
              </div>
            ))}
          </section>
        )}

        {!data || loading ? (
          <section className="loading-grid">
            <div className="skeleton lg" />
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
            <div className="skeleton" />
          </section>
        ) : (
          <>
            <DecisionHero
              decision={data.decision.value}
              score={data.marketQualityScore}
              action={data.decision.action}
              modeLabel={data.meta.modeLabel}
              marketOpen={data.meta.marketOpen}
              executionWindowScore={data.executionWindowScore}
            />

            <section className="panel summary-panel">
              <h3>Terminal Analysis</h3>
              <p>{data.summary}</p>
            </section>

            <MetricPanel title="Volatility" rows={panelRows.volatility} />
            <MetricPanel title="Trend" rows={panelRows.trend} />
            <MetricPanel title="Breadth" rows={panelRows.breadth} />
            <MetricPanel title="Momentum" rows={panelRows.momentum} />
            <MetricPanel title="Macro / Liquidity" rows={panelRows.macro} />

            <SectorHeatmap sectors={data.panels.momentum.sectors} />
            <ScoreBreakdown categoryScores={data.categoryScores} weights={data.weights} />
            <ExecutionPanel score={data.executionWindowScore} />
          </>
        )}
      </main>
    </div>
  );
}
