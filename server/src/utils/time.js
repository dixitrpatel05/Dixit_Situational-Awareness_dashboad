import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const IST_TZ = "Asia/Kolkata";

export function nowIST() {
  return dayjs().tz(IST_TZ);
}

export function isMarketOpen(now = nowIST()) {
  if (!isTradingDay(now)) {
    return false;
  }
  const currentMinutes = now.hour() * 60 + now.minute();
  const open = 9 * 60 + 15;
  const close = 15 * 60 + 30;
  return currentMinutes >= open && currentMinutes <= close;
}

export function isTradingDay(now = nowIST()) {
  const day = now.day();
  return day !== 0 && day !== 6;
}

export function isAfterEodCutoff(now = nowIST(), hour = 16, minute = 30) {
  if (!isTradingDay(now)) {
    return false;
  }
  const currentMinutes = now.hour() * 60 + now.minute();
  return currentMinutes >= hour * 60 + minute;
}

export function istDate(now = nowIST()) {
  return now.format("YYYY-MM-DD");
}

export function secondsSince(dateISO) {
  if (!dateISO) {
    return null;
  }
  const now = dayjs();
  const then = dayjs(dateISO);
  return now.diff(then, "second");
}
