async function fetchZohoAttendance() {
  // Kiểm tra token trong Chrome Storage trước
  const storageData = await chrome.storage.local.get("csrfToken");
  let csrfToken = storageData.csrfToken;

  // Nếu không có token, yêu cầu người dùng đăng nhập Zoho
  if (!csrfToken) {
    console.warn("CSRF token not found. Please log in to Zoho People.");
    return;
  }

  const url =
    "https://people.zoho.com/hrportal1524046581683/AttendanceViewAction.zp";
  const requestBody = new URLSearchParams({
    mode: "getAttList",
    conreqcsr: csrfToken,
    loadToday: "false",
    view: "week",
    preMonth: "0",
    weekStarts: "1",
  });

  const headers = {
    Accept: "*/*",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    Cookie: "people_v5=enabled; _your_other_cookies_here_",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    chrome.storage.local.set({ attendanceData: data });

    console.log("Attendance Data:", data);
  } catch (error) {
    console.error("Error fetching Zoho attendance:", error);
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

// Cho phép popup gọi API cập nhật dữ liệu
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateAttendance") {
    fetchZohoCSRFToken(); // Cập nhật token trước khi gọi API
    fetchZohoAttendance()
      .then(() => {
        sendResponse({ status: "success" });
      })
      .catch((error) => {
        sendResponse({ status: "error", message: error.message });
      });
  }
  return true;
});
