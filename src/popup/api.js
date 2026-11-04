import { ATTENDANCE_REQUEST_QUOTA, PORTAL } from "../shared/config.js";
import { dateKeyOf, formatZohoDate, fromDateKey, getCycle, lastDayOf } from "../shared/dates.js";
import { parseRequests } from "../shared/zoho-parsers.js";
import { INVALID_CSRF, sendViaTab } from "../shared/zoho-tab.js";
import { LEAVE_FORM_ID, LEAVE_TABLE, SHIFT_FROM, SHIFT_TO, leaveDuration } from "./config.js";
import { state } from "./state.js";

const FORM_HEADERS = { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" };
const NOT_LOGGED_IN = "Chưa đăng nhập Zoho — đăng nhập people.zoho.com rồi thử lại.";
const NO_ERECNO = "Chưa có mã nhân viên — mở people.zoho.com một lần.";

const toZohoDate = (dateKey) => formatZohoDate(fromDateKey(dateKey));

async function freshCsrfToken() {
  try {
    const cookie =
      (await chrome.cookies.get({ url: "https://people.zoho.com/", name: "CSRF_TOKEN" })) ||
      (await chrome.cookies.get({ url: "https://people.zoho.com/", name: "CT_CSRF_TOKEN" }));
    return cookie ? cookie.value : "";
  } catch {
    return "";
  }
}

async function readCreds() {
  const creds = await chrome.storage.local.get(["csrfToken", "erecno", "zuid"]);
  const fresh = await freshCsrfToken();
  if (fresh && fresh !== creds.csrfToken) {
    await chrome.storage.local.set({ csrfToken: fresh });
    creds.csrfToken = fresh;
  }
  return creds;
}

function zohoReason(text) {
  try {
    const data = JSON.parse(text);
    return String(data.message || data.errorMessage || data.error || data.msg || "").trim();
  } catch {
    return "";
  }
}

const ZOHO_ORIGINS = { origins: ["https://people.zoho.com/*"] };
const NO_SITE_ACCESS =
  "Extension chưa được phép truy cập people.zoho.com — bấm Thử lại rồi chọn Cho phép.";

export async function ensureZohoAccess() {
  try {
    if (await chrome.permissions.contains(ZOHO_ORIGINS)) return true;
    return await chrome.permissions.request(ZOHO_ORIGINS);
  } catch {
    return false;
  }
}

async function sendDirect(url, init) {
  const res = await fetch(url, { ...init, credentials: "include" });
  return { status: res.status, ok: res.ok, redirected: res.redirected, url: res.url, text: await res.text() };
}

async function postZoho(path, body, headers) {
  const url = `${PORTAL}/${path}`;
  const init = {
    method: "POST",
    headers: {
      Accept: "*/*",
      "X-Requested-With": "XMLHttpRequest",
      ...headers,
    },
    body: String(body),
  };

  let res = await sendDirect(url, init);
  if (res.status === 400 && INVALID_CSRF.test(res.text)) {
    const granted = await chrome.permissions.contains(ZOHO_ORIGINS);
    console.info(`[zoho] ${path}: INVALID_CSRF_TOKEN, quyền truy cập people.zoho.com: ${granted}`);
    if (!granted) throw new Error(NO_SITE_ACCESS);
    res = await sendViaTab(url, init);
    console.info(`[zoho] ${path} qua tab Zoho: HTTP ${res.status}`);
  }

  const text = res.text;
  if (res.redirected && /accounts\.zoho\.com|signin/.test(res.url)) {
    throw new Error("Phiên đăng nhập hết hạn — đăng nhập lại Zoho.");
  }
  if (!res.ok) {
    console.warn(`[zoho] ${path} HTTP ${res.status}:`, text.slice(0, 500));
    const reason = zohoReason(text);
    if (reason) throw new Error(`Zoho từ chối (HTTP ${res.status}): ${reason}`);
    if (res.status === 400) {
      throw new Error("Zoho không nhận yêu cầu (HTTP 400) — mở people.zoho.com để làm mới đăng nhập rồi bấm thử lại.");
    }
    throw new Error(`Zoho đang lỗi (HTTP ${res.status}) — thử lại sau ít phút.`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Zoho trả về dữ liệu không đọc được — đăng nhập lại people.zoho.com rồi thử lại.");
  }

  const reason = data.message || data.errorMessage || data.error || "";
  if (data.status === 1 || /error|fail|invalid|limit/i.test(reason)) {
    throw new Error(reason || "Zoho từ chối yêu cầu — mở people.zoho.com để kiểm tra.");
  }
  return data;
}

export async function createRequest(dateKey, fromMin, toMin) {
  const { csrfToken, erecno } = await readCreds();
  if (!csrfToken) throw new Error(NOT_LOGGED_IN);
  if (!erecno) throw new Error(NO_ERECNO);

  const zohoDate = toZohoDate(dateKey);
  const boundary = `----ZohoTrack${Date.now()}`;
  const fields = {
    conreqcsr: csrfToken,
    erecno: String(erecno),
    fdate: zohoDate,
    dataObj: JSON.stringify({
      [zohoDate]: {
        fromDate: zohoDate,
        toDate: zohoDate,
        ftime: Number.isFinite(fromMin) ? fromMin : SHIFT_FROM,
        ttime: Number.isFinite(toMin) ? toMin : SHIFT_TO,
      },
    }),
  };

  const body =
    Object.entries(fields)
      .map(
        ([k, v]) =>
          `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
      )
      .join("") + `--${boundary}--\r\n`;

  return postZoho("AttendanceAction.zp?mode=bulkAttendReg", body, {
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
  });
}

export async function fetchRequestList() {
  const { csrfToken, erecno } = await readCreds();
  if (!csrfToken || !erecno) return null;

  const cycle = getCycle(new Date(), state.cycleOffset);

  const data = await postZoho(
    "AttendanceAction.zp",
    new URLSearchParams({
      mode: "getMyRequest",
      conreqcsr: csrfToken,
      sDate: toZohoDate(dateKeyOf(cycle.start)),
      eDate: toZohoDate(dateKeyOf(lastDayOf(cycle))),
      erecno: JSON.stringify([String(erecno)]),
      statFil: JSON.stringify(["-1"]),
    }),
    FORM_HEADERS
  );

  return parseRequests(data);
}

const photoCache = new Map();

export function fetchPhoto(url) {
  if (!photoCache.has(url)) {
    const request = fetch(url, { credentials: "include" })
      .then(async (res) => {
        const type = res.headers.get("content-type") || "";
        if (!res.ok || !type.startsWith("image/")) {
          throw new Error(`HTTP ${res.status}, content-type "${type}"`);
        }
        return URL.createObjectURL(await res.blob());
      })
      .catch((error) => {
        console.warn("[approvals] không tải được ảnh", url, error.message);
        throw error;
      });
    photoCache.set(url, request);
  }
  return photoCache.get(url);
}

export async function fetchLeaveApplications(erecnos, from, to) {
  const { csrfToken } = await readCreds();
  if (!csrfToken) throw new Error(NOT_LOGGED_IN);

  const data = await postZoho(
    "leave_view_actions.zp",
    new URLSearchParams({
      key: "applications_view",
      viewMode: "1",
      from: formatZohoDate(from),
      to: formatZohoDate(to),
      typeofleave: "-1",
      employee: JSON.stringify(erecnos.map(String)),
      conreqcsr: csrfToken,
      status: "20",
      sortType: "1",
      sortBy: "3",
      sIndx: "1",
      limit: "100",
    }),
    FORM_HEADERS
  );
  return (data && data.data) || [];
}

export async function fetchApprovals() {
  const { csrfToken, erecno } = await readCreds();
  if (!csrfToken) throw new Error(NOT_LOGGED_IN);
  if (!erecno) throw new Error(NO_ERECNO);

  return postZoho(
    "approvalAction.zp",
    new URLSearchParams({
      action: "myApprovals",
      empErecNo: String(erecno),
      empStatus: "3",
      mode: "viewApprovals",
      approvalForm: "-1",
      approvalStatus: "pending",
      conreqcsr: csrfToken,
    }),
    FORM_HEADERS
  );
}

async function decideRecord(recordId, status, comment, extra) {
  const { csrfToken } = await readCreds();
  if (!csrfToken) throw new Error(NOT_LOGGED_IN);
  if (!recordId) throw new Error("Không tìm thấy mã request — bấm ↻ để tải lại danh sách.");

  const data = await postZoho(
    "formAction.zp",
    new URLSearchParams({
      mode: "approveRejectRecord",
      recordIds: JSON.stringify([String(recordId)]),
      comment: comment || "",
      approvalStatus: String(status),
      ...extra,
      conreqcsr: csrfToken,
    }),
    FORM_HEADERS
  );
  if (!data || data.success !== true) {
    throw new Error((data && data.message) || "Zoho không xử lý được request này — mở people.zoho.com để kiểm tra.");
  }
  return data;
}

export function approveRequest(item, comment) {
  return decideRecord(item.recordId, 1, comment, { isAllLevelApprove: "false" });
}

export function rejectRequest(item, reason) {
  return decideRecord(item.recordId, 0, reason);
}

export async function createLeave(dateKey, leaveTypeId, duration, reason) {
  const { csrfToken, erecno, zuid } = await readCreds();
  if (!csrfToken) throw new Error(NOT_LOGGED_IN);
  if (!erecno) throw new Error(NO_ERECNO);
  if (!leaveTypeId) throw new Error("Chọn loại phép để gửi đơn.");

  const spec = leaveDuration(duration);
  const zohoDate = toZohoDate(dateKey);
  const dayEntry =
    spec.days === 1
      ? { count: 1, session: 0 }
      : { count: String(spec.days), session: String(spec.session), inactive: false };

  const body = new URLSearchParams({
    isPicklistIdEnabled: "true",
    Employee_ID: String(erecno),
    Leavetype: String(leaveTypeId),
    From: zohoDate,
    To: zohoDate,
    bereavement_leave_type: "",
    Reasonforleave: reason || "",
    zp_tableName: LEAVE_TABLE,
    conreqcsr: csrfToken,
    zp_formId: LEAVE_FORM_ID,
    zp_mode: "addRecord",
    [zohoDate]: JSON.stringify(dayEntry),
    isHour: "false",
    isDayBased: "true",
    Daystaken: String(spec.days),
    isDraft: "false",
  });

  if (zuid) body.set("loginUserZUID", String(zuid));

  return postZoho("addUpdateRecord.zp", body, FORM_HEADERS);
}

export async function cancelRequest(recordId) {
  const { csrfToken } = await readCreds();
  if (!csrfToken) throw new Error(NOT_LOGGED_IN);
  if (!recordId) throw new Error("Thiếu mã đơn — bấm Cập nhật rồi thử lại.");

  return postZoho(
    "AttendanceAction.zp",
    new URLSearchParams({
      mode: "cancelRegList",
      conreqcsr: csrfToken,
      regId: String(recordId),
      reason: "",
    }),
    FORM_HEADERS
  );
}

export function runAction(work, done) {
  work()
    .then((result) => done({ status: "success", result }))
    .catch((error) => {
      console.error("[popup] lỗi:", error);
      let message = error.message || "Không gửi được.";
      if (/failed to fetch|networkerror/i.test(message)) {
        message = "Không kết nối được tới Zoho — kiểm tra mạng.";
      } else if (/limit|exceed/i.test(message)) {
        message = `Đã hết hạn mức ${ATTENDANCE_REQUEST_QUOTA} request trong chu kỳ này.`;
      }
      done({ status: "error", message });
    });
}
