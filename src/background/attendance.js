import { postZoho } from "./zoho.js";

export async function fetchZohoAttendance() {
  const { csrfToken } = await chrome.storage.local.get("csrfToken");
  if (!csrfToken) {
    throw Object.assign(new Error("Chưa có csrfToken"), { kind: "NO_TOKEN" });
  }

  try {
    // 3 tháng để chu kỳ trước (21→20) cũng đủ dữ liệu
    const months = await Promise.all(
      [0, 1, 2].map((preMonth) =>
        postZoho("AttendanceViewAction.zp", {
          mode: "getAttList",
          conreqcsr: csrfToken,
          loadToday: "false",
          view: "month",
          preMonth: String(preMonth),
        })
      )
    );

    const [dataThisMonth] = months;

    // Gộp dayList của cả 3 tháng, đánh lại key
    const combinedDayList = {};
    months
      .slice()
      .reverse()
      .flatMap((m) => Object.values(m.dayList || {}))
      .forEach((day, index) => {
        combinedDayList[index] = day;
      });

    const data = {
      ...dataThisMonth,
      dayList: combinedDayList,
      entries: Object.assign({}, ...months.map((m) => m.entries || {})),
    };

    console.log("Combined data with new dayList:", data);
    await chrome.storage.local.set({ attendanceData: data, lastUpdated: Date.now() });
  } catch (error) {
    console.error("Error fetching Zoho attendance:", error);
    throw error;
  }
}
