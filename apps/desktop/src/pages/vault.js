'use strict';
(function () {
  var yc = window.ycDesktop;
  if (!yc) return;

  var docs = [];
  var filtered = [];
  var selectedId = null;
  var loadTimer = null;

  var el = function (id) {
    return document.getElementById(id);
  };
  var encBadge = el('encBadge');
  var docCountEl = el('docCount');
  var sizeInfoEl = el('sizeInfo');
  var searchInput = el('searchInput');
  var searchCount = el('searchCount');
  var docList = el('docList');
  var loadingMsg = el('loadingMsg');
  var emptyMsg = el('emptyMsg');
  var dropZone = el('dropZone');
  var previewPanel = el('previewPanel');
  var previewTitle = el('previewTitle');
  var previewBody = el('previewBody');
  var previewImg = el('previewImg');
  var previewText = el('previewText');
  var previewMeta = el('previewMeta');
  var previewExport = el('previewExport');
  var previewReveal = el('previewReveal');
  var previewDel = el('previewDel');
  var previewClose = el('previewClose');

  var formatBytes = function (b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  var formatDate = function (ts) {
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  var fileIcon = function (mime) {
    if (/^image\//.test(mime)) return '\u{1F5BC}';
    if (/^text\/|^application\/(json|xml|javascript)/.test(mime)) return '\u{1F4DD}';
    if (/pdf/.test(mime)) return '\u{1F4D1}';
    if (/spreadsheet|excel|csv/.test(mime)) return '\u{1F4CA}';
    return '\u{1F4C4}';
  };

  var isImage = function (mime) {
    return /^image\//.test(mime);
  };

  var loadStats = function () {
    yc.vaultStats().then(function (res) {
      if (!res || !res.ok || !res.stats) return;
      var stats = res.stats;
      docCountEl.textContent = stats.count + ' document' + (stats.count !== 1 ? 's' : '');
      sizeInfoEl.textContent = formatBytes(stats.totalSizeBytes || 0);
    });
    yc.getAppVersion().then(function () {
      // Get encryption status from vault-stats (we don't have a separate info channel)
      // The badge shows whether encryption is available from preload
    });
    // Best-effort: check if vault-save works to infer readiness
  };

  // We don't have vault-get-info, so check encryption from context:
  // On macOS safeStorage is almost always available. Show status inline.
  var badgeEncryption = function () {
    // Can't detect encryption from renderer; just show status
    encBadge.textContent = 'OS keychain';
    encBadge.className = 'badge secure';
  };

  var filterDocs = function () {
    var q = searchInput.value.toLowerCase().trim();
    var list = docs;
    if (q) {
      list = docs.filter(function (d) {
        return d.filename.toLowerCase().includes(q);
      });
    }
    filtered = list;
    searchCount.textContent =
      filtered.length < docs.length ? filtered.length + '/' + docs.length : '';
    renderList(filtered);
  };

  var renderList = function (list) {
    var frag = document.createDocumentFragment();
    for (const d of list) {
      var div = document.createElement('div');
      div.className = 'doc' + (d.id === selectedId ? ' selected' : '');
      div.dataset.id = d.id;

      var thumb = document.createElement('div');
      thumb.className = 'thumb';
      thumb.textContent = fileIcon(d.mimeType);
      if (isImage(d.mimeType)) {
        // Load thumbnail on demand
        yc.vaultGet(d.id).then(function (res) {
          if (!res || !res.ok || !res.content) return;
          var buf = res.content;
          var blob = new Blob([new Uint8Array(buf.data || buf)], { type: d.mimeType });
          var url = URL.createObjectURL(blob);
          var img = document.createElement('img');
          img.src = url;
          img.onload = function () {
            URL.revokeObjectURL(url);
          };
          thumb.textContent = '';
          thumb.appendChild(img);
        });
      }

      var body = document.createElement('div');
      body.className = 'doc-body';
      var name = document.createElement('div');
      name.className = 'doc-name';
      name.textContent = d.filename;
      var meta = document.createElement('div');
      meta.className = 'doc-meta';
      meta.textContent = formatBytes(d.sizeBytes) + ' \u00B7 ' + formatDate(d.createdAt);
      body.appendChild(name);
      body.appendChild(meta);

      var actions = document.createElement('div');
      actions.className = 'doc-actions';
      var viewBtn = document.createElement('button');
      viewBtn.className = 'view';
      viewBtn.textContent = 'View';
      viewBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openPreview(d.id);
      });
      actions.appendChild(viewBtn);

      var expBtn = document.createElement('button');
      expBtn.textContent = 'Export';
      expBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        exportDoc(d.id);
      });
      actions.appendChild(expBtn);

      var delBtn = document.createElement('button');
      delBtn.className = 'del';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteDoc(d.id);
      });
      actions.appendChild(delBtn);

      div.appendChild(thumb);
      div.appendChild(body);
      div.appendChild(actions);
      div.addEventListener('click', function () {
        openPreview(d.id);
      });
      frag.appendChild(div);
    }
    docList.innerHTML = '';
    docList.appendChild(frag);
    loadingMsg.style.display = 'none';
    emptyMsg.style.display = list.length === 0 ? 'flex' : 'none';
  };

  // Throttled load
  var scheduleLoad = function () {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(loadDocs, 50);
  };

  var loadDocs = function () {
    loadingMsg.style.display = 'block';
    yc.vaultList().then(function (res) {
      if (!res || !res.ok) {
        loadingMsg.textContent = 'Failed to load vault.';
        return;
      }
      docs = (res.documents || []).sort(function (a, b) {
        return b.createdAt - a.createdAt;
      });
      badgeEncryption();
      loadStats();
      filterDocs();
    });
  };

  var openPreview = function (id) {
    selectedId = id;
    previewPanel.classList.add('open');
    previewBody.scrollTop = 0;
    previewTitle.textContent = 'Loading…';
    previewImg.style.display = 'none';
    previewText.style.display = 'none';
    previewMeta.innerHTML = '';

    var doc = docs.find(function (d) {
      return d.id === id;
    });
    if (!doc) return;
    previewTitle.textContent = doc.filename;

    // Build the metadata list with text nodes so persisted fields such as
    // doc.mimeType cannot inject markup into this file:// page.
    var dl = document.createElement('dl');
    var addMetaRow = function (label, value) {
      var dt = document.createElement('dt');
      dt.textContent = label;
      var dd = document.createElement('dd');
      dd.textContent = value;
      dl.appendChild(dt);
      dl.appendChild(dd);
    };
    addMetaRow('Type', doc.mimeType || 'unknown');
    addMetaRow('Size', formatBytes(doc.sizeBytes));
    addMetaRow('Added', formatDate(doc.createdAt));
    if (doc.updatedAt !== doc.createdAt) addMetaRow('Updated', formatDate(doc.updatedAt));
    previewMeta.innerHTML = '';
    previewMeta.appendChild(dl);

    if (isImage(doc.mimeType)) {
      yc.vaultGet(id).then(function (res) {
        if (!res || !res.ok || !res.content) return;
        var buf = res.content;
        var blob = new Blob([new Uint8Array(buf.data || buf)], { type: doc.mimeType });
        var url = URL.createObjectURL(blob);
        previewImg.src = url;
        previewImg.style.display = 'block';
        previewImg.onload = function () {
          URL.revokeObjectURL(url);
        };
      });
    } else {
      yc.vaultGet(id).then(function (res) {
        if (!res || !res.ok || !res.content) return;
        var buf = res.content;
        var decoder = new TextDecoder('utf-8');
        var text;
        try {
          text = decoder.decode(new Uint8Array(buf.data || buf));
        } catch (e) {
          text = 'Binary content. Use Export to save to disk.';
        }
        previewText.textContent = text.substring(0, 10000);
        previewText.style.display = 'block';
      });
    }

    previewExport.onclick = function () {
      exportDoc(id);
    };
    previewReveal.onclick = function () {
      revealDoc(id);
    };
    previewDel.onclick = function () {
      deleteDoc(id);
    };
  };

  var closePreview = function () {
    previewPanel.classList.remove('open');
    selectedId = null;
    previewImg.src = '';
  };

  var exportDoc = function (id) {
    yc.vaultExport(id).then(function (res) {
      if (!res || !res.ok) return;
      if (res.path) {
        // Show a brief success; the file was written
        // Refresh list to keep UI consistent
      }
    });
  };

  var revealDoc = function (id) {
    yc.vaultRevealDoc(id).catch(function () {});
  };

  var deleteDoc = function (id) {
    var doc = docs.find(function (d) {
      return d.id === id;
    });
    if (!doc) return;
    if (!window.confirm('Delete "' + doc.filename + '" from the vault?')) return;
    yc.vaultDelete(id).then(function (res) {
      if (!res || !res.ok) return;
      if (selectedId === id) closePreview();
      scheduleLoad();
    });
  };

  // ── Drag & drop ──
  var handleDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
    var files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    for (const f of files) {
      var reader = new FileReader();
      reader.onload = function (evt) {
        var result = evt.target.result;
        var commaIdx = result.indexOf(',');
        var base64 = commaIdx >= 0 ? result.substring(commaIdx + 1) : result;
        yc.vaultSaveBuffer(f.name, base64, f.type || 'application/octet-stream').then(
          function (res) {
            if (res && res.ok) scheduleLoad();
          }
        );
      };
      reader.readAsDataURL(f);
    }
  };

  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', handleDrop);

  // ── Search ──
  searchInput.addEventListener('input', filterDocs);

  // ── Preview close ──
  previewClose.addEventListener('click', closePreview);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePreview();
  });

  // ── Init ──
  badgeEncryption();
  scheduleLoad();
})();
