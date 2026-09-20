const ERROR_KINDS = {
  NO_TOKEN: "Chưa đăng nhập Zoho People.",
  SESSION_EXPIRED: "Phiên đăng nhập đã hết hạn.",
  NO_ERECNO: "Chưa lấy được mã nhân viên.",
  NETWORK: "Không kết nối được tới Zoho.",
};

async function setStatus(kind, detail) {
  await chrome.storage.local.set({
    syncError: kind ? { kind, message: ERROR_KINDS[kind] || kind, detail: detail || "", at: Date.now() } : null,
  });
  if (kind) console.warn("⚠️", ERROR_KINDS[kind] || kind, detail || "");
}

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

async function fetchZohoAttendance() {
  // Kiểm tra token trong Chrome Storage trước
  const storageData = await chrome.storage.local.get("csrfToken");
  let csrfToken = storageData.csrfToken;

  // Nếu không có token, yêu cầu người dùng đăng nhập Zoho
  if (!csrfToken) {
    throw Object.assign(new Error("Chưa có csrfToken"), { kind: "NO_TOKEN" });
  }

  const url =
    "https://people.zoho.com/hrportal1524046581683/AttendanceViewAction.zp";
  const requestBody = new URLSearchParams({
    mode: "getAttList",
    conreqcsr: csrfToken,
    loadToday: "false",
    view: "month",
    preMonth: "0",
  });

  const requestBody2 = new URLSearchParams({
    mode: "getAttList",
    conreqcsr: csrfToken,
    loadToday: "false",
    view: "month",
    preMonth: "1",
  });

  const headers = {
    Accept: "*/*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    Cookie: "people_v5=enabled; _your_other_cookies_here_",
  };
  const headers2 = {
    Accept: "*/*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    Cookie: "people_v5=enabled; _your_other_cookies_here_",
  };
  try {
    const response1 = await fetch(url, {
      method: "POST",
      headers: headers,
      body: requestBody,
    });
    const response2 = await fetch(url, {
      method: "POST",
      headers: headers2,
      body: requestBody2,
    });

    const dataThisMonth = assertJsonResponse(await response1.text(), response1.status);
    const dataLastMonth = assertJsonResponse(await response2.text(), response2.status);

    // Gộp dayList và đánh lại key từ 1 đến hết
    const combinedDayList = {};

    // Lấy dữ liệu từ tháng trước
    const lastMonthDays = Object.values(dataLastMonth.dayList);

    // Lấy dữ liệu từ tháng này
    const thisMonthDays = Object.values(dataThisMonth.dayList);

    // Kết hợp tất cả ngày từ tháng trước và tháng này
    const allDays = [...lastMonthDays, ...thisMonthDays];

    // Đánh lại key từ 1 đến hết
    allDays.forEach((day, index) => {
      combinedDayList[index] = day;
    });

    // Sau khi gộp và đánh lại key, bạn có thể gộp toàn bộ dữ liệu
    const data = {
      ...dataThisMonth, // Giữ lại tất cả các trường từ tháng này
      dayList: combinedDayList, // Gộp dayList từ tháng trước và tháng này
      entries: {
        ...dataLastMonth.entries, // Gộp entries từ tháng trước
        ...dataThisMonth.entries, // Gộp entries từ tháng này
      },
    };

    console.log("Combined data with new dayList:", data);
    chrome.storage.local.set({ attendanceData: data, lastUpdated: Date.now() });
  } catch (error) {
    console.error("Error fetching Zoho attendance:", error);
    throw error;
  }
}

const PORTAL = "https://people.zoho.com/hrportal1524046581683";

function formatZohoDate(date) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(date.getDate()).padStart(2, "0")}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

async function postZoho(path, params) {
  const response = await fetch(`${PORTAL}/${path}`, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: new URLSearchParams(params),
  });
  return assertJsonResponse(await response.text(), response.status);
}

// Lấy danh sách loại phép từ lịch sử đơn nghỉ
async function fetchLeaveTypes(csrfToken, erecno, locationId) {
  const data = await postZoho("leave_view_actions.zp", {
    key: "newlist_view",
    leaveyear: "0",
    employee: erecno,
    dataType: "0",
    location: locationId,
    conreqcsr: csrfToken,
  });

  const types = new Map();
  (data.data || []).forEach((row) => {
    if (row.leavetypeId && row.leavetype) {
      types.set(String(row.leavetypeId), row.leavetype);
    }
  });
  return [...types].map(([id, name]) => ({ id, name }));
}

