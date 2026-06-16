(function () {
  var yc = globalThis.ycDesktop;
  var searchEl = document.getElementById('search');
  var resultsEl = document.getElementById('results');
  var selectedIndex = -1;
  var results = [];
  var currentQuery = '';
  var recentsCache = [];
  var actionMap = {};
  var ACTIONS = [];

  function buildActionMap(items) {
    ACTIONS = items;
    actionMap = {};
    ACTIONS.forEach(function (a) {
      actionMap[a.id] = a;
    });
  }

  function scoreFuzzy(query, text) {
    var q = query.toLowerCase().trim();
    var t = text.toLowerCase().trim();
    if (!q || !t) return 0;
    if (t === q) return 100;
    if (t.startsWith(q)) return 90;
    if (t.includes(q)) return 70;
    var qi = 0,
      consecutive = 0,
      maxConsecutive = 0;
    for (var ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        qi++;
        consecutive++;
        if (consecutive > maxConsecutive) maxConsecutive = consecutive;
      } else {
        consecutive = 0;
      }
    }
    if (qi < q.length) return 0;
    return Math.min(50 + maxConsecutive * 5, 69);
  }

  function search(query, recents) {
    var q = query.toLowerCase().trim();
    if (!q) return { results: [], isRecents: true };
    var scored = [];
    ACTIONS.forEach(function (item) {
      var texts = [item.label, item.desc].concat(item.kw).filter(Boolean);
      var best = 0;
      texts.forEach(function (t) {
        var s = scoreFuzzy(q, t);
        if (s > best) best = s;
      });
      if (best > 0) {
        var r = recents.filter(function (re) {
          return re.id === item.id;
        });
        var boost =
          r.length > 0 ? Math.min(15, Math.max(0, 15 - (Date.now() - r[0].visitedAt) / 60000)) : 0;
        scored.push({ item: item, score: best + boost });
      }
    });
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    return { results: scored, isRecents: false };
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c];
    });
  }

  function highlightLabel(label, query) {
    if (!query || !query.trim()) return escapeHtml(label);
    var q = query.toLowerCase();
    var l = label;
    var indices = [];
    var li = 0;
    for (var qi = 0; qi < q.length && li < l.length; li++) {
      if (l[li].toLowerCase() === q[qi]) {
        indices.push(li);
        qi++;
      }
    }
    if (indices.length === 0) return escapeHtml(label);
    var result = '';
    var lastIdx = 0;
    indices.forEach(function (idx) {
      result += escapeHtml(l.slice(lastIdx, idx)) + '<mark>' + escapeHtml(l[idx]) + '</mark>';
      lastIdx = idx + 1;
    });
    result += escapeHtml(l.slice(lastIdx));
    return result;
  }

  function render(query) {
    currentQuery = query;
    var data = search(query, recentsCache);
    var html = '';
    results = [];
    selectedIndex = -1;

    if (data.isRecents && recentsCache.length > 0) {
      html += '<div class="section-title">Recent</div>';
      recentsCache.forEach(function (r) {
        var a = actionMap[r.id];
        if (!a) return;
        var icon = a.icon || '\u2022';
        results.push(a);
        html +=
          '<div class="item" data-index="' +
          (results.length - 1) +
          '">' +
          '<div class="item-icon recents-clock">' +
          escapeHtml(icon) +
          '</div>' +
          '<div class="item-label">' +
          escapeHtml(a.label) +
          '</div>' +
          (a.desc ? '<div class="item-desc">' + escapeHtml(a.desc) + '</div>' : '') +
          '</div>';
      });
      if (results.length === 0) html += '<div id="empty">No recents yet</div>';
    } else if (data.results.length > 0) {
      data.results.forEach(function (r, i) {
        var a = r.item;
        var icon = a.icon || '\u2022';
        results.push(a);
        html +=
          '<div class="item" data-index="' +
          i +
          '">' +
          '<div class="item-icon">' +
          escapeHtml(icon) +
          '</div>' +
          '<div class="item-label">' +
          highlightLabel(a.label, query) +
          '</div>' +
          '<div class="item-type">' +
          escapeHtml(a.type) +
          '</div>' +
          '</div>';
      });
    } else if (query.trim()) {
      html += '<div id="empty">No results for "' + escapeHtml(query) + '"</div>';
    } else {
      html += '<div id="empty">Type to search commands</div>';
    }

    resultsEl.innerHTML = html;

    resultsEl.querySelectorAll('.item').forEach(function (el) {
      el.addEventListener('click', function () {
        var idx = Number.parseInt(el.dataset.index, 10);
        selectItem(idx);
      });
      el.addEventListener('mousemove', function () {
        var idx = Number.parseInt(el.dataset.index, 10);
        if (selectedIndex !== idx) {
          setSelected(idx);
        }
      });
    });

    // Auto-select the first result so Enter activates it immediately.
    if (results.length > 0) setSelected(0);
  }

  function setSelected(idx) {
    if (selectedIndex >= 0) {
      var prev = resultsEl.querySelector('.item[data-index="' + selectedIndex + '"]');
      if (prev) prev.classList.remove('selected');
    }
    selectedIndex = idx;
    if (selectedIndex >= 0) {
      var next = resultsEl.querySelector('.item[data-index="' + selectedIndex + '"]');
      if (next) {
        next.classList.add('selected');
        next.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function selectItem(idx) {
    var item = results[idx];
    if (!item) return;
    if (yc && typeof yc.executeCommand === 'function') {
      yc.executeCommand(item.id);
    }
  }

  searchEl.addEventListener('input', function () {
    render(this.value);
  });

  searchEl.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(Math.min(results.length - 1, selectedIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(Math.max(0, selectedIndex - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        selectItem(selectedIndex);
      }
    } else if (e.key === 'Escape') {
      if (yc && typeof yc.closePalette === 'function') {
        yc.closePalette();
      }
    }
  });

  // Actions come from an async IPC call so the HTML and TS share one source of truth.
  // Load them first, then load recents, then render.
  function loadActionsAndRecents() {
    if (yc && typeof yc.getPaletteActions === 'function') {
      Promise.resolve(yc.getPaletteActions())
        .then(function (r) {
          if (r && r.ok && r.actions) {
            buildActionMap(r.actions);
          }
          return yc && typeof yc.getPaletteRecents === 'function'
            ? Promise.resolve(yc.getPaletteRecents())
            : Promise.resolve({ recents: [] });
        })
        .then(function (r) {
          if (r && r.recents) {
            recentsCache = r.recents;
          } else if (Array.isArray(r)) {
            recentsCache = r;
          } else {
            recentsCache = [];
          }
          render(currentQuery);
        })
        .catch(function () {
          render(currentQuery);
        });
    } else {
      // Fallback: use minimal built-in actions if IPC unavailable
      buildActionMap([
        {
          id: 'open-settings',
          label: 'Open settings',
          desc: 'Application preferences',
          kw: ['preferences', 'config', 'options'],
          type: 'action',
          icon: '\u2699',
        },
      ]);
      render('');
    }
  }

  loadActionsAndRecents();
  searchEl.focus();
})();
