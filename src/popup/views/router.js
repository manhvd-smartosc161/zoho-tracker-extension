import { el } from "../dom.js";
import { state } from "../state.js";
import { loadApprovals, renderApprovals } from "./approvals.js";
import { renderCalendar } from "./calendar.js";

const VIEWS = {
  overview: ["hero", "cycle-board"],
  calendar: ["calendar-view"],
  approvals: ["approvals-view"],
};

const BUTTONS = { calendar: "calendarBtn", approvals: "approvalsBtn" };

export function showView(name) {
  state.view = name;
  Object.entries(VIEWS).forEach(([view, ids]) => {
    ids.forEach((id) => {
      el(id).hidden = view !== name;
    });
  });
  Object.entries(BUTTONS).forEach(([view, id]) => {
    el(id).setAttribute("aria-pressed", String(view === name));
  });

  if (name === "calendar") renderCalendar();
  if (name === "approvals") {
    renderApprovals();
    if (state.approvals.status === "idle" || state.approvals.status === "error") loadApprovals();
  }
}
