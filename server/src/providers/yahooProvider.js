import axios from "axios";

const yahoo = axios.create({
  baseURL: "https://query1.finance.yahoo.com",
  timeout: 12000,
  headers: {
    "User-Agent": "Mozilla/5.0"
  }
});

export async function fetchQuotes(symbols) {
  try {
    const joined = symbols.join(",");
    const response = await yahoo.get("/v7/finance/quote", {
      params: { symbols: joined }
    });

    const results = response.data?.quoteResponse?.result ?? [];
    const map = new Map();

    for (const item of results) {
      map.set(item.symbol, {
        symbol: item.symbol,
        shortName: item.shortName,
        price: item.regularMarketPrice,
        change: item.regularMarketChange,
        changePercent: item.regularMarketChangePercent,
        previousClose: item.regularMarketPreviousClose,
        timestamp: item.regularMarketTime ? new Date(item.regularMarketTime * 1000).toISOString() : null
      });
    }

    return map;
  } catch {
    return new Map();
  }
}

export async function fetchDailySeries(symbol, range = "1y", interval = "1d") {
  try {
    const response = await yahoo.get(`/v8/finance/chart/${encodeURIComponent(symbol)}`, {
      params: {
        range,
        interval
      }
    });

    const result = response.data?.chart?.result?.[0];
    const close = result?.indicators?.quote?.[0]?.close ?? [];
    const timestamps = result?.timestamp ?? [];

    const series = [];
    for (let i = 0; i < close.length; i += 1) {
      if (close[i] === null || close[i] === undefined) {
        continue;
      }
      series.push({
        ts: timestamps[i] ? new Date(timestamps[i] * 1000).toISOString() : null,
        close: close[i]
      });
    }

    return series;
  } catch {
    return [];
  }
}
