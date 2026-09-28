import { ATTENDANCE_REQUEST_QUOTA } from "../../shared/config.js";
import { confirmCreate, confirmLeave } from "../flows.js";
import { attendanceQuota, leaveExhausted } from "../quota.js";

const ICON_LEAVE =
  "M8 3v3M16 3v3M4 9h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z";
const ICON_ATTENDANCE = "M12 7v5l3 2M12 3a9 9 0 110 18 9 9 0 010-18z";

let openMenu = null;
let menuTrigger = null;

export function closeCellMenu(restore) {
  if (!openMenu) return;
  openMenu.remove();
  openMenu = null;
  if (restore === true && menuTrigger && menuTrigger.isConnected) menuTrigger.focus();
  menuTrigger = null;
  document.removeEventListener("click", onDocClick, true);
  document.removeEventListener("keydown", onMenuKey, true);
  window.removeEventListener("scroll", closeCellMenu, true);
}

function onDocClick(event) {
  if (openMenu && !openMenu.contains(event.target)) closeCellMenu();
}

function onMenuKey(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeCellMenu(true);
    return;
  }
  if (event.key === "Tab") {
    closeCellMenu(true);
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = [...openMenu.querySelectorAll(".cm-item")];
  const index = items.indexOf(document.activeElement);
  const step = event.key === "ArrowDown" ? 1 : -1;
  event.preventDefault();
  items[(index + step + items.length) % items.length].focus();
}

function menuItem(cls, iconPath, title, sub, state, onSelect) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `cm-item ${cls} ${state || ""}`.trim();
  btn.setAttribute("role", "menuitem");

  const ico = document.createElement("span");
  ico.className = "cm-ico";
  ico.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPath}"/></svg>`;

  const box = document.createElement("span");
  box.className = "cm-label";
  const top = document.createElement("span");
  top.textContent = title;
  const bottom = document.createElement("span");
  bottom.className = "cm-sub";
  bottom.textContent = sub;
  box.append(top, bottom);

  btn.append(ico, box);
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    closeCellMenu();
    onSelect();
  });
  return btn;
}

function placeMenu(menu, cell) {
  const box = cell.getBoundingClientRect();
  const size = menu.getBoundingClientRect();
  const gap = 6;
  let left = box.left + box.width / 2 - size.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - size.width - 8));
  let top = box.bottom + gap;
  if (top + size.height > window.innerHeight - 8) {
    top = box.top - size.height - gap;
    menu.classList.add("flip");
  }
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(Math.max(8, top))}px`;
}

export function openCellMenu(cell, event, dateKey, label) {
  event.stopPropagation();
  closeCellMenu();

  const menu = document.createElement("div");
  menu.className = "cell-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", `Chọn loại request cho ${label}`);
  menuTrigger = cell;

  const head = document.createElement("div");
  head.className = "cm-head";
  head.setAttribute("aria-hidden", "true");
  head.textContent = label;

  const leaveOut = leaveExhausted();
  const quota = attendanceQuota(dateKey);
  const attendanceOut = quota.left <= 0;

  const leave = menuItem(
    "cm-leave",
    ICON_LEAVE,
    "Request leave",
    leaveOut ? "Đã hết ngày phép năm nay" : "Xin nghỉ phép",
    leaveOut ? "is-out" : "",
    () => confirmLeave(dateKey, label, cell)
  );

  const attendance = menuItem(
    "cm-att",
    ICON_ATTENDANCE,
    "Request attendance",
    attendanceOut
      ? `Đã hết ${ATTENDANCE_REQUEST_QUOTA} request chu kỳ này`
      : `Bổ sung chấm công · còn ${quota.left}/${ATTENDANCE_REQUEST_QUOTA}`,
    attendanceOut ? "is-out" : "",
    () => confirmCreate(dateKey, label)
  );

  menu.append(head, leave, attendance);
  document.body.appendChild(menu);
  openMenu = menu;

  placeMenu(menu, cell);
  menu.classList.add("show");

  document.addEventListener("click", onDocClick, true);
  document.addEventListener("keydown", onMenuKey, true);
  window.addEventListener("scroll", closeCellMenu, true);
  (menu.querySelector(".cm-item:not(.is-out)") || leave).focus();
}
