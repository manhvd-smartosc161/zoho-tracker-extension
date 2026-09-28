import { ATTENDANCE_REQUEST_QUOTA } from "../shared/config.js";
import { fromDateKey } from "../shared/dates.js";
import { cancelRequest, createLeave, createRequest, fetchRequestList, runAction } from "./api.js";
import { leaveDuration } from "./config.js";
import { el } from "./dom.js";
import { formatDate, leaveShortName } from "./format.js";
import { attendanceQuota, leaveExhausted, leaveTypes, mergeRequests } from "./quota.js";
import { state } from "./state.js";
import { requestUpdate } from "./sync.js";
import { askConfirm, showNotice } from "./ui/dialog.js";
import { readTimeField, refreshLeaveTotal, showReasonError } from "./ui/forms.js";
import { showToast } from "./ui/toast.js";
import { renderCalendar } from "./views/calendar.js";

function syncAfterChange() {
  renderCalendar();
  setTimeout(() => requestUpdate(), 600);
}

export function confirmCreate(dateKey, label) {
  const quota = attendanceQuota(dateKey);
  if (quota.left <= 0) {
    const days = quota.usedDays.map((key) => formatDate(fromDateKey(key))).join(", ");
    showNotice(
      "Đã hết request chấm công",
      `Chu kỳ <b>${quota.range}</b> đã dùng <b>${quota.used}/${ATTENDANCE_REQUEST_QUOTA}</b> request (${days}). Không tạo thêm được cho <b>${label}</b>.<br>Hạn mức mới bắt đầu từ ${quota.nextStart}.`,
      dateKey
    );
    return;
  }

  const quotaNote = `<br>Còn <b>${quota.left}/${ATTENDANCE_REQUEST_QUOTA}</b> request trong chu kỳ ${quota.range}.`;

  askConfirm({
    title: "Tạo request chấm công",
    message: `Tạo request cho <b>${label}</b>, ca làm:${quotaNote}`,
    fields: true,
    confirmText: "Tạo request",
    successText: `Đã tạo request ${label}`,
    returnKey: dateKey,
    onSuccess: syncAfterChange,
    onConfirm(done) {
      const from = readTimeField("shift-from");
      const to = readTimeField("shift-to");
      if (from === null || to === null) {
        done({ status: "error", message: "Nhập giờ dạng HH:MM, ví dụ 09:00." });
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
            if (list) state.requests = mergeRequests(list, state.dayList);
            done(res);
          })
          .catch(() => done(res));
      });
    },
  });
}

export function confirmLeave(dateKey, label, cell) {
  const types = leaveTypes();
  if (types.length === 0) {
    if (cell && cell.isConnected) cell.focus();
    showToast("Chưa có loại phép — bấm nút ↻ ở góc trên để cập nhật.", true);
    return;
  }
  if (leaveExhausted()) {
    const list = types
      .map((type) => `${leaveShortName(type)} ${type.used || 0}/${type.total || 0}`)
      .join(", ");
    showNotice(
      "Đã hết ngày phép",
      `Không loại phép nào còn số dư trong năm nay (${list}). Không xin nghỉ được cho <b>${label}</b>.`,
      dateKey
    );
    return;
  }

  askConfirm({
    title: "Xin nghỉ phép",
    message: `Đơn nghỉ <b>${label}</b>:`,
    confirmText: "Gửi đơn",
    leaveFields: types,
    successText: `Đã gửi đơn nghỉ ${label}`,
    returnKey: dateKey,
    onSuccess: syncAfterChange,
    onConfirm(done) {
      const typeId = el("leave-type").value;
      const duration = el("leave-duration").value;
      const reason = el("leave-reason").value.trim();
      if (!typeId) {
        done({ status: "error", message: "Chọn loại phép để gửi đơn." });
        return;
      }
      if (!refreshLeaveTotal()) {
        el("leave-duration").focus();
        done({ status: "invalid" });
        return;
      }
      if (!reason) {
        showReasonError(true);
        el("leave-reason").focus();
        done({ status: "invalid" });
        return;
      }
      showReasonError(false);
      runAction(
        () => createLeave(dateKey, typeId, duration, reason),
        function (res) {
          if (res.status !== "success") {
            done(res);
            return;
          }
          state.leaveRequests = state.leaveRequests.concat({
            date: dateKey,
            status: "pending",
            statusText: "Waiting for approval",
            days: leaveDuration(duration).days,
          });
          setTimeout(() => requestUpdate(), 400);
          done(res);
        }
      );
    },
  });
}

export function confirmCancel(request, label, dateKey) {
  askConfirm({
    title: "Huỷ request",
    message: `Huỷ request chấm công <b>${label}</b>? Có thể tạo lại sau.`,
    confirmText: "Huỷ request",
    cancelText: "Giữ request",
    danger: true,
    successText: `Đã huỷ request ${label}`,
    returnKey: dateKey,
    onSuccess: syncAfterChange,
    onConfirm(done) {
      runAction(() => cancelRequest(request.recordId), function (res) {
        if (res.status === "success") {
          state.requests = state.requests.filter((r) => r.recordId !== request.recordId);
        }
        done(res);
      });
    },
  });
}
