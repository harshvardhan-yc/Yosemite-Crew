(function () {
  var params = new URLSearchParams(location.search);
  var reason = params.get('reason');
  if (reason) document.getElementById('detail').textContent = reason;

  var retried = false;
  var retry = function () {
    if (retried) return;
    retried = true;
    if (globalThis.ycDesktop) globalThis.ycDesktop.reload();
  };
  document.getElementById('retry').addEventListener('click', retry);
  document.getElementById('browser').addEventListener('click', function () {
    if (globalThis.ycDesktop) globalThis.ycDesktop.openInBrowser();
  });

  // Reconnect immediately when the network comes back.
  globalThis.addEventListener('online', retry);

  var secs = 20;
  var secsEl = document.getElementById('secs');
  var timer = setInterval(function () {
    secs -= 1;
    if (secs <= 0) {
      clearInterval(timer);
      retry();
      return;
    }
    secsEl.textContent = String(secs);
  }, 1000);
})();
