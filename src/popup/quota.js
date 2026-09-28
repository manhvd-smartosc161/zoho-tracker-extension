import { ATTENDANCE_REQUEST_QUOTA } from "../shared/config.js";
import { dateKeyOf, fromDateKey, getCycle, parseZohoDate } from "../shared/dates.js";
import { LUNCH_BREAK_MS } from "./config.js";
import { formatDate, formatRange } from "./format.js";
import { state } from "./state.js";

// Đơn huỷ hoặc bị từ chối không tốn hạn mức
export function countsAgainstQuota(request) {
  return request.status !== "cancelled" && request.status !== "rejected";
}

export function quotaTone(used, quota) {
  if (used >= quota) return "limit";
  if (used >= quota - 1) return "warn";
  return "ok";
}

export function mergeRequests(requests, dayList) {
  const merged = (requests || []).slice();
  const taken = new Set(
    merged.filter(countsAgainstQuota).map((request) => request.date)
  );
  Object.values(dayList || {}).forEach((day) => {
    const info = day.approvalInfo;
    if (!info || info.isRegularized === false) return;
    const date = parseZohoDate(info.originday) || new Date(day.orgdate);
    if (!date || isNaN(date.getTime())) return;
    const key = dateKeyOf(date);
    if (taken.has(key)) return;
    taken.add(key);
    const clock = (text) => (/(\d{1,2}:\d{2})\s*$/.exec(String(text || "")) || [])[1] || "";
    merged.push({
      date: key,
      status: "approved",
      statusText: "Approved",
      recordId: String(info.recordId || info.regDetailsId || ""),
      inTime: clock(info.new_intime),
      outTime: clock(info.new_outtime),
    });
  });
  return merged.sort((a, b) => a.date.localeCompare(b.date));
}

export function attendanceQuota(dateKey) {
  const cycle = getCycle(fromDateKey(dateKey), 0);
  const usedDays = state.requests
    .filter((request) => {
      const date = fromDateKey(request.date);
      return date >= cycle.start && date < cycle.end && countsAgainstQuota(request);
    })
    .map((request) => request.date)
    .sort();
  const used = usedDays.length;
  return {
    used,
    usedDays,
    left: Math.max(0, ATTENDANCE_REQUEST_QUOTA - used),
    range: formatRange(cycle),
    nextStart: formatDate(cycle.end),
  };
}

export function requestSeconds(request) {
  const toMinutes = (text) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || "").trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const from = toMinutes(request.inTime);
  const to = toMinutes(request.outTime);
  if (from === null || to === null || to <= from) return 0;
  const secs = (to - from) * 60 - LUNCH_BREAK_MS / 1000;
  return secs > 0 ? secs : 0;
}

export function leaveLeft(type) {
  const left = Number.isFinite(type.balance)
    ? type.balance
    : (type.total || 0) - (type.used || 0);
  return Math.max(0, left);
}

export function leaveTypes() {
  return (state.leaveTypes || []).filter((t) => t.id);
}

export function leaveExhausted() {
  const types = leaveTypes();
  return types.length > 0 && types.every((type) => leaveLeft(type) <= 0);
}
