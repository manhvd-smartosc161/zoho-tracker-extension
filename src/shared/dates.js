import { CYCLE_START_DAY } from "./config.js";

const ZOHO_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DAY_MS = 86400000;

export const pad = (n) => String(n).padStart(2, "0");

export function dateKeyOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(key) {
  return new Date(`${key}T00:00:00`);
}

export function formatZohoDate(date) {
  return `${pad(date.getDate())}-${ZOHO_MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

// "17-Sep-2026" -> Date
export function parseZohoDate(text) {
  const parts = String(text || "").split("-");
  if (parts.length !== 3) return null;
  const month = ZOHO_MONTHS.indexOf(parts[1]);
  if (month < 0) return null;
  const date = new Date(Number(parts[2]), month, Number(parts[0]));
  return isNaN(date.getTime()) ? null : date;
}

export function getCycle(today, offset) {
  const anchor = (today.getDate() >= CYCLE_START_DAY ? 0 : -1) + (offset || 0);
  return {
    start: new Date(today.getFullYear(), today.getMonth() + anchor, CYCLE_START_DAY),
    end: new Date(today.getFullYear(), today.getMonth() + anchor + 1, CYCLE_START_DAY),
  };
}

export function lastDayOf(cycle) {
  return new Date(cycle.end.getTime() - DAY_MS);
}

// Lấy rộng 2 chu kỳ để popup xem được cả tháng trước
export function getFetchRange(today) {
  return {
    start: getCycle(today, -1).start,
    end: lastDayOf(getCycle(today, 0)),
  };
}
