window.addEventListener("message", function (event) {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "zoho-attendance-tracker") return;
  if (!data.erecno) return;

  console.log("[Zoho Tracker] Đã đọc erecno:", data.erecno);
  chrome.runtime.sendMessage({
    action: "saveIdentity",
    erecno: String(data.erecno),
    locationId: data.locationId ? String(data.locationId) : "",
  });
});

const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
script.onload = function () {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);
