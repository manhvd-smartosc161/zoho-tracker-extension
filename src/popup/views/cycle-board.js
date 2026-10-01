import { ATTENDANCE_REQUEST_QUOTA, DAYS_6_TO_8_LIMIT } from "../../shared/config.js";
import { fromDateKey, getCycle, lastDayOf } from "../../shared/dates.js";
import { el } from "../dom.js";
import { formatDayLabel, formatHours, formatRange } from "../format.js";
import { countsAgainstQuota, quotaTone, workBand } from "../quota.js";
import { state } from "../state.js";

const ROWS = ["below-6", "below-8", "missing-request", "sent-request", "leave-request"];

const REQUEST_LABELS = {
  pending: { text: "Chờ duyệt", pillClass: "p-pending" },
  approved: { text: "Đã duyệt", pillClass: "p-approved" },
  rejected: { text: "Từ chối", pillClass: "p-rejected" },
  cancelled: { text: "Đã huỷ", pillClass: "" },
};

function setTone(key, tone) {
  const row = el(`${key}-row`);
  row.className = row.className.replace(/\bn-\w+\b/g, "").trim();
  row.classList.add(`n-${tone}`);
}

function makeDrawerHead(title, scale) {
  const li = document.createElement("li");
  li.className = "head";

  const left = document.createElement("span");
  left.textContent = title;

  const right = document.createElement("span");
  right.className = "scale";
  right.textContent = scale;

  li.append(left, right);
  return li;
}

function makeBarRow(day) {
  const li = document.createElement("li");

  const date = document.createElement("span");
  date.className = "d-date";
  date.textContent = formatDayLabel(day.date);

  const bar = document.createElement("span");
  bar.className = "d-bar";
  const fill = document.createElement("i");
  fill.style.width = `${Math.max(3, Math.min(100, day.percent))}%`;
  if (day.low) fill.className = "low";
  bar.appendChild(fill);

  const value = document.createElement("span");
  value.className = "d-val";
  value.textContent = day.label;

  li.append(date, bar, value);
  return li;
}

function makePillRow(day) {
  const li = document.createElement("li");

  const date = document.createElement("span");
  date.className = "d-date";
  date.textContent = formatDayLabel(day.date);

  const pill = document.createElement("span");
  pill.className = `pill ${day.pillClass || ""}`.trim();
  pill.textContent = day.label;

  li.append(date, pill);
  return li;
}

function renderRow(key, days, value, tone, drawer) {
  el(`${key}-count`).textContent = value;
  setTone(key, tone);

  const list = el(`${key}-detail`);
  list.textContent = "";

  if (days.length > 0) {
    const opts = drawer || {};
    list.appendChild(makeDrawerHead(opts.title || `Chi tiết ${days.length} ngày`, opts.scale || ""));
    days.forEach((day) => {
      list.appendChild(opts.pill ? makePillRow(day) : makeBarRow(day));
    });
  }

  const row = el(`${key}-row`);
  row.disabled = days.length === 0;
  row.setAttribute("aria-expanded", "false");
  list.hidden = true;
}

export function bindRows() {
  ROWS.forEach((key) => {
    const row = el(`${key}-row`);
    const list = el(`${key}-detail`);

    row.addEventListener("click", function () {
      if (row.disabled) return;
      const expanded = row.getAttribute("aria-expanded") === "true";
      row.setAttribute("aria-expanded", String(!expanded));
      list.hidden = expanded;
    });
  });
}

function countWorkdaysLeft(from, end) {
  let days = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1);

  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function renderWorkdaysLeft(end) {
  el("absent-count").textContent =
    state.cycleOffset !== 0 ? "–" : countWorkdaysLeft(new Date(), end);
  setTone("absent", "info");
}

