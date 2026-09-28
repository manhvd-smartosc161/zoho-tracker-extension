import { PORTAL } from "../shared/config.js";

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
  const response = await fetch(`${PORTAL}/${path}`, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${PORTAL}/zp`,
    },
    credentials: "include",
    redirect: "follow",
    body: new URLSearchParams(params),
  });

  // Bị đá sang trang đăng nhập -> session hết hạn
  if (response.redirected && /accounts\.zoho\.com|signin/.test(response.url)) {
    throw Object.assign(new Error("Zoho chuyển hướng sang trang đăng nhập"), {
      kind: "SESSION_EXPIRED",
    });
  }

  return assertJsonResponse(await response.text(), response.status);
}

export async function readCredentials(keys) {
  return chrome.storage.local.get(keys || ["csrfToken", "erecno"]);
}
