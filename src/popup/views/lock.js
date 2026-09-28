import { el } from "../dom.js";

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

export function renderLock(syncError) {
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
