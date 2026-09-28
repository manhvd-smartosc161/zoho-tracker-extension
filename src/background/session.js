const ERROR_KINDS = {
  NO_TOKEN: "Chưa đăng nhập Zoho People.",
  SESSION_EXPIRED: "Phiên đăng nhập đã hết hạn.",
  NO_ERECNO: "Chưa lấy được mã nhân viên.",
  NETWORK: "Không kết nối được tới Zoho.",
};

export async function setStatus(kind, detail) {
  await chrome.storage.local.set({
    syncError: kind ? { kind, message: ERROR_KINDS[kind] || kind, detail: detail || "", at: Date.now() } : null,
  });
  if (kind) console.warn("⚠️", ERROR_KINDS[kind] || kind, detail || "");
}

// Lấy token từ Cookie Zoho
export async function fetchZohoCSRFToken() {
  try {
    const groups = await Promise.all([
      chrome.cookies.getAll({ domain: "people.zoho.com" }),
      chrome.cookies.getAll({ domain: ".zoho.com" }),
      chrome.cookies.getAll({ url: "https://people.zoho.com/" }),
    ]);
    const cookies = groups.flat();
    const csrfCookie =
      cookies.find((c) => c.name === "CSRF_TOKEN") ||
      cookies.find((c) => c.name === "CT_CSRF_TOKEN");

    if (!csrfCookie) {
      console.warn(
        "⚠️ Không thấy CSRF_TOKEN. Tổng cookie tìm được:",
        cookies.length,
        "| tên:",
        [...new Set(cookies.map((c) => c.name))].join(", ") || "(rỗng)"
      );
      return null;
    }

    console.log("🔑 CSRF Token Retrieved");
    const wms = cookies.find((c) => c.name === "wms-tkp-token");
    const zuid = wms && /^(\d+)-/.exec(wms.value);

    await chrome.storage.local.set({
      csrfToken: csrfCookie.value,
      ...(zuid ? { zuid: zuid[1] } : {}),
    });
    return csrfCookie.value;
  } catch (error) {
    console.error("❌ Error retrieving CSRF token:", error);
    return null;
  }
}

export async function saveIdentity(erecno, locationId) {
  await chrome.storage.local.set({ erecno, locationId });
  console.log("👤 Identity saved:", erecno, locationId);
}

export async function ensureErecno() {
  const { erecno, attendanceData } = await chrome.storage.local.get([
    "erecno",
    "attendanceData",
  ]);
  if (erecno) return erecno;

  // Dữ liệu chấm công có sẵn userDetails.eNo
  const fromData = attendanceData && attendanceData.userDetails;
  if (fromData && fromData.eNo) {
    const value = String(fromData.eNo);
    await chrome.storage.local.set({ erecno: value });
    console.log("👤 Lấy erecno từ dữ liệu chấm công:", value);
    return value;
  }

  return fetchErecnoFromTab();
}

// Dự phòng: đọc erecno trực tiếp từ tab Zoho đang mở
export async function fetchErecnoFromTab() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://people.zoho.com/*" });
    if (tabs.length === 0) return null;

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      world: "MAIN",
      func: () => ({
        erecno: window.erecno,
        locationId: window._LOGGEDIN_LOCID,
        zuid: window.loginUserZUID || window.ZUID || window.zuid,
      }),
    });

    const data = result && result.result;
    if (!data || !data.erecno) return null;

    await chrome.storage.local.set({
      erecno: String(data.erecno),
      locationId: data.locationId ? String(data.locationId) : "",
      ...(data.zuid ? { zuid: String(data.zuid) } : {}),
    });
    console.log("👤 Identity từ tab:", data.erecno);
    return String(data.erecno);
  } catch (error) {
    console.warn("Không đọc được erecno từ tab:", error.message);
    return null;
  }
}
