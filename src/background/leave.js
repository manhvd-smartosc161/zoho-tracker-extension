import { formatZohoDate, getFetchRange } from "../shared/dates.js";
import { parseLeaveRequests } from "../shared/zoho-parsers.js";
import { postZoho, readCredentials } from "./zoho.js";
import { fetchErecnoFromTab } from "./session.js";

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

export async function fetchZohoLeave() {
  let { csrfToken, erecno, locationId } = await readCredentials([
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

// Lấy danh sách đơn nghỉ phép trong chu kỳ
export async function fetchLeaveRequests() {
  const { csrfToken, erecno } = await readCredentials();
  if (!csrfToken || !erecno) {
    console.warn("🌴 Leave requests: thiếu token hoặc erecno");
    return;
  }

  const { start, end } = getFetchRange(new Date());
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
