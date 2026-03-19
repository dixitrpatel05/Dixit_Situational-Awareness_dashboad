import { SCORE_WEIGHTS } from "../config.js";
import { clamp } from "../utils/indicators.js";

function scoreVolatility(vol) {
  let score = 100;

  if (vol.vixLevel > 18) score -= 25;
  else if (vol.vixLevel > 15) score -= 12;

  if (vol.vix5dSlope > 3) score -= 20;
  if (vol.vixPercentile > 75) score -= 20;

  if (vol.pcr < 0.8) score -= 15;
  if (vol.pcr > 1.35) score -= 8;

  return clamp(score);
}

function scoreTrend(trend, mode) {
  let score = 0;

  if (trend.niftyAbove20) score += 20;
  if (trend.niftyAbove50) score += 20;
  if (trend.niftyAbove200) score += 20;
  if (trend.bankNiftyAbove50) score += 20;

  if (trend.regime === "uptrend") score += 15;
  if (trend.regime === "chop") score += 5;

  if (trend.rsi14 >= mode.rsiComfortMin && trend.rsi14 <= mode.rsiComfortMax) {
    score += 10;
  } else if (trend.rsi14 > 75 || trend.rsi14 < 35) {
    score -= 10;
  }

  return clamp(score);
}

function scoreBreadth(breadth) {
  let score = 0;

  score += Math.min(25, breadth.pctAbove20d * 0.35);
  score += Math.min(25, breadth.pctAbove50d * 0.35);
  score += Math.min(20, breadth.pctAbove200d * 0.25);

  if (breadth.adRatio >= 1.3) score += 15;
  else if (breadth.adRatio >= 1) score += 10;
  else if (breadth.adRatio < 0.8) score -= 10;

  if (breadth.newHighsVsLows > 0) score += 15;
  else score -= 10;

  return clamp(score);
}

function scoreMomentum(momentum) {
  let score = 0;

  score += Math.min(35, momentum.positiveSectors * 4);

  if (momentum.spreadTop3Bottom3 > 2.5) score += 25;
  else if (momentum.spreadTop3Bottom3 > 1.2) score += 18;
  else if (momentum.spreadTop3Bottom3 < 0.3) score -= 8;

  if (momentum.pctNifty500HigherHighs > 45) score += 20;
  else if (momentum.pctNifty500HigherHighs > 35) score += 12;
  else if (momentum.pctNifty500HigherHighs < 25) score -= 12;

  if (momentum.leadershipConcentration <= 0.45) score += 15;
  else score -= 5;

  return clamp(score);
}

function scoreMacroLiquidity(macro) {
  let score = 65;

  if (macro.usdInrTrend === "up") score -= 15;
  if (macro.usdInrTrend === "down") score += 8;

  if (macro.gsecTrend === "up") score -= 10;
  if (macro.gsecTrend === "down") score += 6;

  if (macro.rbiStance === "hawkish") score -= 10;
  if (macro.rbiStance === "dovish") score += 6;

  if (macro.fiiNetCr !== null && macro.fiiNetCr < 0) score -= 15;
  if (macro.fiiNetCr !== null && macro.fiiNetCr > 0) score += 10;

  return clamp(score);
}

function computeDecision(score) {
  if (score >= 80) {
    return {
      value: "YES",
      action: "Full position sizing, press risk"
    };
  }
  if (score >= 60) {
    return {
      value: "CAUTION",
      action: "Half size, A+ setups only"
    };
  }
  return {
    value: "NO",
    action: "Avoid trading, preserve capital"
  };
}

function computeExecutionWindow(data) {
  let score = 50;

  if (data.trend.regime === "uptrend") score += 15;
  if (data.trend.bankNiftyAbove50) score += 10;
  if (data.breadth.adRatio > 1.1) score += 10;
  if (data.momentum.spreadTop3Bottom3 > 1.5) score += 8;
  if (data.volatility.vix5dSlope < 0) score += 8;

  if (data.macro.fiiNetCr !== null && data.macro.fiiNetCr > 0) score += 8;
  if (data.macro.fiiNetCr !== null && data.macro.fiiNetCr < 0) score -= 8;

  if (data.volatility.pcr < 0.8) score -= 8;

  return clamp(score);
}

export function runScoringEngine(data, modePreset) {
  const categoryScores = {
    volatility: scoreVolatility(data.volatility),
    momentum: scoreMomentum(data.momentum),
    trend: scoreTrend(data.trend, modePreset),
    breadth: scoreBreadth(data.breadth),
    macroLiquidity: scoreMacroLiquidity(data.macro)
  };

  const marketQualityScore = clamp(
    Object.entries(categoryScores).reduce((acc, [key, score]) => acc + score * SCORE_WEIGHTS[key], 0)
  );

  const decision = computeDecision(marketQualityScore);
  const executionWindowScore = computeExecutionWindow(data);

  return {
    categoryScores,
    marketQualityScore: Number(marketQualityScore.toFixed(1)),
    executionWindowScore: Number(executionWindowScore.toFixed(1)),
    decision
  };
}

export function buildSummary(data, scoreResult, modeName) {
  const tone =
    scoreResult.decision.value === "YES"
      ? "Risk is supportive for selective aggression"
      : scoreResult.decision.value === "CAUTION"
        ? "Conditions are mixed and reward-to-risk is selective"
        : "Environment is fragile and capital protection should dominate";

  return `${tone}. Nifty regime is ${data.trend.regime} with RSI at ${data.trend.rsi14.toFixed(1)} and India VIX at ${data.volatility.vixLevel.toFixed(2)} (${data.volatility.vix5dSlope.toFixed(2)}% 5d slope). Breadth A/D ratio is ${data.breadth.adRatio.toFixed(2)} while FII flows are ${data.macro.fiiNetCr === null ? "unavailable" : data.macro.fiiNetCr >= 0 ? "net positive" : "net negative"}. Execution window reads ${scoreResult.executionWindowScore.toFixed(0)}/100 for ${modeName} mode.`;
}