// Lấy số dư của một loại phép
async function fetchLeaveBalance(csrfToken, erecno, leaveTypeId) {
  const today = formatZohoDate(new Date());
  const data = await postZoho("leave_common_action.zp", {
    key: "leave_daydetails",
    employee: erecno,
    leavetype: leaveTypeId,
    from: today,
    to: today,
    fetchBradfordSummary: "false",
    conreqcsr: csrfToken,
  });

  const summary = (data.data && data.data.reportsummary) || {};
  const used = Number(summary.AVAILEDTILLDATE) || 0;
  const balance = Number(summary.CURRENTBALANCE) || 0;
  return { used, balance, total: used + balance };
}

// Lấy danh sách đơn nghỉ phép trong chu kỳ
async function fetchLeaveRequests() {
  const { csrfToken, erecno } = await chrome.storage.local.get([
    "csrfToken",
    "erecno",
  ]);

  if (!csrfToken || !erecno) {
    console.warn("🌴 Leave requests: thiếu token hoặc erecno");
    return;
  }

  const { start, end } = getCycleRange(new Date());
  const sDate = formatZohoDate(start);
  const eDate = formatZohoDate(end);
  console.log("🌴 Leave requests: gọi API", sDate, "→", eDate);

  try {
    const data = await postZoho("leave_view_actions.zp", {
      key: "applications_view",
      viewMode: "1",
      from: sDate,
      to: eDate,
      typeofleave: "-1",
      employee: JSON.stringify([String(erecno)]),
      conreqcsr: csrfToken,
      status: "20",
      sortType: "1",
      sortBy: "3",
      sIndx: "1",
      limit: "50",
    });

    console.log("🌴 Leave requests raw:", data);
    const parsed = parseLeaveRequests(data, start, end);
    console.log("🌴 Leave requests parsed:", parsed.length, parsed);
    await chrome.storage.local.set({ leaveRequestData: parsed });
  } catch (error) {
    console.error("🌴 Leave requests lỗi:", error);
    throw error;
  }
}

// Lấy danh sách request regularization trong chu kỳ
async function fetchZohoRequests() {
  console.log("📋 fetchZohoRequests BẮT ĐẦU");
  const { csrfToken, erecno } = await chrome.storage.local.get([
    "csrfToken",
    "erecno",
  ]);

  if (!csrfToken) {
    console.warn("📋 Requests: chưa có csrfToken");
    return;
  }
  if (!erecno) {
    console.warn("📋 Requests: chưa có erecno");
    return;
  }

  const { start, end } = getCycleRange(new Date());
  const sDate = formatZohoDate(start);
  const eDate = formatZohoDate(end);
  console.log("📋 Requests: gọi API", sDate, "→", eDate, "erecno:", erecno);

  try {
    const data = await postZoho("AttendanceAction.zp", {
      mode: "getMyRequest",
      conreqcsr: csrfToken,
      sDate: sDate,
      eDate: eDate,
      erecno: JSON.stringify([String(erecno)]),
      statFil: JSON.stringify(["-1"]),
    });

    console.log("📋 Requests raw:", data);
    const parsed = parseRequests(data);
    console.log("📋 Requests parsed:", parsed.length, parsed);
    await chrome.storage.local.set({ requestData: parsed });
  } catch (error) {
    console.error("📋 Requests lỗi:", error);
    throw error;
  }
}

const ZOHO_MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

// "17-Sep-2026" -> Date
function parseZohoDate(text) {
  const parts = String(text || "").split("-");
  if (parts.length !== 3) return null;
  const month = ZOHO_MONTHS[parts[1]];
  if (month === undefined) return null;
  const date = new Date(Number(parts[2]), month, Number(parts[0]));
  return isNaN(date.getTime()) ? null : date;
}

function normalizeStatus(approvalStatus) {
  const text = String(approvalStatus || "").toLowerCase();
  if (text.includes("waiting") || text.includes("pending")) return "pending";
  if (text.includes("reject") || text.includes("denied")) return "rejected";
  if (text.includes("approved")) return "approved";
  if (text.includes("cancel") || text.includes("withdraw")) return "cancelled";
  return "other";
}

