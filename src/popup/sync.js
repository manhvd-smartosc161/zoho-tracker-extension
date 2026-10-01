import { el } from "./dom.js";
import { formatTime } from "./format.js";
import { mergeRequests } from "./quota.js";
import { state } from "./state.js";
import { renderLeaveRequests, renderRequests, renderCycleStats, resetCycleStats } from "./views/cycle-board.js";
import { renderLeaveList } from "./views/leave-list.js";
import { renderLock } from "./views/lock.js";
import { renderToday } from "./views/today.js";

const STORAGE_KEYS = [
  "attendanceData",
  "leaveData",
  "leaveError",
  "requestData",
  "leaveRequestData",
  "syncError",
  "lastUpdated",
];

function renderUpdatedStamp(lastUpdated, fullName) {
  const stamp = lastUpdated ? formatTime(new Date(lastUpdated)) : "";
  const updated = el("last-updated");
  const name = String(fullName || "").trim();
  updated.classList.toggle("err", state.lastSyncFailed);
  updated.title = fullName || "";
  if (state.lastSyncFailed) {
    updated.textContent = `Cập nhật lỗi${stamp ? ` · dữ liệu lúc ${stamp}` : ""}`;
    return;
  }
  updated.textContent = [name ? `Chào ${name}` : "", stamp ? `Cập nhật ${stamp}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export function render() {
  chrome.storage.local.get(STORAGE_KEYS, function (data) {
    if (renderLock(data.syncError)) return;
    const attendance = data.attendanceData;
    renderUpdatedStamp(data.lastUpdated, attendance && attendance.userDetails && attendance.userDetails.fName);

    state.dayList = (attendance && attendance.dayList) || {};
    state.requests = mergeRequests(data.requestData, state.dayList);
    state.leaveTypes = data.leaveData || [];
    state.leaveRequests = data.leaveRequestData || [];
    if (attendance && attendance.dayList) renderCycleStats(attendance.dayList);
    else resetCycleStats();

    renderLeaveList(data.leaveData, data.leaveError, state.requestUsed);
    renderRequests(state.requests);
    renderLeaveRequests(data.leaveRequestData);
    renderToday(attendance && attendance.entries);
  });
}

export function requestUpdate(onDone) {
  const refreshBtn = el("refreshBtn");
  refreshBtn.disabled = true;
  refreshBtn.classList.add("spinning");

  chrome.runtime.sendMessage({ action: "updateAttendance" }, function (res) {
    refreshBtn.disabled = false;
    refreshBtn.classList.remove("spinning");

    const ok = res && res.status === "success";
    state.lastSyncFailed = !ok;
    refreshBtn.classList.toggle("err", !ok);
    refreshBtn.title = ok ? "Cập nhật dữ liệu" : "Cập nhật thất bại — thử lại";

    render();
    if (onDone) onDone(ok);
  });
}
