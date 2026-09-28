(function () {
  function send() {
    window.postMessage(
      {
        source: "zoho-attendance-tracker",
        erecno: window.erecno,
        locationId: window._LOGGEDIN_LOCID,
      },
      "*"
    );
  }

  send();

  let tries = 0;
  const timer = setInterval(function () {
    tries++;
    if (window.erecno || tries > 20) {
      clearInterval(timer);
      if (window.erecno) send();
    }
  }, 500);
})();
