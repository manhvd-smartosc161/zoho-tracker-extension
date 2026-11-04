import { PORTAL } from "./config.js";

export const INVALID_CSRF = /INVALID_CSRF_TOKEN/;

async function zohoTab(open) {
  const [existing] = await chrome.tabs.query({ url: "https://people.zoho.com/*" });
  if (existing && existing.status === "complete") return existing.id;
  if (!existing && open === false) return null;
  const tab = existing || (await chrome.tabs.create({ url: `${PORTAL}/zp`, active: false }));
  await new Promise((resolve) => {
    const done = (tabId, info) => {
      if (tabId !== tab.id || info.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(done);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(done);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(done);
      resolve();
    }, 15000);
  });
  return tab.id;
}

export async function sendViaTab(url, init) {
  const tabId = await zohoTab(true);
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [url, init],
    func: async (target, options) => {
      const match = /(?:^|;\s*)(?:CSRF_TOKEN|CT_CSRF_TOKEN)=([^;]+)/.exec(document.cookie);
      const token = match ? decodeURIComponent(match[1]) : "";
      let body = options.body;
      if (token) {
        body = body
          .replace(/(^|&)conreqcsr=[^&]*/, `$1conreqcsr=${encodeURIComponent(token)}`)
          .replace(/(name="conreqcsr"\r\n\r\n)[^\r]*/, `$1${token}`);
      }
      const res = await fetch(target, { ...options, body, credentials: "include" });
      return { status: res.status, ok: res.ok, redirected: res.redirected, url: res.url, text: await res.text() };
    },
  });
  if (!result || !result.result) throw new Error("Không gửi được yêu cầu qua tab Zoho — mở people.zoho.com rồi thử lại.");
  return result.result;
}

export async function readTabCsrf() {
  const tabId = await zohoTab(false);
  if (!tabId) return "";
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        const match = /(?:^|;\s*)(?:CSRF_TOKEN|CT_CSRF_TOKEN)=([^;]+)/.exec(document.cookie);
        return match ? decodeURIComponent(match[1]) : "";
      },
    });
    return (result && result.result) || "";
  } catch {
    return "";
  }
}
