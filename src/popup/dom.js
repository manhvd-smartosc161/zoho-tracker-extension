const missing = new Set();

export function el(id) {
  const node = document.getElementById(id);
  if (!node && !missing.has(id)) {
    missing.add(id);
    console.warn(`[popup] Không tìm thấy #${id}`);
  }
  return node || document.createElement("span");
}
