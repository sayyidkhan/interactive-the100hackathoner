
(function () {
  window.__loaderT0 = performance.now();
  var L = document.getElementById('loader');
  if (location.search.indexOf('capture=') !== -1) { window.__loader = { progress: function () {}, reveal: function () {}, fail: function () {} }; L.remove(); return; }
  var msg = document.getElementById('lmsg'), bar = document.getElementById('lbarFill');
  var revealed = false, failed = false, prog = 0;
  window.__loader = {
    progress: function (p) { p = Math.min(1, p); if (p > prog) { prog = p; bar.style.transform = 'scaleX(' + p + ')'; } },
    reveal: function () {
      if (revealed || failed) return; revealed = true;
      bar.style.transform = 'scaleX(1)';
      L.classList.add('reveal');
      setTimeout(function () { L.remove(); }, 800);
    },
    fail: function () {
      if (failed || revealed) return; failed = true;
      document.documentElement.classList.add('fail'); document.body.classList.add('fail');
      document.getElementById('fallback').hidden = false;
      msg.textContent = "The 3D version needs a newer browser — everything's here too.";
    }
  };
  /* module-evaluation failures surface here; resource 404s (no e.message) are ignored */
  addEventListener('error', function (e) { if (!revealed && !failed && !window.__worldReady && e && e.message) window.__loader.fail(); }, true);
  addEventListener('unhandledrejection', function () { if (!revealed && !failed && !window.__worldReady) window.__loader.fail(); });
  setTimeout(function () { if (!revealed && !failed && !window.__threeReady) window.__loader.fail(); }, 13000);
})();
