import { dateKeyOf, parseZohoDate } from "./dates.js";

function normalizeStatus(approvalStatus) {
  const text = String(approvalStatus || "").toLowerCase();
  if (text.includes("waiting") || text.includes("pending")) return "pending";
  if (text.includes("reject") || text.includes("denied")) return "rejected";
  if (text.includes("approved")) return "approved";
  if (text.includes("cancel") || text.includes("withdraw")) return "cancelled";
  return "other";
}

export function parseRequests(data) {
  const rows = (data && data.list) || [];

  return rows
    .map((row) => {
      const detail = (row.regDetails && row.regDetails[0]) || {};
      const date = parseZohoDate(detail.originday || row.startDate);
      if (!date) return null;

      return {
        date: dateKeyOf(date),
        status: normalizeStatus(row.approvalStatus),
        statusText: row.approvalStatus || "",
        recordId: String(
          row.recordId || row.regId || row.regDetailsId || detail.recordId ||
          detail.regId || row.requestId || row.recId || ""
        ),
        inTime: detail.new_intime || "",
        outTime: detail.new_outtime || "",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function parseLeaveRequests(data, start, end) {
  const rows = (data && data.data) || [];

  return rows
    .map((row) => {
      const date = parseZohoDate(row.from);
      if (!date) return null;
      if (start && date < start) return null;
      if (end && date > end) return null;

      return {
        date: dateKeyOf(date),
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
