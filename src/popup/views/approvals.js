import { approveRequest, fetchApprovals, fetchPhoto, rejectRequest } from "../api.js";
import { parseApprovals } from "../approvals.js";
import { el } from "../dom.js";
import { formatDate } from "../format.js";
import { state } from "../state.js";
import { askConfirm } from "../ui/dialog.js";
import { showToast } from "../ui/toast.js";

const TAG_LABELS = { attendance: "Attendance", leave: "Leave" };

const ICON_APPROVE = "M5 12.5l4.2 4.2L19 7";
const ICON_REJECT = "M7 7l10 10M17 7L7 17";

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function icon(path) {
  const wrap = node("span", "appr-act-ico");
  wrap.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
  return wrap;
}

function initials(name) {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const last = words[words.length - 1];
  return (words.length > 1 ? words[0][0] + last[0] : last.slice(0, 2)).toUpperCase();
}

function dateSpan(item) {
  if (item.from && item.to && item.to.getTime() !== item.from.getTime()) {
    return `${formatDate(item.from)} → ${formatDate(item.to)}`;
  }
  if (item.from) return formatDate(item.from);
  return "";
}

function describe(item) {
  return `${item.type} của ${item.requester}`;
}

function errorText(error) {
  const message = (error && error.message) || "";
  if (/failed to fetch|networkerror/i.test(message)) {
    return "Không kết nối được tới Zoho — kiểm tra mạng rồi thử lại.";
  }
  return message || "Không gửi được — thử lại sau.";
}

function selectableItems() {
  return state.approvals.items.filter((item) => !state.approvals.busy.has(item.id));
}

function removeItem(id) {
  state.approvals.items = state.approvals.items.filter((item) => item.id !== id);
  state.approvals.selected.delete(id);
  delete state.approvals.errors[id];
}

async function runAction(item, work) {
  state.approvals.busy.add(item.id);
  delete state.approvals.errors[item.id];
  renderApprovals();
  try {
    await work(item);
    removeItem(item.id);
    return true;
  } catch (error) {
    console.error("[approvals] lỗi xử lý", item.id, error);
    state.approvals.errors[item.id] = errorText(error);
    return false;
  } finally {
    state.approvals.busy.delete(item.id);
    renderApprovals();
  }
}

async function approveOne(item) {
  if (await runAction(item, approveRequest)) showToast(`Đã duyệt ${describe(item)}`);
}

function rejectOne(item) {
  askConfirm({
    title: "Từ chối request",
    message: `Từ chối <b>${item.type}</b> của <b>${item.requester}</b>?`,
    confirmText: "Reject",
    cancelText: "Cancel",
    danger: true,
    reasonField: true,
    successText: `Đã từ chối ${describe(item)}`,
    onConfirm(done) {
      const reason = el("reject-reason").value.trim();
      runAction(item, (target) => rejectRequest(target, reason)).then((ok) =>
        done(ok ? { status: "success" } : { status: "error", message: state.approvals.errors[item.id] })
      );
    },
  });
}

function approveSelected() {
  const items = state.approvals.items.filter((item) => state.approvals.selected.has(item.id));
  if (items.length === 0) return;
  const names = [...new Set(items.map((item) => item.requester))].join(", ");

  askConfirm({
    title: `Duyệt ${items.length} request`,
    message: `Duyệt <b>${items.length}</b> request của ${names}?`,
    confirmText: `Duyệt ${items.length} request`,
    onConfirm(done) {
      (async () => {
        let approved = 0;
        for (const item of items) {
          if (await runAction(item, approveRequest)) approved++;
        }
        const failed = items.length - approved;
        if (failed === 0) {
          done({ status: "success" });
          showToast(`Đã duyệt ${approved} request`);
          return;
        }
        done({
          status: "error",
          message: `Duyệt được ${approved}/${items.length} request. ${failed} request lỗi — xem lý do ở từng dòng.`,
        });
      })();
    },
  });
}

function renderBadge() {
  const badge = el("approvals-badge");
  const count = state.approvals.status === "ready" ? state.approvals.items.length : 0;
  badge.textContent = count > 9 ? "9+" : String(count);
  badge.hidden = count === 0;
  el("approvalsBtn").setAttribute(
    "aria-label",
    count > 0 ? `Duyệt request, ${count} đang chờ` : "Duyệt request"
  );
}

function renderToolbar() {
  const bar = el("appr-toolbar");
  bar.textContent = "";
  const { status, items, selected, busy } = state.approvals;
  bar.hidden = status !== "ready" || items.length === 0;
  if (bar.hidden) return;

  const choices = selectableItems();
  const chosen = choices.filter((item) => selected.has(item.id)).length;

  const label = node("label", "appr-select-all");
  const box = node("input");
  box.type = "checkbox";
  box.checked = choices.length > 0 && chosen === choices.length;
  box.indeterminate = chosen > 0 && chosen < choices.length;
  box.disabled = choices.length === 0;
  box.addEventListener("change", () => {
    if (box.checked) choices.forEach((item) => selected.add(item.id));
    else selected.clear();
    renderApprovals();
  });
  label.append(box, node("span", "", chosen > 0 ? `Đã chọn ${chosen}/${items.length}` : "Chọn tất cả"));

  const bulk = node("button", "appr-bulk");
  bulk.type = "button";
  bulk.disabled = chosen === 0 || busy.size > 0;
  bulk.append(icon(ICON_APPROVE), node("span", "", chosen > 0 ? `Duyệt ${chosen}` : "Duyệt"));
  bulk.addEventListener("click", approveSelected);

  bar.append(label, bulk);
}