export function renderCycleStats(dayList) {
  const cycle = getCycle(new Date(), state.cycleOffset);
  const { start, end } = cycle;
  el("cycle-range").textContent = formatRange(cycle);
  el("cycle-next").disabled = state.cycleOffset >= 0;
  el("cycle-prev").disabled = state.cycleOffset <= -1;

  const below6 = [];
  const between6And8 = [];
  const missingRequest = [];
  let requestUsed = 0;

  const todayKey = new Date().toDateString();

  Object.values(dayList).forEach((day) => {
    const date = new Date(day.orgdate);
    if (date < start || date > end) return;

    // Hôm nay chưa hết ca, chưa biết sẽ đủ giờ hay không
    const isToday = date.toDateString() === todayKey;

    const tsecs = day.tsecs || 0;
    const status = (day.status || "").trim();

    if (tsecs > 0 && !isToday) {
      const band = workBand(tsecs);
      if (band === "low") {
        below6.push({
          date,
          label: formatHours(tsecs),
          percent: (tsecs / (6 * 3600)) * 100,
          low: true,
        });
      } else if (band === "mid") {
        between6And8.push({
          date,
          label: formatHours(tsecs),
          percent: ((tsecs - 6 * 3600) / (2 * 3600)) * 100,
        });
      }
    }

    if (day.approvalInfo) requestUsed++;
    if (status === "Absent" && !isToday && !day.approvalInfo && !day.leaveDaysTaken) {
      missingRequest.push({ date, label: "Chưa tạo request", pillClass: "p-rejected" });
    }
  });

  [below6, between6And8, missingRequest].forEach((days) =>
    days.sort((a, b) => a.date - b.date)
  );

  const used = between6And8.length;
  renderRow("below-8", between6And8, `${used}/${DAYS_6_TO_8_LIMIT}`, quotaTone(used, DAYS_6_TO_8_LIMIT), {
    scale: "thang đo 6h → 8h",
    title: `${used} ngày làm 6–8 tiếng`,
  });

  renderRow("below-6", below6, below6.length, below6.length ? "bad" : "ok", {
    scale: "thang đo 0 → 6h",
    title: `${below6.length} ngày dưới 6 tiếng`,
  });

  renderRow("missing-request", missingRequest, missingRequest.length, missingRequest.length ? "bad" : "ok", {
    pill: true,
    scale: "cần tạo request",
    title: `${missingRequest.length} ngày vắng mặt`,
  });

  renderWorkdaysLeft(lastDayOf(cycle));

  state.requestUsed = requestUsed;
}

export function resetCycleStats() {
  el("cycle-range").textContent = "";
  ROWS.forEach((key) => renderRow(key, [], "–", "mute", {}));
  el("absent-count").textContent = "–";
  setTone("absent", "info");
  state.requestUsed = 0;
}

function toPillDays(rows, withType) {
  return rows.map((request) => {
    const label = REQUEST_LABELS[request.status] || {
      text: request.statusText || "—",
      pillClass: "",
    };
    const type =
      withType && request.leaveType
        ? ` · ${request.leaveType.replace(/ ?leave$/i, "")}`
        : "";
    return {
      date: fromDateKey(request.date),
      label: `${label.text}${type}`,
      pillClass: label.pillClass,
    };
  });
}

function inCurrentCycle(request) {
  const { start, end } = getCycle(new Date(), state.cycleOffset);
  const date = fromDateKey(request.date);
  return date >= start && date < end;
}

function renderRequestRow(key, requests, withType, quota) {
  const rows = (requests || []).filter(inCurrentCycle);
  const active = rows.filter(countsAgainstQuota);
  const pending = rows.filter((r) => r.status === "pending").length;
  const drawer = {
    pill: true,
    scale: pending > 0 ? `${pending} chờ duyệt` : "đã xử lý xong",
    title: `${active.length} ${withType ? "đơn nghỉ phép" : "request chấm công"}`,
  };

  if (!quota) {
    renderRow(key, toPillDays(rows, withType), String(active.length), "ok", drawer);
    return;
  }

  renderRow(key, toPillDays(rows, withType), `${active.length}/${quota}`, quotaTone(active.length, quota), drawer);
}

export function renderRequests(requests) {
  renderRequestRow("sent-request", requests, false, ATTENDANCE_REQUEST_QUOTA);
}

export function renderLeaveRequests(requests) {
  renderRequestRow("leave-request", requests, true, 0);
}
