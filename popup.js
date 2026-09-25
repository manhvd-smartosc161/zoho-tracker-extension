const ATTENDANCE_REQUEST_QUOTA = 3;
const DAYS_6_TO_8_LIMIT = 5;
const LUNCH_BREAK_MS = 1.25 * 60 * 60 * 1000;
const CHECKOUT_6H_OFFSET_MS = 7.25 * 60 * 60 * 1000;
const CHECKOUT_8H_OFFSET_MS = 9.25 * 60 * 60 * 1000;
const LUNCH_START_HOUR = 12;
const WORK_START_HOUR = 7;
const WORK_START_MINUTE = 30;
const WORK_END_HOUR = 19;
const WORK_END_MINUTE = 30;
const LATE_HOUR = 19;
const LATE_MINUTE = 30;
const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const SHORT_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const ROWS = ["below-6", "below-8", "missing-request", "sent-request", "leave-request"];

const REQUEST_LABELS = {
  pending: { text: "Chờ duyệt", pillClass: "p-pending" },
  approved: { text: "Đã duyệt", pillClass: "p-approved" },
  rejected: { text: "Từ chối", pillClass: "p-rejected" },
  cancelled: { text: "Đã huỷ", pillClass: "" },
};

document.addEventListener("DOMContentLoaded", function () {
  const missing = new Set();
  const el = (id) => {
    const node = document.getElementById(id);
    if (!node && !missing.has(id)) {
      missing.add(id);
      console.warn(`[popup] Không tìm thấy #${id}`);
    }
    return node || document.createElement("span");
  };

  const pad = (n) => String(n).padStart(2, "0");
  let cachedRequestUsed = 0;
  let cycleOffset = 0;

  function formatTime(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatDate(date) {
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
  }

  function formatDayLabel(date) {
    return `${SHORT_WEEKDAYS[date.getDay()]} ${formatDate(date)}`;
  }

  function formatDuration(ms) {
    const minutes = Math.max(0, Math.floor(ms / 60000));
    return `${Math.floor(minutes / 60)}h${pad(minutes % 60)}`;
  }

  function formatHours(tsecs) {
    const minutes = Math.round(tsecs / 60);
    return `${Math.floor(minutes / 60)}h${pad(minutes % 60)}`;
  }

  function formatCountdown(ms) {
    const minutes = Math.ceil(ms / 60000);
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} tiếng` : `${hours}h${pad(rest)}`;
  }

  function setTone(key, tone) {
    const row = el(`${key}-row`);
    row.className = row.className.replace(/\bn-\w+\b/g, "").trim();
    row.classList.add(`n-${tone}`);
  }

  function getCycle(today, offset) {
    const anchor = (today.getDate() >= 21 ? 0 : -1) + (offset || 0);
    return {
      start: new Date(today.getFullYear(), today.getMonth() + anchor, 21),
      end: new Date(today.getFullYear(), today.getMonth() + anchor + 1, 21),
    };
  }

  /* ───── Hôm nay ───── */

  function clampToShift(date) {
    const open = new Date(date);
    open.setHours(WORK_START_HOUR, WORK_START_MINUTE, 0, 0);

    const close = new Date(date);
    close.setHours(WORK_END_HOUR, WORK_END_MINUTE, 0, 0);

    if (date < open) return open;
    if (date > close) return close;
    return date;
  }

  function workedMsSince(checkin, now) {
    const raw = now - checkin;
    if (raw <= 0) return 0;

    const lunch = new Date(checkin);
    lunch.setHours(LUNCH_START_HOUR, 0, 0, 0);

    if (checkin < lunch && now > lunch) {
      return Math.max(0, raw - LUNCH_BREAK_MS);
    }
    return raw;
  }

  function setStatus(text, live) {
    const node = el("shift-status");
    node.textContent = text;
    node.classList.toggle("live", Boolean(live));
    node.classList.toggle("off", text === "Ngày nghỉ");
  }

  function renderToday(entries) {
    const now = new Date();
    el("today-date").textContent = `${WEEKDAYS[now.getDay()]}, ${formatDate(now)}`;

    const weekend = now.getDay() === 0 || now.getDay() === 6;
    const todayEntries = entries && entries[now.toISOString().split("T")[0]];
    if (!todayEntries || todayEntries.length === 0) return resetToday(weekend);

    const rawCheckin = new Date(todayEntries[0].fdate.replace(/-/g, "/"));
    if (isNaN(rawCheckin.getTime())) return resetToday(weekend);

    // Công ty chỉ tính công trong khung 07:30–19:30
    const checkin = clampToShift(rawCheckin);
    const mark6 = new Date(checkin.getTime() + CHECKOUT_6H_OFFSET_MS);
    const mark8 = new Date(checkin.getTime() + CHECKOUT_8H_OFFSET_MS);
    const worked = workedMsSince(checkin, clampToShift(now));

    el("checkin-time").textContent = formatTime(checkin);
    el("checkin-time").classList.remove("muted");
    el("worked-time").textContent = formatDuration(worked);
    el("worked-time").className = "stat-value serif tnum accent";

    el("checkout1-time").textContent = formatTime(mark6);
    el("checkout1-time").classList.remove("muted");
    el("fulltime-time").textContent = formatTime(mark8);
    el("fulltime-time").classList.remove("muted");

    const done6 = now >= mark6;
    const done8 = now >= mark8;
    el("out-6").classList.toggle("done", done6);
    el("out-8").classList.toggle("done", done8);

    // Số giờ LÀM còn thiếu, không tính nghỉ trưa
    el("checkout1-left").textContent = done6
      ? "đã đủ"
      : `còn ${formatCountdown(6 * 3600 * 1000 - worked)}`;
    el("fulltime-left").textContent = done8
      ? "đã đủ"
      : `còn ${formatCountdown(8 * 3600 * 1000 - worked)}`;

    const six = 6 * 3600 * 1000;
    const eight = 8 * 3600 * 1000;
    el("prog-6").style.width = `${Math.min(100, (worked / six) * 100)}%`;
    el("prog-8").style.width =
      worked <= six ? "0%" : `${Math.min(100, ((worked - six) / (eight - six)) * 100)}%`;

    if (done8) {
      setStatus("Đủ 8 tiếng", true);
      el("progress-hint").textContent = "Đã đủ 8 tiếng — về được rồi";
    } else if (done6) {
      setStatus("Đang trong ca", true);
      el("progress-hint").textContent = `Còn ${formatCountdown(
        8 * 3600 * 1000 - worked
      )} nữa là đủ 8 tiếng`;
    } else {
      setStatus("Đang trong ca", true);
      el("progress-hint").textContent = `Còn ${formatCountdown(
        6 * 3600 * 1000 - worked
      )} nữa là đủ 6 tiếng`;
    }

    const threshold = new Date();
    threshold.setHours(LATE_HOUR, LATE_MINUTE, 0, 0);
    el("late-note").hidden = mark8 < threshold;
  }

  function resetToday(weekend) {
    setStatus(weekend ? "Ngày nghỉ" : "Chưa check-in", false);
    el("checkin-time").textContent = "--:--";
    el("checkin-time").className = "stat-value serif tnum muted";
    el("worked-time").textContent = "0h00";
    el("worked-time").className = "stat-value serif tnum muted";
    el("checkout1-time").textContent = "--:--";
    el("checkout1-time").className = "val serif tnum muted";
    el("fulltime-time").textContent = "--:--";
    el("fulltime-time").className = "val serif tnum muted";
    el("out-6").classList.remove("done");
    el("out-8").classList.remove("done");
    el("checkout1-left").textContent = "";
    el("fulltime-left").textContent = "";
    el("prog-6").style.width = "0%";
    el("prog-8").style.width = "0%";
    el("progress-hint").textContent = weekend
      ? "Cuối tuần — không cần chấm công"
      : "Bắt đầu ca để theo dõi tiến độ";
    el("late-note").hidden = true;
  }

  /* ───── Lưới chỉ số ───── */

  function makeDrawerHead(count, scale, title) {
    const li = document.createElement("li");
    li.className = "head";

    const left = document.createElement("span");
    left.textContent = title || `Chi tiết ${count} ngày`;

    const right = document.createElement("span");
    right.className = "scale";
    right.textContent = scale;

    li.append(left, right);
    return li;
  }

  function makeBarRow(day) {
    const li = document.createElement("li");

    const date = document.createElement("span");
    date.className = "d-date";
    date.textContent = formatDayLabel(day.date);

    const bar = document.createElement("span");
    bar.className = "d-bar";
    const fill = document.createElement("i");
    fill.style.width = `${Math.max(3, Math.min(100, day.percent))}%`;
    if (day.low) fill.className = "low";
    bar.appendChild(fill);

    const value = document.createElement("span");
    value.className = "d-val";
    value.textContent = day.label;

    li.append(date, bar, value);
    return li;
  }

  function makePillRow(day) {
    const li = document.createElement("li");

    const date = document.createElement("span");
    date.className = "d-date";
    date.textContent = formatDayLabel(day.date);

    const pill = document.createElement("span");
    pill.className = `pill ${day.pillClass || ""}`.trim();
    pill.textContent = day.label;

    li.append(date, pill);
    return li;
  }

  function renderRow(key, days, value, tone, flag, drawer) {
    el(`${key}-count`).textContent = value;
    setTone(key, tone);

    const flagNode = document.getElementById(`${key}-flag`);
    if (flagNode) flagNode.textContent = flag || "";

    const list = el(`${key}-detail`);
    list.textContent = "";

    if (days.length > 0) {
      const opts = drawer || {};
      list.appendChild(makeDrawerHead(days.length, opts.scale || "", opts.title));
      days.forEach((day) => {
        list.appendChild(opts.pill ? makePillRow(day) : makeBarRow(day));
      });
    }

    const row = el(`${key}-row`);
    row.dataset.empty = String(days.length === 0);
    row.setAttribute("aria-expanded", "false");
    list.hidden = true;
  }

  function bindRow(key) {
    const row = el(`${key}-row`);
    const list = el(`${key}-detail`);

    row.addEventListener("click", function () {
      if (row.dataset.empty === "true") return;
      const expanded = row.getAttribute("aria-expanded") === "true";
      row.setAttribute("aria-expanded", String(!expanded));
      list.hidden = expanded;
    });
  }

  function renderCycleStats(dayList) {
    const { start, end } = getCycle(new Date(), cycleOffset);
    el("cycle-range").textContent = `${formatDate(start)} → ${formatDate(
      new Date(end.getTime() - 86400000)
    )}`;
    el("cycle-next").disabled = cycleOffset >= 0;
    el("cycle-prev").disabled = cycleOffset <= -1;

    const below6 = [];
    const between6And8 = [];
    const missingRequest = [];
    let requestUsed = 0;
    const leaveDays = [];

    const todayKey = new Date().toDateString();

    Object.values(dayList).forEach((day) => {
      const date = new Date(day.orgdate);
      if (date < start || date > end) return;

      // Hôm nay chưa hết ca, chưa biết sẽ đủ giờ hay không
      const isToday = date.toDateString() === todayKey;

      const tsecs = day.tsecs || 0;
      const status = (day.status || "").trim();

      if (tsecs > 0 && !isToday) {
        if (tsecs < 6 * 3600) {
          below6.push({
            date,
            label: formatHours(tsecs),
            percent: (tsecs / (6 * 3600)) * 100,
            low: true,
          });
        } else if (tsecs < 8 * 3600) {
          between6And8.push({
            date,
            label: formatHours(tsecs),
            percent: ((tsecs - 6 * 3600) / (2 * 3600)) * 100,
          });
        }
      }

      if (day.approvalInfo) requestUsed++;
      if (day.leaveDaysTaken) {
        leaveDays.push({
          date,
          raw: day.leaveDaysTaken,
          label: day.leaveDaysTaken === 0.5 ? "Nửa ngày" : `${day.leaveDaysTaken} ngày`,
          pillClass: "p-approved",
        });
      }
      if (
        status === "Absent" &&
        !isToday &&
        !day.approvalInfo &&
        !day.leaveDaysTaken
      ) {
        missingRequest.push({ date, label: "Chưa tạo", pillClass: "p-rejected" });
      }
    });

    [below6, between6And8, missingRequest, leaveDays].forEach((days) =>
      days.sort((a, b) => a.date - b.date)
    );

    const used = between6And8.length;
    const hours68Tone = quotaTone(used, DAYS_6_TO_8_LIMIT);
    renderRow(
      "below-8",
      between6And8,
      `${used}/${DAYS_6_TO_8_LIMIT}`,
      hours68Tone,
      "",
      { scale: "thang đo 6h → 8h", title: `${used} ngày làm 6–8 tiếng` }
    );

    renderRow(
      "below-6",
      below6,
      below6.length,
      below6.length ? "bad" : "ok",
      "",
      { scale: "thang đo 0 → 6h", title: `${below6.length} ngày dưới 6 tiếng` }
    );

    renderRow(
      "missing-request",
      missingRequest,
      missingRequest.length,
      missingRequest.length ? "bad" : "ok",
      "",
      { pill: true, scale: "cần tạo request", title: `${missingRequest.length} ngày vắng mặt` }
    );

    renderWorkdaysLeft(new Date(end.getTime() - 86400000));

    cachedRequestUsed = requestUsed;
  }

  function countWorkdaysLeft(from, end) {
    let days = 0;
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(cursor.getDate() + 1);

    while (cursor <= end) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) days++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  function renderWorkdaysLeft(end) {
    if (cycleOffset !== 0) {
      el("absent-count").textContent = "–";
      setTone("absent", "info");
      return;
    }

    const left = countWorkdaysLeft(new Date(), end);

    el("absent-count").textContent = left;
    setTone("absent", "info");

  }

  function resetCycleStats() {
    el("cycle-range").textContent = "";
    ROWS.forEach((key) => renderRow(key, [], "–", "mute", "", {}));
    el("absent-count").textContent = "–";
    setTone("absent", "info");
    cachedRequestUsed = 0;
  }

  function toPillDays(rows, withType) {
    return rows.map((request) => {
      const label = REQUEST_LABELS[request.status] || {
        text: request.statusText || "—",
        pillClass: "",
      };
      const type =
        withType && request.leaveType
          ? ` · ${request.leaveType.replace(/ ?leave$/i, "")}`
          : "";
      return {
        date: new Date(`${request.date}T00:00:00`),
        label: `${label.text}${type}`,
        pillClass: label.pillClass,
      };
    });
  }

  function quotaTone(used, quota) {
    if (used >= quota) return "limit";
    if (used >= quota - 1) return "warn";
    return "ok";
  }

  function inCurrentCycle(request) {
    const { start, end } = getCycle(new Date(), cycleOffset);
    const date = new Date(`${request.date}T00:00:00`);
    return date >= start && date < end;
  }

  // Đơn huỷ hoặc bị từ chối không tốn hạn mức
  function countsAgainstQuota(request) {
    return request.status !== "cancelled" && request.status !== "rejected";
  }

  function renderRequestRow(key, requests, withType, quota) {
    const rows = (requests || []).filter(inCurrentCycle);
    const active = rows.filter(countsAgainstQuota);
    const pending = rows.filter((r) => r.status === "pending").length;
    const scale = pending > 0 ? `${pending} chờ duyệt` : "đã xử lý xong";

    const title = `${rows.length} ${withType ? "đơn nghỉ phép" : "request chấm công"}`;

    if (!quota) {
      renderRow(key, toPillDays(rows, withType), String(rows.length), "ok", "", {
        pill: true,
        scale,
        title,
      });
      return;
    }

    renderRow(
      key,
      toPillDays(rows, withType),
      `${active.length}/${quota}`,
      quotaTone(active.length, quota),
      "",
      { pill: true, scale, title }
    );
  }

  function renderRequests(requests) {
    renderRequestRow("sent-request", requests, false, ATTENDANCE_REQUEST_QUOTA);
  }

  function renderLeaveRequests(requests) {
    renderRequestRow("leave-request", requests, true, 0);
  }

  /* ───── Quỹ phép ───── */

  function titleCaseLeave(name) {
    return String(name || "").replace(/\bleave\b/g, "Leave");
  }

  function makeQuota(name, used, total) {
    const row = document.createElement("div");
    row.className = "quota";

    const top = document.createElement("div");
    top.className = "top";

    const label = document.createElement("span");
    label.className = "name";
    label.textContent = name;

    const nums = document.createElement("span");
    nums.className = "nums tnum";
    nums.textContent = `${used}/${total}`;

    top.append(label, nums);

    const pips = document.createElement("div");
    pips.className = "pips";
    for (let i = 0; i < Math.max(total, 1); i++) {
      const pip = document.createElement("i");
      if (i < used) pip.className = "on";
      pips.appendChild(pip);
    }

    row.append(top, pips);
    return row;
  }

  function renderLeaveList(balances, error, requestUsed) {
    const container = el("leave-list");
    container.textContent = "";

    const rows = balances || [];
    if (rows.length === 0) {
      const note = document.createElement("div");
      note.className = "quota-empty";
      note.textContent = error || "Chưa có dữ liệu phép — bấm Cập nhật.";
      container.appendChild(note);
      el("leave-aside").textContent = "";
    } else {
      rows.forEach((leave) => {
        container.appendChild(
          makeQuota(titleCaseLeave(leave.name), leave.used, leave.total)
        );
      });

      const annual = rows.find((r) => /annual/i.test(r.name)) || rows[0];
      const left = Math.max(0, annual.total - annual.used);
      el("leave-aside").textContent = `còn ${left} ngày ${annual.name.replace(/ ?leave$/i, "")}`;
    }

    container.appendChild(
      makeQuota("Attendance", requestUsed || 0, ATTENDANCE_REQUEST_QUOTA)
    );
  }

  /* ───── Lịch tháng ───── */

  let calOffset = 0;
  let calDayList = {};
  let calRequests = [];

  function calHoursTone(tsecs) {
    if (tsecs >= 8 * 3600) return "h-full";
    if (tsecs >= 6 * 3600) return "h-mid";
    if (tsecs > 0) return "h-low";
    return "";
  }

  function calCell(className, parts) {
    const cell = document.createElement("div");
    cell.className = className;
    parts.filter(Boolean).forEach((p) => cell.appendChild(p));
    return cell;
  }

  function calLine(className, text) {
    if (!text) return null;
    const node = document.createElement("div");
    node.className = className;
    node.textContent = text;
    return node;
  }

  function renderCalendar() {
    closeCellMenu();
    const base = new Date();
    const { start, end } = getCycle(base, calOffset);
    const last = new Date(end.getTime() - 86400000);

    el("cal-month").textContent = `${formatDate(start)} → ${formatDate(last)}`;

    const index = {};
    Object.values(calDayList).forEach((day) => {
      const date = new Date(day.orgdate);
      if (isNaN(date.getTime())) return;
      index[
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      ] = day;
    });

    const container = el("cal-days");
    container.textContent = "";

    const offset = (start.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) {
      container.appendChild(calCell("cal-day blank", []));
    }

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    let full = 0;
    let mid = 0;
    let low = 0;
    let absent = 0;
    let cells = 0;

    for (
      let date = new Date(start);
      date <= last;
      date.setDate(date.getDate() + 1)
    ) {
      const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
      const day = index[key];
      const tsecs = (day && day.tsecs) || 0;
      const weekend = date.getDay() === 0 || date.getDay() === 6;

      const classes = ["cal-day"];
      if (weekend) classes.push("weekend");
      if (key === todayKey) classes.push("today");

      // Một ngày có thể có nhiều đơn (huỷ rồi tạo lại) — ưu tiên đơn còn hiệu lực
      const sameDay = calRequests.filter((r) => r.date === key);
      const request =
        sameDay.find((r) => r.status === "pending") ||
        sameDay.find((r) => r.status === "approved") ||
        sameDay[0];

      // Đơn chờ duyệt phủ lên dữ liệu chấm công: hiện giờ theo đơn, bỏ nhãn Vắng
      const pendingSecs =
        request && request.status === "pending"
          ? requestSeconds(request)
          : 0;

      const parts = [calLine("dnum", String(date.getDate()))];
      let shortDay = false;

      if (pendingSecs > 0) {
        parts.push(calLine("hrs", formatHours(pendingSecs)));
        classes.push(calHoursTone(pendingSecs) || "");
      } else if (tsecs > 0) {
        parts.push(calLine("hrs", formatHours(tsecs)));
        classes.push(calHoursTone(tsecs) || "");
        if (tsecs >= 8 * 3600) full++;
        else if (tsecs >= 6 * 3600) {
          mid++;
          shortDay = true;
        } else {
          low++;
          shortDay = true;
        }
      } else if (day && day.leaveDaysTaken) {
        parts.push(calLine("mark m-leave", day.leaveDaysTaken === 0.5 ? "Nghỉ ½" : "Nghỉ"));
      } else if (day && (day.status || "").trim() === "Absent" && !weekend) {
        parts.push(calLine("mark m-absent", "Vắng"));
        classes.push("is-absent");
        shortDay = true;
        if (!day.approvalInfo) absent++;
      }

      if (pendingSecs > 0) {
        if (pendingSecs >= 8 * 3600) full++;
        else if (pendingSecs >= 6 * 3600) mid++;
        else low++;
      }

      const label = `${SHORT_WEEKDAYS[date.getDay()]} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const past = date < today;

      if (request) {
        const info = REQ_LABELS[request.status];
        if (info) parts.push(calLine(`req ${info.cls}`, info.text));
      }

      const cell = calCell(classes.join(" "), parts);

      // Đơn đã huỷ hoặc bị từ chối không chặn việc tạo lại
      const blocking =
        request && request.status !== "cancelled" && request.status !== "rejected";

      if (request && request.status === "pending") {
        cell.className += " has-req";
        cell.title = "Bấm để huỷ request";
        cell.addEventListener("click", () => confirmCancel(request, label));
      } else if (!blocking && shortDay && past) {
        cell.className += " actionable";
        const absentDay = classes.includes("is-absent");
        cell.title = absentDay
          ? "Bấm để chọn loại request"
          : "Bấm để tạo request chấm công";
        cell.addEventListener("click", (event) => {
          if (absentDay) openCellMenu(cell, event, key, label);
          else confirmCreate(key, label);
        });
      } else if (shortDay) {
        // Nói rõ vì sao không bấm được
        cell.title = !past
          ? "Chưa qua ngày — chưa tạo được request"
          : `Đã có request (${(request && request.statusText) || "đã duyệt"})`;
      }

      container.appendChild(cell);
      cells++;
    }

    const tail = (offset + cells) % 7;
    if (tail) {
      for (let i = tail; i < 7; i++) {
        container.appendChild(calCell("cal-day blank", []));
      }
    }

    const sum = el("cal-sum");
    sum.textContent = "";
    [
      { num: full, cap: "Đủ 8 tiếng", tone: "n-ok" },
      { num: mid, cap: "6–8 tiếng", tone: "n-warn" },
      { num: low, cap: "Dưới 6 tiếng", tone: "n-bad" },
      { num: absent, cap: "Vắng chưa xử lý", tone: "n-bad" },
    ].forEach((cell) => {
      sum.appendChild(
        calCell(`cell ${cell.tone}`, [
          calLine("num", String(cell.num)),
          calLine("cap", cell.cap),
        ])
      );
    });

    el("cal-next").disabled = calOffset >= 0;
    el("cal-prev").disabled = calOffset <= -2;
  }

  const REQ_LABELS = {
    pending: { text: "Chờ duyệt", cls: "r-pending" },
    approved: { text: "Đã duyệt", cls: "r-approved" },
    rejected: { text: "Từ chối", cls: "r-rejected" },
  };

  let toastTimer = null;

  const TOAST_CHECK = "M5 12.5l4.2 4.2L19 7";
  const TOAST_CROSS = "M7 7l10 10M17 7L7 17";

  function showToast(text, danger) {
    const box = el("toast");
    if (!box) return;
    el("toast-text").textContent = text;
    const path = box.querySelector(".ic svg path");
    if (path) path.setAttribute("d", danger ? TOAST_CROSS : TOAST_CHECK);
    box.classList.toggle("is-danger", Boolean(danger));
    box.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("show"), 2600);
  }

  function minutesToTime(min) {
    return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  }

  function readTimeField(id) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(el(id).value || "").trim());
    if (!m) return null;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  function askConfirm({ title, message, confirmText, danger, successText, fields, onConfirm }) {
    const back = el("confirm-back");
    const yes = el("confirm-yes");
    const no = el("confirm-no");
    const err = el("confirm-err");

    el("confirm-title").textContent = title;
    el("confirm-msg").innerHTML = message;
    el("confirm-fields").hidden = !fields;
    if (fields) {
      el("shift-from").value = minutesToTime(SHIFT_FROM);
      el("shift-to").value = minutesToTime(SHIFT_TO);
    }
    yes.textContent = confirmText;
    yes.classList.toggle("danger", Boolean(danger));
    yes.disabled = false;
    no.disabled = false;
    err.hidden = true;
    back.hidden = false;

    function close() {
      back.hidden = true;
      yes.onclick = null;
      no.onclick = null;
      back.onclick = null;
    }

    no.onclick = close;
    back.onclick = (event) => {
      if (event.target === back) close();
    };

    yes.onclick = function () {
      yes.disabled = true;
      no.disabled = true;
      yes.textContent = "Đang gửi...";
      err.hidden = true;

      onConfirm(function (res) {
        if (res && res.status === "success") {
          close();
          renderCalendar();               // hiện trạng thái mới ngay
          if (successText) showToast(successText, danger);
          setTimeout(() => requestUpdate(), 600);  // đồng bộ lại với Zoho
          return;
        }

        yes.disabled = false;
        no.disabled = false;
        yes.textContent = confirmText;
        const hints = {
          NO_TOKEN: "Chưa đăng nhập Zoho — đăng nhập rồi thử lại.",
          SESSION_EXPIRED: "Phiên đăng nhập hết hạn — đăng nhập lại Zoho.",
          NO_ERECNO: "Chưa lấy được mã nhân viên — mở people.zoho.com một lần.",
        };

        let text = (res && hints[res.kind]) || (res && res.message) || "";
        if (/failed to fetch|networkerror/i.test(text)) {
          text = "Không kết nối được tới Zoho — kiểm tra mạng rồi thử lại.";
        } else if (/limit|exceed/i.test(text)) {
          text = `Đã hết hạn mức ${ATTENDANCE_REQUEST_QUOTA} request trong chu kỳ này.`;
        }

        const lastError =
          chrome.runtime.lastError && chrome.runtime.lastError.message;
        if (!text && lastError) text = `Lỗi kết nối: ${lastError}`;
        if (!res) text = text || "Service worker không phản hồi — reload extension.";

        err.textContent = text || "Không gửi được — thử lại sau.";
        err.hidden = false;
      });
    };
  }

  const PORTAL = "https://people.zoho.com/hrportal1524046581683";
  const SHIFT_FROM = 9 * 60;
  const SHIFT_TO = 18 * 60 + 30;
  const ZOHO_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function toZohoDate(dateKey) {
    const d = new Date(`${dateKey}T00:00:00`);
    return `${pad(d.getDate())}-${ZOHO_MONTHS[d.getMonth()]}-${d.getFullYear()}`;
  }

  function readCreds() {
    return new Promise((resolve) =>
      chrome.storage.local.get(["csrfToken", "erecno"], resolve)
    );
  }

  async function postZoho(path, body, headers) {
    const res = await fetch(`${PORTAL}/${path}`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "X-Requested-With": "XMLHttpRequest",
        ...headers,
      },
      credentials: "include",
      body,
    });

    const text = await res.text();
    if (res.redirected && /accounts\.zoho\.com|signin/.test(res.url)) {
      throw new Error("Phiên đăng nhập hết hạn — đăng nhập lại Zoho.");
    }
    if (!res.ok) throw new Error(`Zoho trả lỗi HTTP ${res.status}`);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Zoho trả về dữ liệu không đọc được.");
    }

    const reason = data.message || data.errorMessage || data.error || "";
    if (data.status === 1 || /error|fail|invalid|limit/i.test(reason)) {
      throw new Error(reason || "Zoho từ chối yêu cầu.");
    }
    return data;
  }

  async function createRequest(dateKey, fromMin, toMin) {
    const { csrfToken, erecno } = await readCreds();
    if (!csrfToken) throw new Error("Chưa đăng nhập Zoho.");
    if (!erecno) throw new Error("Chưa có mã nhân viên — mở people.zoho.com một lần.");

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

  async function fetchRequestList() {
    const { csrfToken, erecno } = await readCreds();
    if (!csrfToken || !erecno) return null;

    const { start, end } = getCycle(new Date(), cycleOffset);
    const last = new Date(end.getTime() - 86400000);

    const data = await postZoho(
      "AttendanceAction.zp",
      new URLSearchParams({
        mode: "getMyRequest",
        conreqcsr: csrfToken,
        sDate: toZohoDate(dateKeyOf(start)),
        eDate: toZohoDate(dateKeyOf(last)),
        erecno: JSON.stringify([String(erecno)]),
        statFil: JSON.stringify(["-1"]),
      }),
      { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }
    );

    return (data.list || [])
      .map((row) => {
        const detail = (row.regDetails && row.regDetails[0]) || {};
        const d = parseZohoDay(detail.originday || row.startDate);
        if (!d) return null;
        return {
          date: dateKeyOf(d),
          status: /waiting|pending/i.test(row.approvalStatus || "")
            ? "pending"
            : /reject/i.test(row.approvalStatus || "")
              ? "rejected"
              : /cancel/i.test(row.approvalStatus || "")
                ? "cancelled"
                : "approved",
          statusText: row.approvalStatus || "",
          recordId: String(
            row.recordId || row.regId || row.regDetailsId || detail.recordId ||
            detail.regId || row.requestId || row.recId || ""
          ),
          inTime: detail.new_intime || "",
          outTime: detail.new_outtime || "",
        };
      })
      .filter(Boolean);
  }

  // "09:00" + "18:15" -> số giây làm việc, đã trừ nghỉ trưa
  function requestSeconds(request) {
    const toMinutes = (text) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(text || "").trim());
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    const from = toMinutes(request.inTime);
    const to = toMinutes(request.outTime);
    if (from === null || to === null || to <= from) return 0;
    const secs = (to - from) * 60 - LUNCH_BREAK_MS / 1000;
    return secs > 0 ? secs : 0;
  }

  function dateKeyOf(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseZohoDay(text) {
    const parts = String(text || "").split("-");
    if (parts.length !== 3) return null;
    const month = ZOHO_MONTHS.indexOf(parts[1]);
    if (month < 0) return null;
    const d = new Date(Number(parts[2]), month, Number(parts[0]));
    return isNaN(d.getTime()) ? null : d;
  }

  async function cancelRequest(recordId) {
    const { csrfToken } = await readCreds();
    if (!csrfToken) throw new Error("Chưa đăng nhập Zoho.");
    if (!recordId) throw new Error("Thiếu mã đơn — bấm Cập nhật rồi thử lại.");

    return postZoho(
      "AttendanceAction.zp",
      new URLSearchParams({
        mode: "cancelRegList",
        conreqcsr: csrfToken,
        regId: String(recordId),
        reason: "",
      }),
      { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }
    );
  }

  function runAction(work, done) {
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

  let openMenu = null;

  function closeCellMenu() {
    if (!openMenu) return;
    openMenu.remove();
    openMenu = null;
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onMenuKey, true);
    window.removeEventListener("scroll", closeCellMenu, true);
  }

  function onDocClick(event) {
    if (openMenu && !openMenu.contains(event.target)) closeCellMenu();
  }

  function onMenuKey(event) {
    if (event.key === "Escape") closeCellMenu();
  }

  function menuItem(cls, iconPath, title, sub) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `cm-item ${cls}`;

    const ico = document.createElement("span");
    ico.className = "cm-ico";
    ico.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPath}"/></svg>`;

    const box = document.createElement("span");
    box.className = "cm-label";
    const top = document.createElement("span");
    top.textContent = title;
    const bottom = document.createElement("span");
    bottom.className = "cm-sub";
    bottom.textContent = sub;
    box.appendChild(top);
    box.appendChild(bottom);

    btn.appendChild(ico);
    btn.appendChild(box);
    return btn;
  }

  function openCellMenu(cell, event, dateKey, label) {
    event.stopPropagation();
    closeCellMenu();

    const menu = document.createElement("div");
    menu.className = "cell-menu";

    const head = document.createElement("div");
    head.className = "cm-head";
    head.textContent = label;
    menu.appendChild(head);

    const leave = menuItem(
      "cm-leave",
      "M8 3v3M16 3v3M4 9h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z",
      "Request Leave",
      "Xin nghỉ phép"
    );
    leave.addEventListener("click", (e) => {
      e.stopPropagation();
      closeCellMenu();
      showToast("Sắp có");
    });

    const attendance = menuItem(
      "cm-att",
      "M12 7v5l3 2M12 3a9 9 0 110 18 9 9 0 010-18z",
      "Request Attendance",
      "Bổ sung chấm công"
    );
    attendance.addEventListener("click", (e) => {
      e.stopPropagation();
      closeCellMenu();
      confirmCreate(dateKey, label);
    });

    menu.appendChild(leave);
    menu.appendChild(attendance);
    document.body.appendChild(menu);
    openMenu = menu;

    const box = cell.getBoundingClientRect();
    const size = menu.getBoundingClientRect();
    const gap = 6;
    let left = box.left + box.width / 2 - size.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - size.width - 8));
    let top = box.bottom + gap;
    if (top + size.height > window.innerHeight - 8) {
      top = box.top - size.height - gap;
      menu.classList.add("flip");
    }
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(Math.max(8, top))}px`;
    menu.classList.add("show");

    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onMenuKey, true);
    window.addEventListener("scroll", closeCellMenu, true);
    leave.focus();
  }

  function confirmCreate(dateKey, label) {
    askConfirm({
      title: "Tạo request chấm công",
      message: `Tạo đơn <b>${label}</b>, ca làm:`,
      fields: true,
      confirmText: "Tạo request",
      successText: `Đã tạo đơn ${label}`,
      onConfirm(done) {
        const from = readTimeField("shift-from");
        const to = readTimeField("shift-to");
        if (from === null || to === null) {
          done({ status: "error", message: "Giờ không hợp lệ." });
          return;
        }
        if (to <= from) {
          done({ status: "error", message: "Giờ ra phải sau giờ vào." });
          return;
        }
        runAction(() => createRequest(dateKey, from, to), function (res) {
          if (res.status !== "success") {
            done(res);
            return;
          }

          // Lấy lại danh sách để có mã đơn thật
          fetchRequestList()
            .then((list) => {
              if (list) calRequests = list;
              done(res);
            })
            .catch(() => done(res));
        });
      },
    });
  }

  function confirmCancel(request, label) {
    askConfirm({
      title: "Huỷ request",
      message: `Huỷ đơn <b>${label}</b>?`,
      confirmText: "Huỷ đơn",
      danger: true,
      successText: `Đã huỷ đơn ${label}`,
      onConfirm(done) {
        runAction(() => cancelRequest(request.recordId), function (res) {
          if (res.status === "success") {
            calRequests = calRequests.filter(
              (r) => r.recordId !== request.recordId
            );
          }
          done(res);
        });
      },
    });
  }

  function toggleCalendar(show) {
    el("calendar-view").hidden = !show;
    el("cycle-board").hidden = show;
    el("calendarBtn").setAttribute("aria-pressed", String(show));
    el("calendarBtn").title = show ? "Quay lại tổng quan" : "Xem lịch tháng";
    if (show) renderCalendar();
  }

  /* ───── Cảnh báo ───── */

  const LOCK_KINDS = {
    SESSION_EXPIRED: {
      title: "Phiên đăng nhập đã hết hạn",
      text: "Zoho People đã đăng xuất bạn. Đăng nhập lại để tiếp tục theo dõi chấm công.",
    },
    NO_TOKEN: {
      title: "Chưa đăng nhập Zoho",
      text: "Đăng nhập Zoho People để extension đọc được dữ liệu chấm công của bạn.",
    },
    NO_ERECNO: {
      title: "Chưa nhận diện được bạn",
      text: "Mở tab people.zoho.com một lần để extension lấy mã nhân viên, rồi thử lại.",
    },
    NETWORK: {
      title: "Không kết nối được tới Zoho",
      text: "Kiểm tra kết nối mạng rồi thử lại. Dữ liệu hiển thị có thể đã cũ nên tạm ẩn.",
    },
  };

  function renderLock(syncError) {
    const lock = LOCK_KINDS[syncError && syncError.kind];
    const locked = Boolean(lock);

    el("lock-screen").hidden = !locked;
    el("app").hidden = locked;

    if (lock) {
      document.querySelector(".lock-title").textContent = lock.title;
      el("lock-text").textContent = lock.text;
    }
    return locked;
  }

  /* ───── Vòng đời ───── */

  function render() {
    chrome.storage.local.get(
      [
        "attendanceData",
        "leaveData",
        "leaveError",
        "requestData",
        "leaveRequestData",
        "syncError",
        "lastUpdated",
      ],
      function (data) {
        if (renderLock(data.syncError)) return;
        el("last-updated").textContent = data.lastUpdated
          ? `Cập nhật ${formatTime(new Date(data.lastUpdated))}`
          : "";

        const attendance = data.attendanceData;
        calDayList = (attendance && attendance.dayList) || {};
        calRequests = data.requestData || [];
        if (attendance && attendance.dayList) renderCycleStats(attendance.dayList);
        else resetCycleStats();

        renderLeaveList(data.leaveData, data.leaveError, cachedRequestUsed);
        renderRequests(data.requestData);
        renderLeaveRequests(data.leaveRequestData);
        renderToday(attendance && attendance.entries);
      }
    );
  }

  function requestUpdate(onDone) {
    const refreshBtn = el("refreshBtn");
    refreshBtn.disabled = true;
    refreshBtn.classList.add("spinning");

    chrome.runtime.sendMessage({ action: "updateAttendance" }, function (res) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove("spinning");

      const ok = res && res.status === "success";
      refreshBtn.classList.toggle("err", !ok);
      refreshBtn.title = ok ? "Cập nhật dữ liệu" : "Cập nhật thất bại — thử lại";

      render();
      if (onDone) onDone(ok);
    });
  }

  ROWS.forEach(bindRow);
  bindRow("absent");

  render();
  requestUpdate();

  const lockRetry = el("lock-retry");
  lockRetry.addEventListener("click", function () {
    lockRetry.disabled = true;
    lockRetry.textContent = "Đang kiểm tra...";

    requestUpdate(function () {
      lockRetry.disabled = false;
      lockRetry.textContent = "Đã đăng nhập — thử lại";
    });
  });

  el("refreshBtn").addEventListener("click", function () {
    requestUpdate();
  });

  el("calendarBtn").addEventListener("click", function () {
    toggleCalendar(el("calendar-view").hidden);
  });

  el("cal-prev").addEventListener("click", function () {
    calOffset = Math.max(-2, calOffset - 1);
    renderCalendar();
  });

  el("cal-next").addEventListener("click", function () {
    calOffset = Math.min(0, calOffset + 1);
    renderCalendar();
  });

  el("cycle-prev").addEventListener("click", function () {
    cycleOffset = Math.max(-1, cycleOffset - 1);
    render();
  });

  el("cycle-next").addEventListener("click", function () {
    cycleOffset = Math.min(0, cycleOffset + 1);
    render();
  });
});
