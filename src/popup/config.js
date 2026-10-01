const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export const LUNCH_BREAK_MS = 1.25 * HOUR_MS;
export const LUNCH_START_HOUR = 12;
export const CHECKOUT_6H_OFFSET_MS = 7.25 * HOUR_MS + MINUTE_MS;
export const CHECKOUT_8H_OFFSET_MS = 9.25 * HOUR_MS;

export const WORK_START = { hour: 7, minute: 30 };
export const WORK_END = { hour: 19, minute: 30 };
export const LATE_AFTER = { hour: 19, minute: 30 };

export const SHIFT_FROM = 9 * 60;
export const SHIFT_TO = 18 * 60 + 30;

export const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
export const SHORT_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export const LEAVE_FORM_ID = "412762000000035693";
export const LEAVE_TABLE = "P_EmployeeLeave";

const ALL_LEAVE_DURATIONS = [
  { value: "full", text: "Cả ngày", days: 1, session: 0, verified: true },
  { value: "half1", text: "Nửa đầu (1st Half)", days: 0.5, session: 1 },
  { value: "half2", text: "Nửa cuối (2nd Half)", days: 0.5, session: 2 },
  { value: "q1", text: "1/4 ngày (1st Quarter)", days: 0.25, session: 3 },
  { value: "q2", text: "1/4 ngày (2nd Quarter)", days: 0.25, session: 4 },
  { value: "q3", text: "1/4 ngày (3rd Quarter)", days: 0.25, session: 5 },
  { value: "q4", text: "1/4 ngày (4th Quarter)", days: 0.25, session: 6 },
];

export const LEAVE_DURATIONS = ALL_LEAVE_DURATIONS.filter((d) => d.verified);

export function leaveDuration(value) {
  return LEAVE_DURATIONS.find((d) => d.value === value) || LEAVE_DURATIONS[0];
}
