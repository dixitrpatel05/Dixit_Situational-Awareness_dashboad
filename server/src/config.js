export const SERVER_CONFIG = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 8787),
  cacheTtlSeconds: 30,
  allowedOrigins: (process.env.CLIENT_ORIGINS || "http://127.0.0.1:5173,http://localhost:5173")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
};

export const SYMBOLS = {
  nifty50: "^NSEI",
  bankNifty: "^NSEBANK",
  indiaVix: "^INDIAVIX",
  usdInr: "USDINR=X",
  niftyIT: "^CNXIT",
  niftyPharma: "^CNXPHARMA",
  niftyAuto: "^CNXAUTO",
  niftyMetal: "^CNXMETAL",
  niftyFMCG: "^CNXFMCG",
  niftyRealty: "^CNXREALTY",
  niftyOilGas: "^CNXOILGAS",
  niftyMedia: "^CNXMEDIA",
  niftyFinancialServices: "^CNXFINANCE",
  niftyConsumerDurables: "^CNXCONSUM",
  niftyInfrastructure: "^CNXINFRA"
};

export const SECTOR_DEFINITIONS = [
  { key: "niftyIT", label: "Nifty IT" },
  { key: "bankNifty", label: "Nifty Bank" },
  { key: "niftyPharma", label: "Nifty Pharma" },
  { key: "niftyAuto", label: "Nifty Auto" },
  { key: "niftyFMCG", label: "Nifty FMCG" },
  { key: "niftyMetal", label: "Nifty Metal" },
  { key: "niftyRealty", label: "Nifty Realty" },
  { key: "niftyOilGas", label: "Nifty Oil & Gas" },
  { key: "niftyMedia", label: "Nifty Media" },
  { key: "niftyFinancialServices", label: "Nifty Financial Services" },
  { key: "niftyConsumerDurables", label: "Nifty Consumer Durables" },
  { key: "niftyInfrastructure", label: "Nifty Infrastructure" }
];

export const SCORE_WEIGHTS = {
  volatility: 0.25,
  momentum: 0.25,
  trend: 0.2,
  breadth: 0.2,
  macroLiquidity: 0.1
};

export const MODE_PRESETS = {
  swing: {
    name: "Swing Trading",
    lookbackMA: [20, 50, 200],
    rsiComfortMin: 45,
    rsiComfortMax: 68
  },
  positional: {
    name: "Positional",
    lookbackMA: [50, 100, 200],
    rsiComfortMin: 42,
    rsiComfortMax: 72
  }
};
