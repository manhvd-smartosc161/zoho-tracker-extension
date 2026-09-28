import { fetchZohoAttendance } from "./attendance.js";
import { fetchLeaveRequests, fetchZohoLeave } from "./leave.js";
import { fetchZohoRequests } from "./requests.js";
import { ensureErecno, fetchZohoCSRFToken, saveIdentity, setStatus } from "./session.js";

async function syncAll() {
  const token = await fetchZohoCSRFToken();
  if (!token) {
    await setStatus("NO_TOKEN");
    return { status: "error", message: "Chưa có CSRF token" };
  }

  console.log("▶️ Bắt đầu fetch [v4]");

  // Attendance trước: response của nó mang userDetails.eNo
  const attendance = await Promise.allSettled([fetchZohoAttendance()]);
  const erecno = await ensureErecno();
  console.log("▶️ erecno:", erecno || "KHÔNG CÓ");

  const rest = await Promise.allSettled([
    fetchZohoLeave(),
    fetchZohoRequests(),
    fetchLeaveRequests(),
  ]);

  const results = [...attendance, ...rest];
  const names = ["attendance", "leave", "requests", "leave-requests"];
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`❌ ${names[i]}:`, r.reason);
    else console.log(`✅ ${names[i]} xong`);
  });

  // Attendance là nguồn chính: nó hỏng thì coi như cả lần đồng bộ hỏng
  const main = results[0];
  if (main.status === "rejected") {
    const error = main.reason || {};
    await setStatus(error.kind || "NETWORK", error.detail || error.message);
    return { status: "error", message: error.message };
  }

  await setStatus(null);
  return { status: "success" };
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log("🔄 Extension Installed. Fetching CSRF Token...");
  await fetchZohoCSRFToken();
  await fetchZohoAttendance().catch((error) => console.warn("Chưa tải được chấm công:", error.message));
});

// Khi user mở trình duyệt hoặc chuyển tab, kiểm tra lại token
chrome.tabs.onActivated.addListener(async () => {
  await fetchZohoCSRFToken();
});

// Khi user đăng nhập vào Zoho, cập nhật token mới
chrome.cookies.onChanged.addListener(async (changeInfo) => {
  if (
    changeInfo.cookie.domain.includes("people.zoho.com") &&
    changeInfo.cookie.name === "CSRF_TOKEN"
  ) {
    console.log("🔄 CSRF Token Updated:", changeInfo.cookie.value);
    await chrome.storage.local.set({ csrfToken: changeInfo.cookie.value });
  }
});

// Nhận message từ content script và popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("📨 Nhận message:", request.action);

  if (request.action === "saveIdentity") {
    saveIdentity(request.erecno, request.locationId);
    sendResponse({ status: "success" });
    return false;
  }

  if (request.action === "updateAttendance") {
    syncAll()
      .then(sendResponse)
      .catch(async (error) => {
        console.error("❌ updateAttendance:", error);
        await setStatus(error.kind || "NETWORK", error.message);
        sendResponse({ status: "error", message: error.message });
      });
    return true;
  }

  return false;
});
