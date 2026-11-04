import { PORTAL } from "../shared/config.js";
import { INVALID_CSRF, sendViaTab } from "../shared/zoho-tab.js";

// Zoho trả 200 kèm HTML đăng nhập khi session hết hạn -> phải tự nhận biết
function assertJsonResponse(text, status) {
  if (status === 401 || status === 403) {
    throw Object.assign(new Error(`HTTP ${status}`), { kind: "SESSION_EXPIRED" });
  }

  const head = text.slice(0, 400).toLowerCase();
  if (head.includes("<!doctype html") || head.includes("<html") ||
      head.includes("signin") || head.includes("accounts.zoho.com")) {
    throw Object.assign(new Error("Zoho trả trang đăng nhập"), { kind: "SESSION_EXPIRED" });
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw Object.assign(new Error("Response không phải JSON"), {
      kind: "SESSION_EXPIRED",
      detail: text.slice(0, 120),
    });
  }
}

export async function postZoho(path, params) {
  const url = `${PORTAL}/${path}`;
  const init = {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams(params).toString(),
  };

  const response = await fetch(url, { ...init, credentials: "include", redirect: "follow" });
  let res = { status: response.status, redirected: response.redirected, url: response.url, text: await response.text() };

  if (res.status === 400 && INVALID_CSRF.test(res.text)) {
    console.info(`[zoho] ${path}: INVALID_CSRF_TOKEN, gửi lại qua tab Zoho`);
    res = await sendViaTab(url, init);
  }

  // Bị đá sang trang đăng nhập -> session hết hạn
  if (res.redirected && /accounts\.zoho\.com|signin/.test(res.url)) {
    throw Object.assign(new Error("Zoho chuyển hướng sang trang đăng nhập"), {
      kind: "SESSION_EXPIRED",
    });
  }

  if (INVALID_CSRF.test(res.text)) {
    throw Object.assign(new Error("Zoho từ chối mã CSRF"), { kind: "SESSION_EXPIRED", detail: res.text.slice(0, 120) });
  }

  return assertJsonResponse(res.text, res.status);
}

export async function readCredentials(keys) {
  return chrome.storage.local.get(keys || ["csrfToken", "erecno"]);
}
