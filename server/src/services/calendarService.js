import { nowIST } from "../utils/time.js";

const RBI_MPC_DATES_2026 = [
  "2026-04-08",
  "2026-06-05",
  "2026-08-06",
  "2026-10-09",
  "2026-12-04"
];

function isWithinHours(targetISO, now, hours) {
  const target = new Date(`${targetISO}T10:00:00+05:30`).getTime();
  const diffHours = (target - now.toDate().getTime()) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours <= hours;
}

function nextWeeklyExpiry(now) {
  const date = new Date(now.toDate().getTime());
  const day = date.getDay();
  const distance = (4 - day + 7) % 7;
  date.setDate(date.getDate() + distance);
  date.setHours(15, 30, 0, 0);
  return date;
}

export function buildMacroAlerts() {
  const now = nowIST();
  const alerts = [];

  const mpcSoon = RBI_MPC_DATES_2026.some((date) => isWithinHours(date, now, 72));
  if (mpcSoon) {
    alerts.push({
      level: "amber",
      code: "RBI_MPC_SOON",
      message: "RBI MPC event risk within 72 hours. Reduce size and avoid late entries."
    });
  }

  const weeklyExpiry = nextWeeklyExpiry(now);
  const hoursToExpiry = (weeklyExpiry.getTime() - now.toDate().getTime()) / (1000 * 60 * 60);
  if (hoursToExpiry >= 0 && hoursToExpiry <= 24) {
    alerts.push({
      level: "amber",
      code: "FO_EXPIRY",
      message: "Weekly F&O expiry within 24 hours. Expect whipsaws and pin-risk behavior."
    });
  }

  const dayOfMonth = now.date();
  if (dayOfMonth === 11 || dayOfMonth === 12) {
    alerts.push({
      level: "amber",
      code: "CPI_WINDOW",
      message: "India CPI/IIP release window is active. Macro volatility can spike."
    });
  }

  if (now.month() === 1 && dayOfMonth >= 1 && dayOfMonth <= 10) {
    alerts.push({
      level: "amber",
      code: "UNION_BUDGET",
      message: "Union Budget window active. Headline risk remains elevated."
    });
  }

  return alerts;
}
