import { MODE_PRESETS, SECTOR_DEFINITIONS, SYMBOLS } from "../config.js";
import { fetchAdvanceDecline, fetchAllIndicesSnapshot, fetchFiiDiiFlows, fetchOptionPCR } from "../providers/nseProvider.js";
import { fetchDailySeries, fetchQuotes } from "../providers/yahooProvider.js";
import { buildMacroAlerts } from "./calendarService.js";
import { buildSummary, runScoringEngine } from "./scoringEngine.js";
import { directionFromNumber, percentileRank, rsi, slope, sma } from "../utils/indicators.js";
import { isMarketOpen, nowIST } from "../utils/time.js";

const DEFAULTS = {
  gsec10y: 7.08,
  gsecTrend: "flat",
  rbiStance: "neutral"
};

const FALLBACK_QUOTES = {
  "^NSEI": { price: 22410, changePercent: 0.48, symbol: "^NSEI", timestamp: new Date().toISOString() },
  "^NSEBANK": { price: 48620, changePercent: 0.64, symbol: "^NSEBANK", timestamp: new Date().toISOString() },
  "^INDIAVIX": { price: 14.4, changePercent: -1.2, symbol: "^INDIAVIX", timestamp: new Date().toISOString() },
  "USDINR=X": { price: 83.1, changePercent: 0.06, symbol: "USDINR=X", timestamp: new Date().toISOString() },
  "^CNXIT": { price: 38320, changePercent: 1.2, symbol: "^CNXIT", timestamp: new Date().toISOString() },
  "^CNXPHARMA": { price: 20450, changePercent: 0.9, symbol: "^CNXPHARMA", timestamp: new Date().toISOString() },
  "^CNXAUTO": { price: 22190, changePercent: 0.3, symbol: "^CNXAUTO", timestamp: new Date().toISOString() },
  "^CNXMETAL": { price: 8850, changePercent: -0.4, symbol: "^CNXMETAL", timestamp: new Date().toISOString() },
  "^CNXFMCG": { price: 58720, changePercent: -0.2, symbol: "^CNXFMCG", timestamp: new Date().toISOString() },
  "^CNXREALTY": { price: 958, changePercent: 0.1, symbol: "^CNXREALTY", timestamp: new Date().toISOString() },
  "^CNXOILGAS": { price: 11310, changePercent: -0.35, symbol: "^CNXOILGAS", timestamp: new Date().toISOString() },
  "^CNXMEDIA": { price: 1685, changePercent: -0.7, symbol: "^CNXMEDIA", timestamp: new Date().toISOString() },
  "^CNXFINANCE": { price: 25210, changePercent: 0.42, symbol: "^CNXFINANCE", timestamp: new Date().toISOString() },
  "^CNXCONSUM": { price: 36800, changePercent: 0.22, symbol: "^CNXCONSUM", timestamp: new Date().toISOString() },
  "^CNXINFRA": { price: 9025, changePercent: 0.11, symbol: "^CNXINFRA", timestamp: new Date().toISOString() }
};

const NSE_INDEX_BY_SYMBOL = {
  [SYMBOLS.nifty50]: "NIFTY 50",
  [SYMBOLS.bankNifty]: "NIFTY BANK",
  [SYMBOLS.indiaVix]: "INDIA VIX",
  [SYMBOLS.niftyIT]: "NIFTY IT",
  [SYMBOLS.niftyPharma]: "NIFTY PHARMA",
  [SYMBOLS.niftyAuto]: "NIFTY AUTO",
  [SYMBOLS.niftyFMCG]: "NIFTY FMCG",
  [SYMBOLS.niftyMetal]: "NIFTY METAL",
  [SYMBOLS.niftyRealty]: "NIFTY REALTY",
  [SYMBOLS.niftyOilGas]: "NIFTY OIL & GAS",
  [SYMBOLS.niftyMedia]: "NIFTY MEDIA",
  [SYMBOLS.niftyFinancialServices]: "NIFTY FINANCIAL SERVICES",
  [SYMBOLS.niftyConsumerDurables]: "NIFTY CONSUMER DURABLES",
  [SYMBOLS.niftyInfrastructure]: "NIFTY INFRASTRUCTURE"
};

