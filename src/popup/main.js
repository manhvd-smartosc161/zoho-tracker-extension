import { el } from "./dom.js";
import { state } from "./state.js";
import { render, requestUpdate } from "./sync.js";
import { bindToast } from "./ui/toast.js";
import { renderCalendar, toggleCalendar } from "./views/calendar.js";
import { bindRows } from "./views/cycle-board.js";

function shiftOffset(key, delta, min) {
  state[key] = Math.min(0, Math.max(min, state[key] + delta));
}

bindRows();
bindToast();

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

el("refreshBtn").addEventListener("click", () => requestUpdate());

el("calendarBtn").addEventListener("click", () => toggleCalendar(el("calendar-view").hidden));

el("cal-prev").addEventListener("click", () => {
  shiftOffset("calOffset", -1, -2);
  renderCalendar();
});

el("cal-next").addEventListener("click", () => {
  shiftOffset("calOffset", 1, -2);
  renderCalendar();
});

el("cycle-prev").addEventListener("click", () => {
  shiftOffset("cycleOffset", -1, -1);
  render();
});

el("cycle-next").addEventListener("click", () => {
  shiftOffset("cycleOffset", 1, -1);
  render();
});
