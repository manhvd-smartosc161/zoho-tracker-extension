import { el } from "../dom.js";

const TOAST_CHECK = "M5 12.5l4.2 4.2L19 7";
const TOAST_CROSS = "M7 7l10 10M17 7L7 17";

let toastTimer = null;

function hideToast() {
  clearTimeout(toastTimer);
  el("toast").classList.remove("show");
}

export function showToast(text, isError) {
  const box = el("toast");
  el("toast-text").textContent = text;
  const path = box.querySelector(".ic svg path");
  if (path) path.setAttribute("d", isError ? TOAST_CROSS : TOAST_CHECK);
  box.classList.toggle("is-danger", Boolean(isError));
  el("toast-close").hidden = !isError;
  box.classList.add("show");
  clearTimeout(toastTimer);
  if (!isError) toastTimer = setTimeout(hideToast, 2600);
}

export function bindToast() {
  el("toast-close").addEventListener("click", hideToast);
}
