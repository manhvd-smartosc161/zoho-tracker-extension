const ATTENDANCE_REQUEST_QUOTA = 3;
const DAYS_6_TO_8_LIMIT = 5;
const LUNCH_BREAK_MS = 1.25 * 60 * 60 * 1000;
const CHECKOUT_6H_OFFSET_MS = 7.25 * 60 * 60 * 1000;
const CHECKOUT_8H_OFFSET_MS = 9.25 * 60 * 60 * 1000;
const LUNCH_START_HOUR = 12;
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
    return `${Math.floor(tsecs / 3600)}h${pad(Math.round((tsecs % 3600) / 60))}`;
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

  function getCycle(today) {
    const anchor = today.getDate() >= 21 ? 0 : -1;
    return {
      start: new Date(today.getFullYear(), today.getMonth() + anchor, 21),
      end: new Date(today.getFullYear(), today.getMonth() + anchor + 1, 21),
    };
  }

  /* ───── Hôm nay ───── */

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

    const checkin = new Date(todayEntries[0].fdate.replace(/-/g, "/"));
    if (isNaN(checkin.getTime())) return resetToday(weekend);

    const mark6 = new Date(checkin.getTime() + CHECKOUT_6H_OFFSET_MS);
    const mark8 = new Date(checkin.getTime() + CHECKOUT_8H_OFFSET_MS);
    const worked = workedMsSince(checkin, now);

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
      el("progress-hint").textContent = `Còn ${formatCountdown(mark8 - now)} nữa là đủ 8 tiếng`;
    } else {
      setStatus("Đang trong ca", true);
      el("progress-hint").textContent = `Còn ${formatCountdown(mark6 - now)} nữa là đủ 6 tiếng`;
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
    const { start, end } = getCycle(new Date());
    el("cycle-range").textContent = `${formatDate(start)} → ${formatDate(
      new Date(end.getTime() - 86400000)
    )}`;

    const below6 = [];
    const between6And8 = [];
    const missingRequest = [];
    let requestUsed = 0;
    const leaveDays = [];

    Object.values(dayList).forEach((day) => {
      const date = new Date(day.orgdate);
      if (date < start || date > end) return;

      const tsecs = day.tsecs || 0;
      const status = (day.status || "").trim();

      if (tsecs > 0) {
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
      if (status === "Absent" && !day.approvalInfo && !day.leaveDaysTaken) {
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

  function renderRequestRow(key, requests, withType, quota) {
    const rows = requests || [];
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
      `${rows.length}/${quota}`,
      quotaTone(rows.length, quota),
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
        container.appendChild(makeQuota(leave.name, leave.used, leave.total));
      });

      const annual = rows.find((r) => /annual/i.test(r.name)) || rows[0];
      const left = Math.max(0, annual.total - annual.used);
      el("leave-aside").textContent = `còn ${left} ngày ${annual.name.replace(/ ?leave$/i, "")}`;
    }

    container.appendChild(
      makeQuota("Attendance", requestUsed || 0, ATTENDANCE_REQUEST_QUOTA)
    );
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

    console.log("[popup] renderLock:", syncError && syncError.kind, "→ khoá:", locked);

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
});
