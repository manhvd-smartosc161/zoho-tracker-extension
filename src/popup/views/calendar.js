import { dateKeyOf, getCycle, lastDayOf } from "../../shared/dates.js";
import { el } from "../dom.js";
import { confirmCancel, confirmCreate } from "../flows.js";
import { formatDayLabel, formatHours, formatRange } from "../format.js";
import { requestSeconds } from "../quota.js";
import { state } from "../state.js";
import { closeCellMenu, openCellMenu } from "../ui/cell-menu.js";

const FULL_SECS = 8 * 3600;
const MID_SECS = 6 * 3600;

const REQ_LABELS = {
  pending: { text: "Chờ", cls: "r-pending" },
  approved: { text: "Duyệt", cls: "r-approved" },
  rejected: { text: "Từ chối", cls: "r-rejected" },
};

function hoursTone(tsecs) {
  if (tsecs >= FULL_SECS) return "h-full";
  if (tsecs >= MID_SECS) return "h-mid";
  if (tsecs > 0) return "h-low";
  return "";
}

function calCell(className, parts, tag) {
  const cell = document.createElement(tag || "div");
  cell.className = className;
  parts.filter(Boolean).forEach((p) => cell.appendChild(p));
  return cell;
}

function calLine(className, text) {
  if (!text) return null;
  const node = document.createElement("div");
  node.className = className;
  node.textContent = text;
  return node;
}

function indexDays(dayList) {
  const index = {};
  Object.values(dayList).forEach((day) => {
    const date = new Date(day.orgdate);
    if (isNaN(date.getTime())) return;
    index[dateKeyOf(date)] = day;
  });
  return index;
}

function pickRequest(key) {
  const sameDay = state.requests.filter((r) => r.date === key);
  return (
    sameDay.find((r) => r.status === "pending") ||
    sameDay.find((r) => r.status === "approved") ||
    sameDay[0]
  );
}

function renderSummary(totals) {
  const sum = el("cal-sum");
  sum.textContent = "";
  [
    { num: totals.full, cap: "Đủ 8 tiếng", tone: "n-ok" },
    { num: totals.mid, cap: "6–8 tiếng", tone: "n-warn" },
    { num: totals.low, cap: "Dưới 6 tiếng", tone: "n-bad" },
    { num: totals.absent, cap: "Vắng", tone: "n-bad" },
  ].forEach((cell) => {
    sum.appendChild(
      calCell(`cell ${cell.tone}`, [
        calLine("num", String(cell.num)),
        calLine("cap", cell.cap),
      ])
    );
  });
}

