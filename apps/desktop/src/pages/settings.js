(function () {
  var yc = globalThis.ycDesktop;
  if (!yc) return;

  var statusEl = document.getElementById('status');
  var saveTimer = null;

  var showSaved = function () {
    statusEl.textContent = 'Saved';
    statusEl.classList.add('show');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      statusEl.classList.remove('show');
    }, 2000);
  };

  var setTheme = function (mode) {
    if (mode === 'dark') {
      document.documentElement.dataset.theme = 'dark';
    } else if (mode === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      delete document.documentElement.dataset.theme;
    }
  };

  var setFontScale = function (pct) {
    var scale = Math.round(pct) / 100;
    document.body.style.fontSize = scale * 100 + '%';
    document.getElementById('fontScaleLabel').textContent = Math.round(pct) + '%';
  };

  var loadSettings = function () {
    yc.getSettings().then(function (res) {
      if (!res || !res.ok || !res.settings) return;
      var s = res.settings;
      setValue('theme', s.theme || 'system');
      setTheme(s.theme || 'system');
      setValue('updateChannel', s.updateChannel || 'latest');
      setValue('idleLockMinutes', String(s.idleLockMinutes == null ? 0 : s.idleLockMinutes));
      setChecked('telemetryOptIn', s.telemetryOptIn === true);
      setChecked('openAtLogin', s.openAtLogin === true);
      setChecked('notificationsEnabled', s.notificationsEnabled !== false);
      setValue('dndStart', s.dndStart || '22:00');
      setValue('dndEnd', s.dndEnd || '07:00');
      setValue('telehealthProvider', s.telehealthProvider || 'getstream');
      if (s.fontScale != null) {
        var pct = Math.round(s.fontScale * 100);
        setValue('fontScale', String(pct));
        setFontScale(pct);
      }
    });
    refreshSyncStatus();
  };

  var setValue = function (id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val;
  };

  var setChecked = function (id, val) {
    var el = document.getElementById(id);
    if (el) el.checked = val;
  };

  var getValue = function (id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  };

  var getChecked = function (id) {
    var el = document.getElementById(id);
    return el ? el.checked : false;
  };

  var saveSettings = function () {
    var fontScaleVal = Number.parseInt(getValue('fontScale'), 10) || 100;
    var settings = {
      theme: getValue('theme'),
      fontScale: Math.round(fontScaleVal) / 100,
      updateChannel: getValue('updateChannel'),
      idleLockMinutes: Number.parseInt(getValue('idleLockMinutes'), 10) || 0,
      notificationsEnabled: getChecked('notificationsEnabled'),
      dndStart: getValue('dndStart'),
      dndEnd: getValue('dndEnd'),
      telemetryOptIn: getChecked('telemetryOptIn'),
      telehealthProvider: getValue('telehealthProvider') || 'getstream',
      openAtLogin: getChecked('openAtLogin'),
    };
    yc.setSettings(settings).then(function (res) {
      if (res && res.ok) showSaved();
    });
  };

  var renderSyncStatus = function (res) {
    var el = document.getElementById('syncStatusText');
    if (!el || !res || !res.status) return;
    var s = res.status;
    var label = s.state || 'unknown';
    if (s.state === 'blocked') label = 'Waiting for sync endpoint';
    if (s.state === 'idle') label = 'Up to date';
    if (s.state === 'pending') label = 'Pending local changes';
    if (s.state === 'offline') label = 'Offline';
    if (s.state === 'not-ready') label = 'Initializing';
    if (s.state === 'error') label = 'Last sync failed';
    el.textContent =
      label + ' - pending ' + (s.pendingMutations || 0) + ' - dirty rows ' + (s.dirtyRows || 0);
  };

  var refreshSyncStatus = function () {
    if (!yc.getSyncStatus) return;
    yc.getSyncStatus().then(renderSyncStatus);
  };

  var onChange = function () {
    saveSettings();
  };

  document.querySelectorAll('select, input').forEach(function (el) {
    el.addEventListener('change', onChange);
    if (el.type === 'text') el.addEventListener('input', onChange);
  });

  document.getElementById('theme').addEventListener('change', function () {
    setTheme(getValue('theme'));
    saveSettings();
  });

  document.getElementById('fontScale').addEventListener('input', function () {
    var pct = Number.parseInt(this.value, 10) || 100;
    setFontScale(pct);
    saveSettings();
  });

  var syncNow = document.getElementById('syncNow');
  if (syncNow) {
    syncNow.addEventListener('click', function () {
      syncNow.disabled = true;
      yc.syncNow()
        .then(renderSyncStatus)
        .finally(function () {
          syncNow.disabled = false;
        });
    });
  }

  var clearLocalData = document.getElementById('clearLocalData');
  if (clearLocalData) {
    clearLocalData.addEventListener('click', function () {
      if (!globalThis.confirm('Clear local desktop data? You will need to sign in again.')) return;
      clearLocalData.disabled = true;
      yc.clearLocalData()
        .then(function (res) {
          if (res && res.ok) {
            showSaved();
            refreshSyncStatus();
          }
        })
        .finally(function () {
          clearLocalData.disabled = false;
        });
    });
  }

  loadSettings();
})();
