import cors from "cors";
import express from "express";
import NodeCache from "node-cache";
import { SERVER_CONFIG } from "./config.js";
import { buildDashboardPayload } from "./services/marketService.js";
import { getSnapshotForMode, startEodScheduler, writeEodSnapshot } from "./services/eodSnapshotService.js";
import { isMarketOpen, nowIST } from "./utils/time.js";

const app = express();
const cache = new NodeCache({ stdTTL: SERVER_CONFIG.cacheTtlSeconds, useClones: false });

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (SERVER_CONFIG.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "should-i-be-trading-server", cacheTtl: SERVER_CONFIG.cacheTtlSeconds });
});

app.get("/api/recommendations", (_req, res) => {
  res.json({
    runtimeDataSources: [
      {
        dataNeed: "Nifty / sector prices",
        provider: "Yahoo Finance public chart/quote endpoints",
        symbols: ["^NSEI", "^NSEBANK", "^CNXIT", "^CNXPHARMA", "^CNXAUTO", "^CNXMETAL"]
      },
      {
        dataNeed: "India VIX",
        provider: "Yahoo Finance + NSE public API fallback",
        symbols: ["^INDIAVIX"]
      },
      {
        dataNeed: "NSE Put/Call Ratio",
        provider: "NSE public API",
        endpoint: "/api/option-chain-indices?symbol=NIFTY"
      },
      {
        dataNeed: "FII/DII flows",
        provider: "NSE public API",
        endpoint: "/api/fiidiiTradeReact"
      },
      {
        dataNeed: "USD/INR",
        provider: "Yahoo Finance public quote endpoint",
        symbols: ["USDINR=X"]
      },
      {
        dataNeed: "Breadth",
        provider: "NSE public API",
        endpoint: "/api/equity-stockIndices?index=NIFTY%2050"
      },
      {
        dataNeed: "India 10Y G-Sec",
        provider: "RBI publication/manual free feed",
        note: "Current implementation uses a conservative free fallback constant when feed is unavailable"
      }
    ],
    policy: "Runtime uses free public sources only (Yahoo + NSE + free fallback data)."
  });
});

app.get("/api/dashboard", async (req, res) => {
  const mode = String(req.query.mode || "swing").toLowerCase() === "positional" ? "positional" : "swing";
  const key = `dashboard:${mode}`;
  const force = req.query.force === "1";

  const marketOpen = isMarketOpen(nowIST());

  if (!force && !marketOpen) {
    const snap = await getSnapshotForMode(mode);
    if (snap?.payload) {
      const payload = {
        ...snap.payload,
        meta: {
          ...snap.payload.meta,
          status: "EOD_SNAPSHOT",
          eodSnapshotDate: snap.snapshot.sessionDate,
          eodSavedAtIST: snap.snapshot.savedAtIST,
          dataFreshnessNote: `EOD snapshot captured after close (${snap.snapshot.savedAtIST} IST)`
        }
      };
      return res.json({ ...payload, cache: { hit: true, ttlSeconds: SERVER_CONFIG.cacheTtlSeconds, source: "EOD" } });
    }
  }

  if (!force) {
    const hit = cache.get(key);
    if (hit) {
      return res.json({ ...hit, cache: { hit: true, ttlSeconds: SERVER_CONFIG.cacheTtlSeconds } });
    }
  }

  try {
    const payload = await buildDashboardPayload(mode);
    cache.set(key, payload);
    return res.json({ ...payload, cache: { hit: false, ttlSeconds: SERVER_CONFIG.cacheTtlSeconds } });
  } catch (error) {
    return res.status(502).json({
      error: "Unable to load market snapshot",
      details: error?.message || "unknown"
    });
  }
});

app.post("/api/eod-refresh", async (_req, res) => {
  try {
    const swing = await buildDashboardPayload("swing");
    const positional = await buildDashboardPayload("positional");
    const written = await writeEodSnapshot({ swing, positional });
    return res.json({ ok: true, snapshot: written });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "failed" });
  }
});

app.listen(SERVER_CONFIG.port, SERVER_CONFIG.host, () => {
  console.log(`Should I Be Trading backend on ${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`);
});

startEodScheduler(async () => {
  const swing = await buildDashboardPayload("swing");
  const positional = await buildDashboardPayload("positional");
  await writeEodSnapshot({ swing, positional });
  console.log("EOD snapshot written for swing and positional modes");
});
