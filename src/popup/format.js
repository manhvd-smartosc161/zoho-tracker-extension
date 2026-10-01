import { lastDayOf, pad } from "../shared/dates.js";
import { SHORT_WEEKDAYS } from "./config.js";

export function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDate(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

export function formatDayLabel(date) {
  return `${SHORT_WEEKDAYS[date.getDay()]} ${formatDate(date)}`;
}

export function formatRange(cycle) {
  return `${formatDate(cycle.start)} → ${formatDate(lastDayOf(cycle))}`;
}

export function formatDuration(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(minutes / 60)}h${pad(minutes % 60)}`;
}

export function formatHours(tsecs) {
  const minutes = Math.floor(tsecs / 60);
  return `${Math.floor(minutes / 60)}h${pad(minutes % 60)}`;
}

export function formatCountdown(ms) {
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} tiếng` : `${hours}h${pad(rest)}`;
}

export function minutesToTime(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function titleCaseLeave(name) {
  return String(name || "").replace(/\bleave\b/g, "Leave");
}

export function leaveShortName(type) {
  return titleCaseLeave(type.name).replace(/ ?leave$/i, "");
}
