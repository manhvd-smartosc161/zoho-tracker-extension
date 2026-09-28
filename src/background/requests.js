import { formatZohoDate, getFetchRange } from "../shared/dates.js";
import { parseRequests } from "../shared/zoho-parsers.js";
import { postZoho, readCredentials } from "./zoho.js";

// Lấy danh sách request regularization trong chu kỳ
export async function fetchZohoRequests() {
  console.log("📋 fetchZohoRequests BẮT ĐẦU");
  const { csrfToken, erecno } = await readCredentials();

  if (!csrfToken) {
    console.warn("📋 Requests: chưa có csrfToken");
    return;
  }
  if (!erecno) {
    console.warn("📋 Requests: chưa có erecno");
    return;
  }

  const { start, end } = getFetchRange(new Date());
  const sDate = formatZohoDate(start);
  const eDate = formatZohoDate(end);
  console.log("📋 Requests: gọi API", sDate, "→", eDate, "erecno:", erecno);

  try {
    const data = await postZoho("AttendanceAction.zp", {
      mode: "getMyRequest",
      conreqcsr: csrfToken,
      sDate,
      eDate,
      erecno: JSON.stringify([String(erecno)]),
      statFil: JSON.stringify(["-1"]),
    });

    const rawCount = (data && data.list && data.list.length) || 0;
    const parsed = parseRequests(data);
    console.log(
      `📋 Requests: API trả ${rawCount} dòng → parse được ${parsed.length}`,
      parsed.map((r) => `${r.date} ${r.statusText}`)
    );
    if (rawCount === 0) console.log("📋 Requests raw (rỗng):", data);
    await chrome.storage.local.set({ requestData: parsed });
  } catch (error) {
    console.error("📋 Requests lỗi:", error);
    throw error;
  }
}