function actionButton(kind, item, busy) {
  const approve = kind === "approve";
  const button = node("button", `appr-act ${approve ? "is-approve" : "is-reject"}`);
  button.type = "button";
  button.disabled = busy;
  button.title = approve ? "Duyệt" : "Từ chối";
  button.setAttribute("aria-label", `${approve ? "Duyệt" : "Từ chối"} ${describe(item)}`);
  button.appendChild(icon(approve ? ICON_APPROVE : ICON_REJECT));
  button.addEventListener("click", () => (approve ? approveOne(item) : rejectOne(item)));
  return button;
}

function renderItem(item) {
  const { selected, busy, errors } = state.approvals;
  const isBusy = busy.has(item.id);
  const row = node("li", "appr-item");
  if (isBusy) row.classList.add("is-busy");
  row.setAttribute("aria-busy", String(isBusy));

  const pick = node("input", "appr-check");
  pick.type = "checkbox";
  pick.checked = selected.has(item.id);
  pick.disabled = isBusy;
  pick.setAttribute("aria-label", `Chọn ${describe(item)}`);
  pick.addEventListener("change", () => {
    if (pick.checked) selected.add(item.id);
    else selected.delete(item.id);
    renderApprovals();
  });

  const avatar = node("span", "appr-avatar", initials(item.requester));
  avatar.setAttribute("aria-hidden", "true");
  if (item.avatar) {
    fetchPhoto(item.avatar)
      .then((src) => {
        const img = node("img", "appr-avatar-img");
        img.alt = "";
        img.src = src;
        avatar.appendChild(img);
        avatar.classList.add("has-photo");
      })
      .catch(() => {});
  }

  const body = node("div", "appr-main");
  const name = node("div", "appr-name");
  if (item.requesterCode) name.appendChild(node("span", "appr-code tnum", `${item.requesterCode} · `));
  name.appendChild(document.createTextNode(item.requester));
  name.title = item.requesterCode ? `${item.requesterCode} · ${item.requester}` : item.requester;

  const meta = node("div", "appr-meta");
  const tag = node("span", `appr-tag t-${item.category}`, TAG_LABELS[item.category] || item.type);
  tag.title = item.type;
  meta.appendChild(tag);
  const detailText = [dateSpan(item), item.raisedOn ? `gửi ${formatDate(item.raisedOn)}` : ""]
    .filter(Boolean)
    .join(" · ");
  if (detailText) {
    const detail = node("span", "appr-type", detailText);
    detail.title = detailText;
    meta.appendChild(detail);
  }
  body.append(name, meta);

  if (errors[item.id]) {
    const err = node("div", "appr-err", errors[item.id]);
    err.setAttribute("role", "alert");
    body.appendChild(err);
  }

  const actions = node("div", "appr-actions");
  actions.append(actionButton("approve", item, isBusy), actionButton("reject", item, isBusy));

  row.append(pick, avatar, body, actions);
  return row;
}

function renderEmpty() {
  const box = node("div", "appr-empty");
  const art = node("span", "appr-empty-ico");
  art.setAttribute("aria-hidden", "true");
  art.innerHTML =
    '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 12.5l2 2 4-4"/></svg>';
  box.append(
    art,
    node("p", "appr-empty-title", "Bạn không có request nào cần duyệt"),
    node("p", "appr-empty-text", "Khi nhân viên báo cáo cho bạn gửi request chấm công hay đơn nghỉ, chúng sẽ hiện ở đây.")
  );
  return box;
}

function renderMessage(text, retry) {
  const box = node("div", "appr-state");
  box.appendChild(node("p", "appr-state-text", text));
  if (retry) {
    const button = node("button", "appr-retry", "Thử lại");
    button.type = "button";
    button.addEventListener("click", () => loadApprovals());
    box.appendChild(button);
  }
  return box;
}

export function renderApprovals() {
  renderBadge();
  renderToolbar();

  const { status, items, error } = state.approvals;
  el("appr-count").textContent = status === "ready" && items.length ? `${items.length} request` : "";

  const body = el("appr-body");
  body.textContent = "";
  body.setAttribute("aria-busy", String(status === "loading"));

  if (status === "loading" || status === "idle") {
    body.appendChild(renderMessage("Đang tải danh sách…"));
    return;
  }
  if (status === "error") {
    body.appendChild(renderMessage(error, true));
    return;
  }
  if (items.length === 0) {
    body.appendChild(renderEmpty());
    return;
  }

  const list = node("ul", "appr-list");
  items.forEach((item) => list.appendChild(renderItem(item)));
  body.appendChild(list);
}

export async function loadApprovals() {
  if (state.approvals.busy.size > 0) return;
  state.approvals.status = "loading";
  if (state.view === "approvals") renderApprovals();

  try {
    const data = await fetchApprovals();
    console.info("[approvals] response", data);
    const parsed = parseApprovals(data);
    if (parsed[0]) {
      console.info("[approvals] first item JSON:\n" + JSON.stringify(parsed[0].raw, null, 2));
    }
    state.approvals.items = parsed.sort(
      (a, b) => (b.raisedOn ? b.raisedOn.getTime() : 0) - (a.raisedOn ? a.raisedOn.getTime() : 0)
    );
    const ids = new Set(parsed.map((item) => item.id));
    state.approvals.selected.forEach((id) => {
      if (!ids.has(id)) state.approvals.selected.delete(id);
    });
    state.approvals.errors = {};
    state.approvals.status = "ready";
    state.approvals.error = "";
  } catch (error) {
    console.error("[approvals] lỗi:", error);
    state.approvals.status = "error";
    state.approvals.error = errorText(error);
  }
  renderApprovals();
}