function normalizeName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function nseIndexToQuote(symbol, nseSnapshot) {
  if (!nseSnapshot?.byNormalizedName) {
    return null;
  }
  const indexName = NSE_INDEX_BY_SYMBOL[symbol];
  if (!indexName) {
    return null;
  }
  const row = nseSnapshot.byNormalizedName.get(normalizeName(indexName));
  if (!row) {
    return null;
  }

  return {
    symbol,
    shortName: row.index,
    price: Number.isFinite(row.last) ? row.last : null,
    change: Number.isFinite(row.change) ? row.change : null,
    changePercent: Number.isFinite(row.changePercent) ? row.changePercent : null,
    previousClose:
      Number.isFinite(row.last) && Number.isFinite(row.change) ? Number((row.last - row.change).toFixed(2)) : null,
    timestamp: row.timestamp || null,
    source: row.source
  };
}

function buildSyntheticSeries(start, points, driftPerPoint, noiseAmplitude) {
  const out = [];
  let value = start;
  for (let i = 0; i < points; i += 1) {
    const noise = (Math.sin(i / 5) + Math.cos(i / 9)) * noiseAmplitude;
    value += driftPerPoint + noise;
    out.push({ close: Math.max(1, Number(value.toFixed(2))) });
  }
  return out;
}

function fallbackSeriesFor(symbol) {
  if (symbol === SYMBOLS.nifty50) return buildSyntheticSeries(20600, 260, 7.2, 3.4);
  if (symbol === SYMBOLS.bankNifty) return buildSyntheticSeries(45100, 260, 11.4, 6.2);
  if (symbol === SYMBOLS.indiaVix) return buildSyntheticSeries(16.2, 260, -0.007, 0.04);
  if (symbol === SYMBOLS.usdInr) return buildSyntheticSeries(82.2, 90, 0.01, 0.005);
  return [];
}

function safeNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function estimatePCRFromVix(vix) {
  if (vix < 13) return 1.12;
  if (vix < 16) return 0.98;
  if (vix < 19) return 0.86;
  return 0.74;
}

function computeRegime(price, ma20, ma50, ma200) {
  if (price > ma20 && ma20 > ma50 && ma50 > ma200) {
    return "uptrend";
  }
  if (price < ma20 && ma20 < ma50 && ma50 < ma200) {
    return "downtrend";
  }
  return "chop";
}

function inferRbiStance(gsecTrend, inflationAlertOn) {
  if (gsecTrend === "up" && inflationAlertOn) {
    return "hawkish";
  }
  if (gsecTrend === "down" && !inflationAlertOn) {
    return "dovish";
  }
  return "neutral";
}

