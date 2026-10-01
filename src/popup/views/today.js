import {
  CHECKOUT_6H_OFFSET_MS,
  CHECKOUT_8H_OFFSET_MS,
  LATE_AFTER,
  LUNCH_BREAK_MS,
  LUNCH_START_HOUR,
  WEEKDAYS,
  WORK_END,
  WORK_START,
} from "../config.js";
import { el } from "../dom.js";
import { formatCountdown, formatDate, formatDuration, formatTime } from "../format.js";

const SIX_HOURS_MS = 6 * 3600 * 1000;
const OVER_SIX_HOURS_MS = SIX_HOURS_MS + 60 * 1000;
const EIGHT_HOURS_MS = 8 * 3600 * 1000;

function atTime(date, { hour, minute }) {
  const copy = new Date(date);
  copy.setHours(hour, minute, 0, 0);
  return copy;
}

function clampToShift(date) {
  const open = atTime(date, WORK_START);
  const close = atTime(date, WORK_END);
  if (date < open) return open;
  if (date > close) return close;
  return date;
}

function workedMsSince(checkin, now) {
  const raw = now - checkin;
  if (raw <= 0) return 0;

  const lunch = atTime(checkin, { hour: LUNCH_START_HOUR, minute: 0 });
  if (checkin < lunch && now > lunch) {
    return Math.max(0, raw - LUNCH_BREAK_MS);
  }
  return raw;
}

function setStatus(text, live) {
  const node = el("shift-status");
  node.textContent = text;
  node.classList.toggle("live", Boolean(live));
  node.classList.toggle("off", text === "Ngày nghỉ");
}

function resetToday(weekend) {
  setStatus(weekend ? "Ngày nghỉ" : "Chưa check-in", false);
  el("checkin-time").textContent = "--:--";
  el("checkin-time").className = "stat-value serif tnum muted";
  el("worked-time").textContent = "0h00";
  el("worked-time").className = "stat-value serif tnum muted";
  el("checkout1-time").textContent = "--:--";
  el("checkout1-time").className = "val serif tnum muted";
  el("fulltime-time").textContent = "--:--";
  el("fulltime-time").className = "val serif tnum muted";
  el("out-6").classList.remove("done");
  el("out-8").classList.remove("done");
  el("checkout1-left").textContent = "";
  el("fulltime-left").textContent = "";
  el("prog-6").style.width = "0%";
  el("prog-8").style.width = "0%";
  el("progress-hint").textContent = weekend
    ? "Cuối tuần — không cần chấm công"
    : "Bắt đầu ca để theo dõi tiến độ";
  el("late-note").hidden = true;
}

export function renderToday(entries) {
  const now = new Date();
  el("today-date").textContent = `${WEEKDAYS[now.getDay()]}, ${formatDate(now)}`;

  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const todayEntries = entries && entries[now.toISOString().split("T")[0]];
  if (!todayEntries || todayEntries.length === 0) return resetToday(weekend);

  const rawCheckin = new Date(todayEntries[0].fdate.replace(/-/g, "/"));
  if (isNaN(rawCheckin.getTime())) return resetToday(weekend);

  // Công ty chỉ tính công trong khung 07:30–19:30
  const checkin = clampToShift(rawCheckin);
  const mark6 = new Date(checkin.getTime() + CHECKOUT_6H_OFFSET_MS);
  const mark8 = new Date(checkin.getTime() + CHECKOUT_8H_OFFSET_MS);
  const worked = workedMsSince(checkin, clampToShift(now));

  el("checkin-time").textContent = formatTime(checkin);
  el("checkin-time").classList.remove("muted");
  el("worked-time").textContent = formatDuration(worked);
  el("worked-time").className = "stat-value serif tnum accent";

  el("checkout1-time").textContent = formatTime(mark6);
  el("checkout1-time").classList.remove("muted");
  el("fulltime-time").textContent = formatTime(mark8);
  el("fulltime-time").classList.remove("muted");

  const done6 = now >= mark6;
  const done8 = now >= mark8;
  el("out-6").classList.toggle("done", done6);
  el("out-8").classList.toggle("done", done8);

  // Số giờ LÀM còn thiếu, không tính nghỉ trưa
  el("checkout1-left").textContent = done6
    ? "đã đủ"
    : `còn ${formatCountdown(OVER_SIX_HOURS_MS - worked)}`;
  el("fulltime-left").textContent = done8
    ? "đã đủ"
    : `còn ${formatCountdown(EIGHT_HOURS_MS - worked)}`;

  el("prog-6").style.width = `${Math.min(100, (worked / SIX_HOURS_MS) * 100)}%`;
  el("prog-8").style.width =
    worked <= SIX_HOURS_MS
      ? "0%"
      : `${Math.min(100, ((worked - SIX_HOURS_MS) / (EIGHT_HOURS_MS - SIX_HOURS_MS)) * 100)}%`;

  if (done8) {
    setStatus("Đủ 8 tiếng", true);
    el("progress-hint").textContent = "Đã đủ 8 tiếng — về được rồi";
  } else if (done6) {
    setStatus("Đang trong ca", true);
    el("progress-hint").textContent = `Còn ${formatCountdown(EIGHT_HOURS_MS - worked)} nữa là đủ 8 tiếng`;
  } else {
    setStatus("Đang trong ca", true);
    el("progress-hint").textContent = `Còn ${formatCountdown(OVER_SIX_HOURS_MS - worked)} nữa là đủ 6 tiếng`;
  }

  el("late-note").hidden = mark8 < atTime(now, LATE_AFTER);
}
