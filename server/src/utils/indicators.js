export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function sma(values, period) {
  if (!Array.isArray(values) || values.length < period || period <= 0) {
    return null;
  }
  const slice = values.slice(values.length - period);
  const total = slice.reduce((sum, n) => sum + n, 0);
  return total / period;
}

export function slope(values, points = 5) {
  if (!Array.isArray(values) || values.length < points) {
    return 0;
  }
  const tail = values.slice(values.length - points);
  const start = tail[0];
  const end = tail[tail.length - 1];
  if (!start) {
    return 0;
  }
  return ((end - start) / Math.abs(start)) * 100;
}

export function rsi(values, period = 14) {
  if (!Array.isArray(values) || values.length <= period) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (let i = values.length - period; i < values.length; i += 1) {
    const prev = values[i - 1];
    const curr = values[i];
    const change = curr - prev;
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  if (losses === 0) {
    return 100;
  }

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function percentileRank(values, target) {
  if (!Array.isArray(values) || !values.length || target === null || target === undefined) {
    return null;
  }
  const lessOrEqual = values.filter((v) => v <= target).length;
  return (lessOrEqual / values.length) * 100;
}

export function directionFromNumber(value, flatThreshold = 0.1) {
  if (value > flatThreshold) {
    return "up";
  }
  if (value < -flatThreshold) {
    return "down";
  }
  return "flat";
}
