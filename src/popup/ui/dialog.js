import { ATTENDANCE_REQUEST_QUOTA } from "../../shared/config.js";
import { el } from "../dom.js";
import { setupLeaveForm, setupShiftFields } from "./forms.js";
import { showToast } from "./toast.js";

const ERROR_HINTS = {
  NO_TOKEN: "Chưa đăng nhập Zoho — đăng nhập rồi thử lại.",
  SESSION_EXPIRED: "Phiên đăng nhập hết hạn — đăng nhập lại Zoho.",
  NO_ERECNO: "Chưa lấy được mã nhân viên — mở people.zoho.com một lần.",
};

function describeError(res) {
  let text = (res && ERROR_HINTS[res.kind]) || (res && res.message) || "";
  if (/failed to fetch|networkerror/i.test(text)) {
    text = "Không kết nối được tới Zoho — kiểm tra mạng rồi thử lại.";
  } else if (/limit|exceed/i.test(text)) {
    text = `Đã hết hạn mức ${ATTENDANCE_REQUEST_QUOTA} request trong chu kỳ này.`;
  }

  const lastError = chrome.runtime.lastError && chrome.runtime.lastError.message;
  if (!text && lastError) text = `Lỗi kết nối: ${lastError}`;
  if (!res) text = text || "Service worker không phản hồi — reload extension.";
  return text || "Không gửi được — thử lại sau.";
}

export function askConfirm({
  title,
  message,
  confirmText,
  cancelText,
  danger,
  successText,
  fields,
  leaveFields,
  returnKey,
  notice,
  onConfirm,
  onSuccess,
}) {
  const dialog = el("confirm-dialog");
  const opener = document.activeElement;
  let busy = false;
  const yes = el("confirm-yes");
  const no = el("confirm-no");
  const err = el("confirm-err");

  el("confirm-title").textContent = title;
  el("confirm-msg").innerHTML = message;
  el("confirm-fields").hidden = !fields;
  if (fields) setupShiftFields();

  el("leave-fields").hidden = !leaveFields;
  if (leaveFields) setupLeaveForm(leaveFields);

  yes.textContent = confirmText || "";
  yes.hidden = Boolean(notice);
  no.textContent = cancelText || "Đóng";
  no.classList.toggle("primary", Boolean(notice));
  yes.classList.toggle("danger", Boolean(danger));
  yes.disabled = false;
  no.disabled = false;
  err.hidden = true;
  if (!dialog.open) dialog.showModal();

  function restoreFocus() {
    const target =
      (returnKey && document.querySelector(`.cal-day[data-key="${returnKey}"]`)) ||
      (opener && opener.isConnected ? opener : null);
    if (target && typeof target.focus === "function") target.focus();
  }

  function close() {
    dialog.onclose = null;
    if (dialog.open) dialog.close();
    yes.onclick = null;
    no.onclick = null;
    dialog.onclick = null;
    dialog.oncancel = null;
    restoreFocus();
  }

  no.onclick = close;
  dialog.onclick = (event) => {
    if (event.target === dialog && !busy) close();
  };
  dialog.oncancel = (event) => {
    event.preventDefault();
    if (!busy) close();
  };

  yes.onclick = function () {
    busy = true;
    yes.disabled = true;
    no.disabled = true;
    yes.textContent = "Đang gửi...";
    err.hidden = true;

    onConfirm(function (res) {
      busy = false;
      if (res && res.status === "success") {
        if (onSuccess) onSuccess();
        close();
        if (successText) showToast(successText);
        return;
      }

      yes.disabled = false;
      no.disabled = false;
      yes.textContent = confirmText;

      if (res && res.status === "invalid") {
        err.hidden = true;
        return;
      }

      err.textContent = describeError(res);
      err.hidden = false;
    });
  };
}

export function showNotice(title, message, returnKey) {
  askConfirm({
    title,
    message,
    notice: true,
    cancelText: "Đã hiểu",
    returnKey,
    onConfirm() {},
  });
}