function buildDayCell(date, day, today, totals) {
  const key = dateKeyOf(date);
  const tsecs = (day && day.tsecs) || 0;
  const weekend = date.getDay() === 0 || date.getDay() === 6;

  const classes = ["cal-day"];
  if (weekend) classes.push("weekend");
  if (date.getTime() === today.getTime()) classes.push("today");

  const request = pickRequest(key);
  const leaveReq = state.leaveRequests.find((r) => r.date === key && r.status === "pending");
  const pendingSecs = request && request.status === "pending" ? requestSeconds(request) : 0;

  const parts = [calLine("dnum", String(date.getDate()))];
  let shortDay = false;

  if (pendingSecs > 0) {
    parts.push(calLine("hrs", formatHours(pendingSecs)));
    classes.push(hoursTone(pendingSecs));
  } else if (tsecs > 0) {
    parts.push(calLine("hrs", formatHours(tsecs)));
    classes.push(hoursTone(tsecs));
    if (tsecs >= FULL_SECS) totals.full++;
    else if (tsecs >= MID_SECS) {
      totals.mid++;
      shortDay = true;
    } else {
      totals.low++;
      shortDay = true;
    }
  } else if (day && day.leaveDaysTaken) {
    parts.push(calLine("mark m-leave", day.leaveDaysTaken === 0.5 ? "Leave ½" : "Leave"));
  } else if (leaveReq && !weekend) {
    parts.push(calLine("mark m-leave", leaveReq.days === 0.5 ? "Leave ½" : "Leave"));
    parts.push(calLine("req r-pending", "Chờ"));
  } else if (day && (day.status || "").trim() === "Absent" && !weekend) {
    parts.push(calLine("mark m-absent", "Vắng"));
    classes.push("is-absent");
    shortDay = true;
    if (!day.approvalInfo) totals.absent++;
  }

  if (leaveReq) shortDay = false;

  if (pendingSecs > 0) {
    if (pendingSecs >= FULL_SECS) totals.full++;
    else if (pendingSecs >= MID_SECS) totals.mid++;
    else totals.low++;
  }

  const label = formatDayLabel(date);
  const past = date < today;

  if (request) {
    const info = REQ_LABELS[request.status];
    if (info) parts.push(calLine(`req ${info.cls}`, info.text));
    if (request.status === "approved" && tsecs >= FULL_SECS) classes.push("is-approved");
  }

  // Đơn đã huỷ hoặc bị từ chối không chặn việc tạo lại
  const blocking = request && request.status !== "cancelled" && request.status !== "rejected";
  const cancellable = request && request.status === "pending";
  const creatable = !cancellable && !blocking && shortDay && past;

  const cell = calCell(
    classes.filter(Boolean).join(" "),
    parts,
    cancellable || creatable ? "button" : "div"
  );
  cell.dataset.key = key;
  const summary = parts
    .slice(1)
    .filter(Boolean)
    .map((p) => p.textContent)
    .join(", ");

  if (cancellable) {
    cell.type = "button";
    cell.className += " has-req";
    cell.title = "Bấm để huỷ request";
    cell.setAttribute("aria-label", `${label}, ${summary} — huỷ request`);
    cell.addEventListener("click", () => confirmCancel(request, label, key));
  } else if (creatable) {
    const absentDay = classes.includes("is-absent");
    cell.type = "button";
    cell.className += " actionable";
    cell.title = absentDay ? "Bấm để chọn loại request" : "Bấm để tạo request chấm công";
    cell.setAttribute(
      "aria-label",
      `${label}, ${summary} — ${absentDay ? "chọn loại request" : "tạo request chấm công"}`
    );
    if (absentDay) cell.setAttribute("aria-haspopup", "menu");
    cell.addEventListener("click", (event) => {
      if (absentDay) openCellMenu(cell, event, key, label);
      else confirmCreate(key, label);
    });
  } else if (shortDay) {
    // Nói rõ vì sao không bấm được
    cell.title = !past
      ? "Chưa qua ngày — chưa tạo được request"
      : `Đã có request (${(request && request.statusText) || "đã duyệt"})`;
  }

  return cell;
}

export function renderCalendar() {
  closeCellMenu();
  const cycle = getCycle(new Date(), state.calOffset);
  const last = lastDayOf(cycle);

  el("cal-month").textContent = formatRange(cycle);

  const index = indexDays(state.dayList);
  const container = el("cal-days");
  container.textContent = "";

  const lead = (cycle.start.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) {
    container.appendChild(calCell("cal-day blank", []));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totals = { full: 0, mid: 0, low: 0, absent: 0 };
  let cells = 0;

  for (let date = new Date(cycle.start); date <= last; date.setDate(date.getDate() + 1)) {
    const day = new Date(date);
    container.appendChild(buildDayCell(day, index[dateKeyOf(day)], today, totals));
    cells++;
  }

  const tail = (lead + cells) % 7;
  if (tail) {
    for (let i = tail; i < 7; i++) {
      container.appendChild(calCell("cal-day blank", []));
    }
  }

  renderSummary(totals);

  el("cal-next").disabled = state.calOffset >= 0;
  el("cal-prev").disabled = state.calOffset <= -2;
}

export function toggleCalendar(show) {
  el("calendar-view").hidden = !show;
  el("cycle-board").hidden = show;
  el("hero").hidden = show;
  el("calendarBtn").setAttribute("aria-pressed", String(show));
  el("calendarBtn").title = show ? "Quay lại tổng quan" : "Xem lịch chấm công";
  if (show) renderCalendar();
}