function parseRequests(data) {
  const rows = (data && data.list) || [];

  return rows
    .map((row) => {
      const detail = (row.regDetails && row.regDetails[0]) || {};
      const date = parseZohoDate(detail.originday || row.startDate);
      if (!date) return null;

      const pad2 = (n) => String(n).padStart(2, "0");
      return {
        date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
        status: normalizeStatus(row.approvalStatus),
        statusText: row.approvalStatus || "",
        inTime: detail.new_intime || "",
        outTime: detail.new_outtime || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function parseLeaveRequests(data, start, end) {
  const rows = (data && data.data) || [];
  const pad2 = (n) => String(n).padStart(2, "0");

  return rows
    .map((row) => {
      const date = parseZohoDate(row.from);
      if (!date) return null;
      if (start && date < start) return null;
      if (end && date > end) return null;

      return {
        date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
        status: normalizeStatus(row.approval_disp),
        statusText: row.approval_disp || "",
        leaveType: row.ltyp_name || "",
        days: Number(row.leavetaken) || 0,
        to: row.to || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getCycleRange(today) {
  const anchor = today.getDate() >= 21 ? 0 : -1;
  return {
    start: new Date(today.getFullYear(), today.getMonth() + anchor, 21),
    end: new Date(today.getFullYear(), today.getMonth() + anchor + 1, 20),
  };
}

// Dự phòng: đọc erecno trực tiếp từ tab Zoho đang mở
async function fetchErecnoFromTab() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://people.zoho.com/*" });
    if (tabs.length === 0) return null;

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      world: "MAIN",
      func: () => ({ erecno: window.erecno, locationId: window._LOGGEDIN_LOCID }),
    });

    const data = result && result.result;
    if (!data || !data.erecno) return null;

    await chrome.storage.local.set({
      erecno: String(data.erecno),
      locationId: data.locationId ? String(data.locationId) : "",
    });
    console.log("👤 Identity từ tab:", data.erecno);
    return String(data.erecno);
  } catch (error) {
    console.warn("Không đọc được erecno từ tab:", error.message);
    return null;
  }
}

async function fetchZohoLeave() {
  let { csrfToken, erecno, locationId } = await chrome.storage.local.get([
    "csrfToken",
    "erecno",
    "locationId",
  ]);

  if (!csrfToken) {
    throw Object.assign(new Error("Chưa có csrfToken"), { kind: "NO_TOKEN" });
  }

  if (!erecno) {
    erecno = await fetchErecnoFromTab();
    if (!erecno) {
      throw Object.assign(new Error("Chưa có erecno"), { kind: "NO_ERECNO" });
    }
  }

  try {
    console.log("🔍 Đang lấy loại phép cho erecno:", erecno, "loc:", locationId);
    const types = await fetchLeaveTypes(csrfToken, erecno, locationId || "");
    console.log("🔍 Loại phép tìm được:", types);

    if (types.length === 0) {
      await chrome.storage.local.set({ leaveData: [], leaveError: "Không tìm thấy loại phép nào." });
      return;
    }

    const balances = [];
    for (const type of types) {
      const balance = await fetchLeaveBalance(csrfToken, erecno, type.id);
      console.log("🔍 Số dư", type.name, balance);
      if (balance.total > 0 || balance.used > 0) {
        balances.push({ ...type, ...balance });
      }
    }

    await chrome.storage.local.set({ leaveData: balances, leaveError: "" });
    console.log("🌴 Leave balances:", balances);
  } catch (error) {
    console.error("Error fetching Zoho leave:", error);
    await chrome.storage.local.set({ leaveData: [], leaveError: "" });
    throw error;
  }
}

// Chạy tự động khi extension được khởi động
chrome.runtime.onInstalled.addListener(() => {
  fetchZohoAttendance();
});

// Lấy token từ Cookie Zoho
async function fetchZohoCSRFToken() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: "people.zoho.com" });
    const csrfCookie = cookies.find((cookie) => cookie.name === "CSRF_TOKEN");

    if (csrfCookie) {
      const csrfToken = csrfCookie.value;
      console.log("🔑 CSRF Token Retrieved:", csrfToken);
      await chrome.storage.local.set({ csrfToken: csrfToken });
      return csrfToken;
    } else {
      console.warn("⚠️ CSRF Token not found. Please log in to Zoho.");
      return null;
    }
  } catch (error) {
    console.error("❌ Error retrieving CSRF token:", error);
    return null;
  }
}

// Chạy tự động khi extension được khởi động
chrome.runtime.onInstalled.addListener(async () => {
  console.log("🔄 Extension Installed. Fetching CSRF Token...");
  await fetchZohoCSRFToken();
  await fetchZohoAttendance();
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
    chrome.storage.local.set({
      erecno: request.erecno,
      locationId: request.locationId,
    });
    console.log("👤 Identity saved:", request.erecno, request.locationId);
    sendResponse({ status: "success" });
    return false;
  }

  if (request.action === "updateAttendance") {
    (async () => {
      try {
        await fetchZohoCSRFToken();
        console.log("▶️ Bắt đầu fetch attendance + leave + requests [v2]");
        const results = await Promise.allSettled([
          fetchZohoAttendance(),
          fetchZohoLeave(),
          fetchZohoRequests(),
          fetchLeaveRequests(),
        ]);
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
          sendResponse({ status: "error", message: error.message });
          return;
        }

        await setStatus(null);
        sendResponse({ status: "success" });
      } catch (error) {
        console.error("❌ updateAttendance:", error);
        await setStatus(error.kind || "NETWORK", error.message);
        sendResponse({ status: "error", message: error.message });
      }
    })();
    return true;
  }

  return false;
});
