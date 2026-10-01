import { PORTAL } from "../shared/config.js";
import { parseZohoDate } from "../shared/dates.js";

const ID_KEYS = ["recordId", "recId", "approvalId", "requestId", "entityId", "id"];
const REQUESTER_KEYS = ["recordOwnerName", "addedByName", "empName", "employeeName", "ownerName", "raisedBy", "requestedBy", "requester", "name"];
const TYPE_KEYS = ["formName", "dispName", "formDispName", "approvalFor", "requestType", "moduleName", "title"];
const RAISED_KEYS = ["raisedOn", "raisedTime", "createdTime", "addedTime", "requestedOn", "date"];
const FROM_KEYS = ["fromDate", "from", "leaveFrom", "startDate", "fdate", "originday", "attDate"];
const TO_KEYS = ["toDate", "to", "leaveTo", "endDate", "tdate"];
const DAYS_KEYS = ["Daystaken", "daysTaken", "leavetaken", "leaveTaken", "noOfDays", "totalDays", "leaveCount"];
const ZOHO_DAY = /^\d{1,2}-[A-Z][a-z]{2}-\d{4}$/;

function pick(item, keys) {
  if (!item || typeof item !== "object") return "";
  const lower = Object.keys(item).reduce((map, key) => {
    map[key.toLowerCase()] = key;
    return map;
  }, {});
  for (const key of keys) {
    const real = lower[key.toLowerCase()];
    const value = real && item[real];
    if (value !== undefined && value !== null && value !== "" && typeof value !== "object") {
      return String(value);
    }
  }
  return "";
}

function pickDeep(node, keys, depth) {
  if (!node || typeof node !== "object" || depth > 3) return "";
  const direct = pick(node, keys);
  if (direct) return direct;
  for (const value of Object.values(node)) {
    const found = pickDeep(value, keys, depth + 1);
    if (found) return found;
  }
  return "";
}

function daySlots(node, out, depth) {
  if (!node || typeof node !== "object" || depth > 3) return out;
  Object.entries(node).forEach(([key, value]) => {
    if (ZOHO_DAY.test(key)) {
      let slot = value;
      if (typeof slot === "string") {
        try {
          slot = JSON.parse(slot);
        } catch {
          slot = null;
        }
      }
      if (slot && typeof slot === "object" && slot.count !== undefined) {
        out.push({ date: parseZohoDate(key), count: Number(slot.count), session: Number(slot.session) || 0 });
      }
    } else {
      daySlots(value, out, depth + 1);
    }
  });
  return out;
}

function collectArrays(node, key, out, depth) {
  if (!node || typeof node !== "object" || depth > 4) return;
  if (Array.isArray(node)) {
    if (node.length && node.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
      out.push({ key, rows: node });
    }
    node.forEach((row) => collectArrays(row, key, out, depth + 1));
    return;
  }
  Object.entries(node).forEach(([childKey, value]) => collectArrays(value, childKey, out, depth + 1));
}

function formNames(data) {
  const names = {};
  ((data && data.formList) || []).forEach((form) => {
    if (form.formId) names[String(form.formId)] = form.dispName || form.compName || "";
  });
  return names;
}

function categorize(text) {
  if (/regulari|attendance|chấm công/i.test(text)) return "attendance";
  if (/leave|nghỉ/i.test(text)) return "leave";
  return "other";
}

function toDate(value) {
  if (!value) return null;
  if (/^\d{10,13}$/.test(value)) return new Date(Number(value.length === 10 ? value * 1000 : value));
  const zoho = parseZohoDate(value.split(" ")[0]);
  if (zoho) return zoho;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function findPhotoPath(node, depth) {
  if (!node || typeof node !== "object" || depth > 3) return "";
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string" && value && (/employeeurl|photo/i.test(key) || /viewPhoto/i.test(value))) {
      return value;
    }
  }
  for (const value of Object.values(node)) {
    const found = findPhotoPath(value, depth + 1);
    if (found) return found;
  }
  return "";
}

function avatarUrl(path) {
  if (!path) return "";
  try {
    return new URL(path, `${PORTAL}/`).href;
  } catch {
    return "";
  }
}

function splitRequester(text) {
  const match = /^\s*(\d+)\s*-\s*(.+)$/.exec(text);
  return match ? { code: match[1], name: match[2].trim() } : { code: "", name: text.trim() };
}

function toApproval(row, names, index) {
  const formId = pick(row, ["formId", "formID"]);
  const type = names[formId] || pick(row, TYPE_KEYS);
  const requester = splitRequester(pick(row, REQUESTER_KEYS) || "Không rõ người gửi");
  return {
    id: pick(row, ID_KEYS) || `row-${index}`,
    recordId: pick(row, ID_KEYS),
    category: categorize(`${type} ${pick(row, ["compName", "tableName"])}`),
    type: type || "Request",
    requester: requester.name,
    requesterCode: requester.code || pick(row, ["recordOwnerEmpId", "empId", "employeeId"]),
    ownerErecno: pick(row, ["recordOwnerErecno", "addedByErcno", "erecno"]),
    avatar: avatarUrl(pick(row, ["employeePhotoUrl"]) || findPhotoPath(row, 0)),
    raisedOn: toDate(pick(row, RAISED_KEYS)),
    ...leaveSpan(row),
    raw: row,
  };
}

function leaveSpan(row) {
  const slots = daySlots(row, [], 0)
    .filter((slot) => slot.date)
    .sort((a, b) => a.date - b.date);
  const from = slots.length ? slots[0].date : toDate(pickDeep(row, FROM_KEYS, 0));
  const to = slots.length ? slots[slots.length - 1].date : toDate(pickDeep(row, TO_KEYS, 0));
  const total = slots.length
    ? slots.reduce((sum, slot) => sum + slot.count, 0)
    : Number(pickDeep(row, DAYS_KEYS, 0)) || 0;
  const session = slots.length === 1 ? slots[0].session : 0;
  return { from, to, days: total, session };
}

export function parseApprovals(data) {
  const names = formNames(data);
  const arrays = [];
  collectArrays(data, "", arrays, 0);
  const candidates = arrays
    .filter(({ key }) => key !== "formList")
    .map((entry) => ({
      ...entry,
      score: entry.rows.filter((row) => pick(row, REQUESTER_KEYS) || pick(row, ["formId"])).length,
    }));
  if (candidates.length === 0) return [];
  const best = candidates.reduce((a, b) =>
    b.score > a.score || (b.score === a.score && b.rows.length > a.rows.length) ? b : a
  );
  return best.rows.map((row, index) => toApproval(row, names, index));
}
