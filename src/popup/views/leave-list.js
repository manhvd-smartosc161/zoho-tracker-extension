import { ATTENDANCE_REQUEST_QUOTA } from "../../shared/config.js";
import { el } from "../dom.js";
import { titleCaseLeave } from "../format.js";

function makeQuota(name, used, total) {
  const row = document.createElement("div");
  row.className = "quota";

  const top = document.createElement("div");
  top.className = "top";

  const label = document.createElement("span");
  label.className = "name";
  label.textContent = name;
  label.title = name;

  const nums = document.createElement("span");
  nums.className = "nums tnum";
  nums.textContent = `${used}/${total}`;

  top.append(label, nums);

  const pips = document.createElement("div");
  pips.className = "pips";
  for (let i = 0; i < Math.max(total, 1); i++) {
    const pip = document.createElement("i");
    if (i < used) pip.className = "on";
    pips.appendChild(pip);
  }

  row.append(top, pips);
  return row;
}

export function renderLeaveList(balances, error, requestUsed) {
  const container = el("leave-list");
  container.textContent = "";

  const rows = balances || [];
  if (rows.length === 0) {
    const note = document.createElement("div");
    note.className = "quota-empty";
    note.textContent = error || "Chưa có dữ liệu phép — bấm nút ↻ ở góc trên để cập nhật.";
    container.appendChild(note);
    el("leave-aside").textContent = "";
  } else {
    rows.forEach((leave) => {
      container.appendChild(makeQuota(titleCaseLeave(leave.name), leave.used, leave.total));
    });

    const annual = rows.find((r) => /annual/i.test(r.name)) || rows[0];
    const left = Math.max(0, annual.total - annual.used);
    el("leave-aside").textContent = `còn ${left} ngày ${annual.name.replace(/ ?leave$/i, "")}`;
  }

  container.appendChild(makeQuota("Attendance", requestUsed || 0, ATTENDANCE_REQUEST_QUOTA));
}