export async function buildDashboardPayload(mode = "swing") {
  const modePreset = MODE_PRESETS[mode] || MODE_PRESETS.swing;

  const symbolList = [
    SYMBOLS.nifty50,
    SYMBOLS.bankNifty,
    SYMBOLS.indiaVix,
    SYMBOLS.usdInr,
    ...SECTOR_DEFINITIONS.map((s) => SYMBOLS[s.key]).filter(Boolean)
  ];

  const [quotesMap, niftySeries, bankSeries, vixSeries, usdInrSeries, pcrData, adData, fiiDii, nseIndices] = await Promise.all([
    fetchQuotes(symbolList),
    fetchDailySeries(SYMBOLS.nifty50, "1y"),
    fetchDailySeries(SYMBOLS.bankNifty, "1y"),
    fetchDailySeries(SYMBOLS.indiaVix, "1y"),
    fetchDailySeries(SYMBOLS.usdInr, "3mo"),
    fetchOptionPCR(),
    fetchAdvanceDecline(),
    fetchFiiDiiFlows(),
    fetchAllIndicesSnapshot()
  ]);

  const mergedQuotes = new Map();

  // Lowest priority static fallback.
  for (const [symbol, quote] of Object.entries(FALLBACK_QUOTES)) {
    mergedQuotes.set(symbol, quote);
  }

  // Mid priority Yahoo quote stream.
  for (const [symbol, quote] of quotesMap.entries()) {
    mergedQuotes.set(symbol, quote);
  }

  // Highest priority NSE index snapshot for same-session close alignment.
  for (const symbol of symbolList) {
    const nseQuote = nseIndexToQuote(symbol, nseIndices);
    if (nseQuote) {
      mergedQuotes.set(symbol, nseQuote);
    }
  }

  const effectiveNiftySeries = niftySeries.length ? niftySeries : fallbackSeriesFor(SYMBOLS.nifty50);
  const effectiveBankSeries = bankSeries.length ? bankSeries : fallbackSeriesFor(SYMBOLS.bankNifty);
  const effectiveVixSeries = vixSeries.length ? vixSeries : fallbackSeriesFor(SYMBOLS.indiaVix);
  const effectiveUsdInrSeries = usdInrSeries.length ? usdInrSeries : fallbackSeriesFor(SYMBOLS.usdInr);

  const niftyClose = effectiveNiftySeries.map((v) => v.close);
  const bankClose = effectiveBankSeries.map((v) => v.close);
  const vixClose = effectiveVixSeries.map((v) => v.close);
  const usdInrClose = effectiveUsdInrSeries.map((v) => v.close);

  const niftyQuote = mergedQuotes.get(SYMBOLS.nifty50);
  const bankQuote = mergedQuotes.get(SYMBOLS.bankNifty);
  const vixQuote = mergedQuotes.get(SYMBOLS.indiaVix);
  const usdInrQuote = mergedQuotes.get(SYMBOLS.usdInr);

  const niftyPrice = safeNumber(niftyQuote?.price, niftyClose[niftyClose.length - 1]);
  const bankPrice = safeNumber(bankQuote?.price, bankClose[bankClose.length - 1]);
  const vixLevel = safeNumber(vixQuote?.price, vixClose[vixClose.length - 1]);

  const ma20 = sma(niftyClose, modePreset.lookbackMA[0]);
  const ma50 = sma(niftyClose, modePreset.lookbackMA[1]);
  const ma200 = sma(niftyClose, modePreset.lookbackMA[2]);
  const bank50 = sma(bankClose, 50);

  const trend = {
    niftyPrice,
    bankNiftyPrice: bankPrice,
    ma20,
    ma50,
    ma200,
    bank50,
    niftyAbove20: niftyPrice > ma20,
    niftyAbove50: niftyPrice > ma50,
    niftyAbove200: niftyPrice > ma200,
    bankNiftyAbove50: bankPrice > bank50,
    rsi14: rsi(niftyClose, 14) ?? 50,
    regime: computeRegime(niftyPrice, ma20, ma50, ma200),
    giftNiftySignal: "neutral"
  };

  const pcr = safeNumber(pcrData?.value, estimatePCRFromVix(vixLevel));

  const volatility = {
    vixLevel,
    vix5dSlope: slope(vixClose, 5),
    vixPercentile: percentileRank(vixClose, vixLevel) ?? 50,
    vixRocProxy: slope(vixClose, 3),
    pcr,
    pcrSource: pcrData?.source ?? "Estimated from VIX regime"
  };

  const sectorPerformance = SECTOR_DEFINITIONS.map((sector) => {
    const q = mergedQuotes.get(SYMBOLS[sector.key]);
    return {
      key: sector.key,
      label: sector.label,
      value: safeNumber(q?.price, 0),
      changePercent: safeNumber(q?.changePercent, 0)
    };
  });

  const sortedSectors = [...sectorPerformance].sort((a, b) => b.changePercent - a.changePercent);
  const top3 = sortedSectors.slice(0, 3);
  const bottom3 = sortedSectors.slice(-3);
  const top3Avg = top3.reduce((acc, s) => acc + s.changePercent, 0) / 3;
  const bottom3Avg = bottom3.reduce((acc, s) => acc + s.changePercent, 0) / 3;

  const positiveSectors = sectorPerformance.filter((s) => s.changePercent > 0).length;

  const adRatio = safeNumber(adData?.ratio, 1);
  const advances = safeNumber(adData?.advances, 30);
  const declines = safeNumber(adData?.declines, 20);

  const breadthProxy = Math.round((positiveSectors / sectorPerformance.length) * 100);

  const breadth = {
    advances,
    declines,
    adRatio,
    pctAbove20d: Math.max(20, Math.min(80, breadthProxy + 6)),
    pctAbove50d: Math.max(15, Math.min(78, breadthProxy)),
    pctAbove200d: Math.max(10, Math.min(72, breadthProxy - 8)),
    newHighsVsLows: Math.round((advances - declines) * 0.8),
    mcclellanEquivalent: Number(((advances - declines) / (advances + declines || 1) * 100).toFixed(1)),
    source: adData?.source ?? "Proxy"
  };

  const concentration = top3.reduce((acc, s) => acc + Math.max(s.changePercent, 0), 0);
  const totalPositive = sectorPerformance.reduce((acc, s) => acc + Math.max(s.changePercent, 0), 0) || 1;

  const momentum = {
    sectors: sectorPerformance,
    top3,
    bottom3,
    spreadTop3Bottom3: Number((top3Avg - bottom3Avg).toFixed(2)),
    positiveSectors,
    pctNifty500HigherHighs: Math.max(20, Math.min(75, breadthProxy + (trend.regime === "uptrend" ? 10 : -5))),
    leadershipConcentration: Number((concentration / totalPositive).toFixed(2))
  };

  const usdTrend = directionFromNumber(slope(usdInrClose, 5), 0.08);
  const gsecTrend = DEFAULTS.gsecTrend;

  const preAlerts = buildMacroAlerts();
  const inflationAlertOn = preAlerts.some((a) => a.code === "CPI_WINDOW");

  const macro = {
    gsec10y: DEFAULTS.gsec10y,
    gsecTrend,
    usdInr: safeNumber(usdInrQuote?.price, usdInrClose[usdInrClose.length - 1]),
    usdInrTrend: usdTrend,
    rbiStance: inferRbiStance(gsecTrend, inflationAlertOn),
    fiiNetCr: safeNumber(fiiDii?.fiiNetCr, null),
    diiNetCr: safeNumber(fiiDii?.diiNetCr, null),
    fiiSource: fiiDii?.source ?? "Unavailable"
  };

  const scored = runScoringEngine(
    {
      volatility,
      trend,
      breadth,
      momentum,
      macro
    },
    modePreset
  );

  const alerts = [...preAlerts];
  if (macro.fiiNetCr !== null && macro.fiiNetCr < 0) {
    alerts.push({
      level: "red",
      code: "FII_SELLING",
      message: "FII is net selling. Risk appetite can fade quickly in swing setups."
    });
  }

  const summary = buildSummary(
    {
      volatility,
      trend,
      breadth,
      momentum,
      macro
    },
    scored,
    modePreset.name
  );

  const now = nowIST();

  const quotesFromNse = symbolList.filter((s) => mergedQuotes.get(s)?.source === "NSE").length;
  const quotesFromYahoo = symbolList.filter((s) => mergedQuotes.get(s)?.source !== "NSE" && quotesMap.has(s)).length;
  const quotesFromStaticFallback = symbolList.length - quotesFromNse - quotesFromYahoo;

  const freshness =
    quotesFromStaticFallback > symbolList.length / 2
      ? "Fallback-heavy snapshot (upstream blocked); verify connectivity"
      : "Latest available NSE/Yahoo data with resilient fallbacks";

  return {
    meta: {
      title: "Should I Be Trading?",
      mode,
      modeLabel: modePreset.name,
      marketOpen: isMarketOpen(now),
      asOfIST: now.format("YYYY-MM-DD HH:mm:ss"),
      status: "LIVE",
      dataFreshnessNote: freshness,
      quoteSourceMix: {
        nse: quotesFromNse,
        yahoo: quotesFromYahoo,
        staticFallback: quotesFromStaticFallback
      }
    },
    decision: scored.decision,
    marketQualityScore: scored.marketQualityScore,
    executionWindowScore: scored.executionWindowScore,
    summary,
    categoryScores: scored.categoryScores,
    weights: {
      volatility: 25,
      momentum: 25,
      trend: 20,
      breadth: 20,
      macroLiquidity: 10
    },
    ticker: {
      nifty50: niftyQuote,
      bankNifty: bankQuote,
      indiaVix: vixQuote,
      usdInr: usdInrQuote,
      gsec10y: {
        symbol: "IN10Y",
        price: macro.gsec10y,
        changePercent: 0.05
      },
      sectors: sectorPerformance
    },
    panels: {
      volatility,
      trend,
      breadth,
      momentum,
      macro
    },
    alerts
  };
}
