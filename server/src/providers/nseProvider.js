import axios from "axios";

const nse = axios.create({
  baseURL: "https://www.nseindia.com",
  timeout: 12000,
  headers: {
    "User-Agent": "Mozilla/5.0",
    Accept: "application/json, text/plain, */*",
    Referer: "https://www.nseindia.com/"
  }
});

let cookieCache = null;
let cookieFetchedAt = 0;

async function ensureCookie() {
  const now = Date.now();
  if (cookieCache && now - cookieFetchedAt < 5 * 60 * 1000) {
    return cookieCache;
  }

  const response = await nse.get("/", { validateStatus: () => true });
  const cookieHeader = response.headers["set-cookie"];
  if (Array.isArray(cookieHeader) && cookieHeader.length) {
    cookieCache = cookieHeader.map((c) => c.split(";")[0]).join("; ");
    cookieFetchedAt = now;
  }
  return cookieCache;
}

async function get(path, params = {}) {
  const cookie = await ensureCookie();
  return nse.get(path, {
    params,
    headers: cookie ? { Cookie: cookie } : undefined
  });
}

export async function fetchOptionPCR() {
  try {
    const response = await get("/api/option-chain-indices", { symbol: "NIFTY" });
    const records = response.data?.records;
    if (!records) {
      return null;
    }

    const rawRows = records?.data ?? [];
    let putOI = 0;
    let callOI = 0;

    for (const row of rawRows) {
      const pe = row?.PE?.openInterest ?? 0;
      const ce = row?.CE?.openInterest ?? 0;
      putOI += pe;
      callOI += ce;
    }

    if (!callOI) {
      return null;
    }

    return {
      value: putOI / callOI,
      source: "NSE"
    };
  } catch {
    return null;
  }
}

export async function fetchAdvanceDecline() {
  try {
    const response = await get("/api/equity-stockIndices", { index: "NIFTY 50" });
    const data = response.data;

    const advances = Number(data?.advance?.advances ?? data?.advance?.advance ?? 0);
    const declines = Number(data?.advance?.declines ?? data?.advance?.decline ?? 0);
    if (!advances && !declines) {
      return null;
    }

    return {
      advances,
      declines,
      ratio: declines ? advances / declines : advances,
      source: "NSE"
    };
  } catch {
    return null;
  }
}

export async function fetchFiiDiiFlows() {
  try {
    const response = await get("/api/fiidiiTradeReact");
    const rows = response.data ?? [];
    const fiiRow = rows.find((r) => String(r?.category || "").toLowerCase().includes("fii"));
    const diiRow = rows.find((r) => String(r?.category || "").toLowerCase().includes("dii"));

    const parseNet = (row) => {
      if (!row) {
        return null;
      }
      if (row.netValue !== undefined && row.netValue !== null) {
        return Number(row.netValue);
      }
      const buy = Number(row.buyValue ?? row.buy ?? 0);
      const sell = Number(row.sellValue ?? row.sell ?? 0);
      return buy - sell;
    };

    return {
      fiiNetCr: parseNet(fiiRow),
      diiNetCr: parseNet(diiRow),
      source: "NSE"
    };
  } catch {
    return null;
  }
}

function normalizeName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export async function fetchAllIndicesSnapshot() {
  try {
    const response = await get("/api/allIndices");
    const rows = response.data?.data ?? [];
    const byNormalizedName = new Map();

    for (const row of rows) {
      const name = row?.index || row?.indexSymbol;
      if (!name) {
        continue;
      }
      const normalized = normalizeName(name);
      byNormalizedName.set(normalized, {
        index: name,
        last: Number(row?.last ?? row?.lastPrice ?? row?.ltp ?? null),
        changePercent: Number(row?.percentChange ?? row?.pChange ?? null),
        change: Number(row?.variation ?? row?.change ?? null),
        timestamp: row?.lastUpdateTime || row?.timeVal || null,
        source: "NSE"
      });
    }

    return {
      byNormalizedName,
      source: "NSE /api/allIndices"
    };
  } catch {
    return null;
  }
}
