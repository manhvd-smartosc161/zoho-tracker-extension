import { LEAVE_DURATIONS, SHIFT_FROM, SHIFT_TO, leaveDuration } from "../config.js";
import { el } from "../dom.js";
import { leaveShortName, minutesToTime } from "../format.js";
import { leaveLeft, leaveTypes } from "../quota.js";

export function setupShiftFields() {
  el("shift-from").value = minutesToTime(SHIFT_FROM);
  el("shift-to").value = minutesToTime(SHIFT_TO);
}

export function readTimeField(id) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(el(id).value || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function selectedLeaveType() {
  const id = el("leave-type").value;
  return leaveTypes().find((type) => String(type.id) === String(id)) || null;
}

export function showReasonError(show) {
  el("leave-reason-err").hidden = !show;
  el("leave-reason").classList.toggle("invalid", Boolean(show));
  el("leave-reason").setAttribute("aria-invalid", String(Boolean(show)));
}

function fitLeaveDuration() {
  const type = selectedLeaveType();
  const duration = el("leave-duration");
  const current = LEAVE_DURATIONS.find((d) => d.value === duration.value);
  if (!type || (current && current.days <= leaveLeft(type))) return;
  const fit = LEAVE_DURATIONS.find((d) => d.days <= leaveLeft(type));
  if (fit) duration.value = fit.value;
}

export function refreshLeaveTotal() {
  const spec = leaveDuration(el("leave-duration").value);
  const type = selectedLeaveType();
  const left = type ? leaveLeft(type) : 0;
  el("leave-total").textContent = `${spec.days} ngày`;
  el("leave-left").textContent = type ? ` · còn ${left} ngày ${leaveShortName(type)}` : "";
  const over = Boolean(type) && spec.days > left;
  el("leave-over").hidden = !over;
  el("leave-over").textContent = over
    ? `Chỉ còn ${left} ngày ${leaveShortName(type)} — chọn thời lượng ngắn hơn hoặc loại phép khác.`
    : "";
  el("leave-duration").setAttribute("aria-invalid", String(over));
  return !over;
}

export function setupLeaveForm(types) {
  const select = el("leave-type");
  select.textContent = "";
  types.forEach((type) => {
    const opt = document.createElement("option");
    opt.value = type.id;
    const left = leaveLeft(type);
    opt.textContent = left > 0 ? `${leaveShortName(type)} (còn ${left})` : `${leaveShortName(type)} (hết)`;
    opt.disabled = left <= 0;
    select.appendChild(opt);
  });
  const firstOpen = types.find((type) => leaveLeft(type) > 0);
  if (firstOpen) select.value = firstOpen.id;

  const duration = el("leave-duration");
  duration.textContent = "";
  LEAVE_DURATIONS.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.value;
    opt.textContent = item.text;
    duration.appendChild(opt);
  });
  fitLeaveDuration();
  select.onchange = function () {
    fitLeaveDuration();
    refreshLeaveTotal();
  };

  const reasonBox = el("leave-reason");
  reasonBox.value = "";
  showReasonError(false);
  reasonBox.oninput = function () {
    if (this.value.trim()) showReasonError(false);
  };
  refreshLeaveTotal();
  duration.onchange = refreshLeaveTotal;
}
