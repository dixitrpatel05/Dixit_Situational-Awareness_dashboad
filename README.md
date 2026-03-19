# Should I Be Trading? - Indian Market Dashboard

Bloomberg Terminal-style Indian market risk dashboard for swing and positional traders.

It computes:

- Decision: YES / CAUTION / NO
- Market Quality Score: 0-100
- Execution Window Score: 0-100 (separate)
- Terminal Analysis: plain-English market context summary

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Data adapters: modular Yahoo + NSE providers with resilient fallback snapshot
- Cache: server-side 30-second cache
- Refresh: frontend auto-refresh every 45 seconds

## Free API Policy

Runtime data in this project uses only free/public sources:

- Yahoo Finance public quote/chart endpoints
- NSE public APIs (with cookie/header handling)
- RBI/manual free fallback values where direct feed is unavailable

No paid API is required to run this dashboard.

## Features Implemented

- Bloomberg-style dense dark terminal UI
- Scrolling top ticker with key Indian instruments
- Hero decision badge and circular market score visualization
- Mode toggle:
	- Swing Mode (default)
	- Positional Mode
- Core market panels:
	- Volatility
	- Trend
	- Breadth
	- Momentum
	- Macro / Liquidity
- 12-sector heatmap for NSE sector leadership and laggards
- Scoring breakdown panel with category weights and contribution
- Execution Window panel as a separate layer
- Alert banner for India-specific risk events:
	- RBI MPC proximity
	- CPI/IIP event window
	- Union Budget window
	- F&O expiry proximity
	- FII selling pressure
- Market-hours awareness for NSE cash session (9:15 AM to 3:30 PM IST)
- Loading skeleton states and graceful data degradation when upstream APIs fail

## Project Structure

```text
.
├── client
│   ├── src
│   │   ├── components
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server
│   ├── src
│   │   ├── providers
│   │   │   ├── nseProvider.js
│   │   │   └── yahooProvider.js
│   │   ├── services
│   │   │   ├── calendarService.js
│   │   │   ├── marketService.js
│   │   │   └── scoringEngine.js
│   │   ├── utils
│   │   │   ├── indicators.js
│   │   │   └── time.js
│   │   ├── config.js
│   │   └── index.js
│   └── package.json
└── package.json
```

## Setup

1. Install all dependencies:

```bash
npm install
npm --prefix server install
npm --prefix client install
```

2. Run both services in dev mode:

```bash
npm run dev
```

3. Open frontend:

- http://localhost:5173
- http://127.0.0.1:5173

### Office laptop note (no broad network service permission)

This project is configured to run on localhost only:

- Frontend: 127.0.0.1:5173
- Backend: 127.0.0.1:8787

Because it does not bind to all network interfaces, it avoids typical "allow incoming connections/services" prompts that appear when an app exposes LAN ports.

4. Backend API:

- http://localhost:8787/api/dashboard?mode=swing
- http://localhost:8787/api/dashboard?mode=positional
- http://localhost:8787/api/health
- http://localhost:8787/api/recommendations

### If you see "Failed to fetch"

Common cause: frontend cannot reach backend URL.

Use these settings:

- Local dev (default): frontend calls /api and Vite proxies to backend automatically.
- Hosted frontend + hosted backend: set VITE_API_BASE to your backend URL.

Recommended environment variables:

- Backend:
	- HOST=0.0.0.0 (for cloud)
	- CLIENT_ORIGINS=https://your-frontend-domain,http://localhost:5173,http://127.0.0.1:5173
- Frontend:
	- VITE_API_BASE=https://your-backend-domain (only for hosted split deployments)

## Editable Scoring Formula

Category weights:

- Volatility: 25%
- Momentum: 25%
- Trend: 20%
- Breadth: 20%
- Macro/Liquidity: 10%

Main formula:

```text
Market Quality Score =
	(Volatility * 0.25) +
	(Momentum * 0.25) +
	(Trend * 0.20) +
	(Breadth * 0.20) +
	(MacroLiquidity * 0.10)
```

Decision bands:

- 80 to 100: YES (full size)
- 60 to 79: CAUTION (half size)
- below 60: NO (preserve capital)

Execution Window Score:

- Computed separately from main weighted score
- Evaluates whether breakouts and follow-through are currently working
- Included in explanation and execution panel

## Data Inputs Coverage

Implemented directly or with robust proxy/fallback if feed is unavailable:

- Volatility: India VIX level, slope, percentile, VIX ROC proxy, Nifty PCR
- Trend: Nifty vs MA stack, Bank Nifty vs MA50, RSI(14), regime classification
- Breadth: NSE advance/decline ratio, MA participation proxies, highs-lows proxy
- Momentum: 12 sector indices, top3-bottom3 spread, higher-high participation proxy
- Macro/Liquidity: USD/INR trend, India 10Y proxy, RBI stance inference, FII/DII flows

If NSE/Yahoo requests fail or are throttled, the backend serves a resilient fallback snapshot so the dashboard stays operational and clearly labeled as latest available data.

## Example Output (Latest Available Snapshot)

Example from /api/dashboard?mode=swing:

```json
{
	"meta": {
		"title": "Should I Be Trading?",
		"mode": "swing",
		"modeLabel": "Swing Trading",
		"marketOpen": false,
		"asOfIST": "2026-03-19 16:05:07",
		"status": "LIVE",
		"dataFreshnessNote": "Latest available NSE/Yahoo data with resilient fallbacks"
	},
	"decision": {
		"value": "NO",
		"action": "Avoid trading, preserve capital"
	},
	"marketQualityScore": 48.4,
	"executionWindowScore": 42,
	"summary": "Environment is fragile and capital protection should dominate. Nifty regime is downtrend with RSI at 23.9 and India VIX at 14.40 (0.67% 5d slope). Breadth A/D ratio is 0.02 while FII flows are net negative. Execution window reads 42/100 for Swing Trading mode."
}
```

## Runtime Data Sources (Free Only)

| Data Need | Free Runtime Source |
|---|---|
| Nifty / sector prices | Yahoo Finance public symbols (^NSEI, ^NSEBANK, ^CNXIT, etc.) |
| India VIX | Yahoo Finance ^INDIAVIX + NSE public fallback |
| NSE Put/Call Ratio | NSE option chain public API |
| FII/DII flows | NSE public FII/DII endpoint |
| India 10Y G-Sec | RBI/manual free fallback constant in current build |
| USD/INR | Yahoo Finance USDINR=X |
| Breadth | NSE index advance/decline public API |

## Notes

- NSE APIs can be inconsistent and may require cookie/header handling.
- For production reliability, you can still add broker feeds later, but they are optional and not required by this build.
- Scoring logic is intentionally centralized in server/src/services/scoringEngine.js for easy calibration.