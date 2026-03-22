(function (global) {
  'use strict';

  function getDocument(target) {
    if (!target) return global.document;
    if (target.ownerDocument) return target.ownerDocument;
    if (target.document) return target.document;
    return target;
  }

  function clearChildren(node) {
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function createSvgEl(doc, tag, attrs) {
    var el = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    return el;
  }

  function buildMicIcon(doc) {
    var svg = createSvgEl(doc, 'svg', { viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' });
    svg.appendChild(createSvgEl(doc, 'rect', { x: '9', y: '2', width: '6', height: '11', rx: '3' }));
    svg.appendChild(createSvgEl(doc, 'path', {
      d: 'M5 10a7 7 0 0 0 14 0',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      fill: 'none'
    }));
    svg.appendChild(createSvgEl(doc, 'line', {
      x1: '12', y1: '17', x2: '12', y2: '22',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round'
    }));
    svg.appendChild(createSvgEl(doc, 'line', {
      x1: '8', y1: '22', x2: '16', y2: '22',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round'
    }));
    return svg;
  }

  function buildFolderIcon(doc) {
    var svg = createSvgEl(doc, 'svg', { viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' });
    svg.appendChild(createSvgEl(doc, 'path', {
      d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linejoin': 'round',
      fill: 'none'
    }));
    return svg;
  }

  function showLandingError(container, msg) {
    var doc = getDocument(container);
    var errorEl = container.querySelector ? container.querySelector('#landing-error') : null;
    if (!errorEl) {
      errorEl = doc.createElement('p');
      errorEl.id = 'landing-error';
      errorEl.style.cssText = 'color:var(--danger);font-size:0.875rem;margin-top:0.5rem;font-family:var(--font-ui);';
      var landing = container.querySelector ? container.querySelector('.landing') : null;
      (landing || container).appendChild(errorEl);
    }
    errorEl.textContent = msg;
    return errorEl;
  }

  function showMicError(doc, msg) {
    doc = getDocument(doc);
    var overlay = doc.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(28,25,23,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;padding:2rem;';

    var icon = doc.createElement('div');
    icon.style.cssText = 'font-size:3rem;margin-bottom:1.5rem;';
    icon.textContent = '\u26A0\uFE0F';
    overlay.appendChild(icon);

    var heading = doc.createElement('h2');
    heading.style.cssText = 'color:var(--danger);font-size:1.25rem;font-weight:700;margin-bottom:1rem;text-align:center;font-family:var(--font-ui);';
    heading.textContent = 'Microphone Error';
    overlay.appendChild(heading);

    var msgEl = doc.createElement('p');
    msgEl.style.cssText = 'color:var(--text-primary);font-size:0.95rem;line-height:1.6;max-width:480px;text-align:center;font-family:var(--font-ui);';
    msgEl.textContent = msg;
    overlay.appendChild(msgEl);

    doc.body.appendChild(overlay);
    return overlay;
  }

  function renderLanding(container, options) {
    options = options || {};
    var doc = getDocument(container);
    clearChildren(container);

    var landing = doc.createElement('div');
    landing.className = 'landing';

    var iconWrap = doc.createElement('div');
    iconWrap.className = 'landing__icon';
    iconWrap.appendChild(buildMicIcon(doc));
    landing.appendChild(iconWrap);

    var title = doc.createElement('h1');
    title.className = 'landing__title';
    title.textContent = 'Voice Line Recorder';
    landing.appendChild(title);

    var subtitle = doc.createElement('p');
    subtitle.className = 'landing__subtitle';
    subtitle.textContent = 'Record audio for each line of your script. Load a .txt file to get started.';
    landing.appendChild(subtitle);

    var divider = doc.createElement('div');
    divider.className = 'landing__divider';
    landing.appendChild(divider);

    var fileInput = doc.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt';
    fileInput.className = 'file-input-hidden';
    fileInput.id = 'script-file-input';
    fileInput.setAttribute('aria-label', 'Load script file');
    landing.appendChild(fileInput);

    var loadBtn = doc.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'btn-load';
    loadBtn.appendChild(buildFolderIcon(doc));
    loadBtn.appendChild(doc.createTextNode('Load Script'));
    loadBtn.addEventListener('click', function () {
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (file && typeof options.onLoadScript === 'function') {
        options.onLoadScript(file);
      }
    });

    landing.appendChild(loadBtn);

    var footer = doc.createElement('p');
    footer.className = 'landing__footer';
    footer.textContent = 'Open a .txt script file to begin';
    landing.appendChild(footer);

    container.appendChild(landing);
    return { root: landing, fileInput: fileInput, loadButton: loadBtn };
  }

  function renderSetupScreen(container, options) {
    options = options || {};
    var doc = getDocument(container);
    clearChildren(container);

    var browser = options.browser || { name: 'Unknown', canDirectSave: false };
    var state = options.state || {};
    var restoredHandle = options.restoredHandle || null;

    var setup = doc.createElement('div');
    setup.className = 'setup';

    var iconWrap = doc.createElement('div');
    iconWrap.className = 'setup__icon';
    iconWrap.appendChild(buildMicIcon(doc));
    setup.appendChild(iconWrap);

    var title = doc.createElement('h1');
    title.className = 'setup__title';
    title.textContent = 'Setup';
    setup.appendChild(title);

    var card = doc.createElement('div');
    card.className = 'setup__card';

    function appendInfoRow(labelText, valueText) {
      var row = doc.createElement('div');
      row.className = 'setup__info-row';
      var label = doc.createElement('span');
      label.className = 'setup__info-label';
      label.textContent = labelText;
      var value = doc.createElement('span');
      value.className = 'setup__info-value';
      value.textContent = valueText;
      row.appendChild(label);
      row.appendChild(value);
      card.appendChild(row);
    }

    appendInfoRow('Browser', browser.name || 'Unknown');
    appendInfoRow('Save mode', browser.canDirectSave ? 'Direct folder save' : 'Zip download');
    appendInfoRow('Script', (state.entries ? state.entries.length : 0) + ' lines loaded from ' + (state.scriptName || ''));

    setup.appendChild(card);

    if (!state.storageAvailable) {
      var storageWarning = doc.createElement('p');
      storageWarning.style.cssText = 'font-size:0.875rem;color:var(--danger);background:rgba(196,92,92,0.08);border:1px solid rgba(196,92,92,0.3);border-radius:6px;padding:0.875rem 1.25rem;width:100%;line-height:1.6;text-align:left;font-family:var(--font-ui);';
      storageWarning.textContent = 'Session saving is not available in this browser when opened as a local file. Your progress will not be saved between page reloads.';
      setup.appendChild(storageWarning);
    }

    var savingSection = doc.createElement('div');
    savingSection.className = 'setup__saving';

    var beginBtn = doc.createElement('button');
    beginBtn.type = 'button';
    beginBtn.className = 'btn-begin';
    beginBtn.textContent = 'Begin Recording';
    beginBtn.style.display = 'none';
    beginBtn.addEventListener('click', function () {
      if (typeof options.onBeginRecording === 'function') {
        options.onBeginRecording();
      }
    });

    if (browser.canDirectSave) {
      var chooseFolderBtn = doc.createElement('button');
      chooseFolderBtn.type = 'button';
      chooseFolderBtn.className = 'btn-choose-folder';
      chooseFolderBtn.textContent = restoredHandle ? 'Folder: ' + restoredHandle.name : 'Choose Output Folder';

      function applySelectedHandle(handle) {
        if (!handle) return;
        chooseFolderBtn.textContent = 'Folder: ' + handle.name;
        chooseFolderBtn.classList.add('btn-choose-folder--selected');
        beginBtn.style.display = '';
      }

      if (restoredHandle) {
        chooseFolderBtn.classList.add('btn-choose-folder--selected');
        beginBtn.style.display = '';
      }

      chooseFolderBtn.addEventListener('click', function () {
        if (typeof options.onChooseFolder !== 'function') return;
        var result = options.onChooseFolder();
        if (result && typeof result.then === 'function') {
          result.then(applySelectedHandle);
        } else {
          applySelectedHandle(result);
        }
      });

      savingSection.appendChild(chooseFolderBtn);
    } else {
      var zipNotice = doc.createElement('p');
      zipNotice.className = 'setup__notice';
      if (browser.name !== 'Unknown') {
        zipNotice.textContent = 'Your browser (' + browser.name + ") doesn't support direct folder saving. Recordings will be bundled as a zip download.";
      } else {
        zipNotice.textContent = 'Could not detect your browser. Some features may not work as expected. For the best experience, use Chrome or Edge.';
      }
      savingSection.appendChild(zipNotice);
      beginBtn.style.display = '';
    }

    savingSection.appendChild(beginBtn);
    setup.appendChild(savingSection);
    container.appendChild(setup);
    return { root: setup, beginButton: beginBtn, chooseFolderButton: browser.canDirectSave ? savingSection.querySelector('.btn-choose-folder') : null };
  }

  function renderResumeModal(doc, options) {
    doc = getDocument(doc);
    options = options || {};
    var overlay = doc.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(28,25,23,0.92);display:flex;align-items:center;justify-content:center;z-index:9999;padding:2rem;';

    var modal = doc.createElement('div');
    modal.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;padding:2rem;max-width:420px;width:100%;display:flex;flex-direction:column;gap:1.25rem;';

    var title = doc.createElement('h2');
    title.style.cssText = 'font-size:1.25rem;font-weight:700;color:var(--text-primary);margin:0;';
    title.textContent = 'Resume Session?';
    modal.appendChild(title);

    var msg = doc.createElement('p');
    msg.style.cssText = 'font-size:0.95rem;color:var(--text-secondary);line-height:1.6;margin:0;';
    msg.textContent = 'You have a session in progress (' + options.doneCount + ' / ' + options.total + ' complete). Resume or Start Over?';
    modal.appendChild(msg);

    var btnRow = doc.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end;flex-wrap:wrap;';

    function closeOverlay() {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }

    var startOverBtn = doc.createElement('button');
    startOverBtn.type = 'button';
    startOverBtn.style.cssText = 'font-family:var(--font-ui);font-size:0.9rem;font-weight:600;padding:0.6rem 1.2rem;border-radius:6px;cursor:pointer;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);';
    startOverBtn.textContent = 'Start Over';
    startOverBtn.addEventListener('click', function () {
      closeOverlay();
      if (typeof options.onStartOver === 'function') {
        options.onStartOver();
      }
    });
    btnRow.appendChild(startOverBtn);

    var resumeBtn = doc.createElement('button');
    resumeBtn.type = 'button';
    resumeBtn.style.cssText = 'font-family:var(--font-ui);font-size:0.9rem;font-weight:600;padding:0.6rem 1.2rem;border-radius:6px;cursor:pointer;background:var(--accent-primary);color:#1c1917;border:none;';
    resumeBtn.textContent = 'Resume';
    resumeBtn.addEventListener('click', function () {
      closeOverlay();
      if (typeof options.onResume === 'function') {
        options.onResume();
      }
    });
    btnRow.appendChild(resumeBtn);

    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    doc.body.appendChild(overlay);
    return { overlay: overlay, startOverButton: startOverBtn, resumeButton: resumeBtn };
  }

  function renderRecordingShell(container) {
    var doc = getDocument(container);
    clearChildren(container);

    var screen = doc.createElement('div');
    screen.className = 'recording-screen';

    var progressBar = doc.createElement('div');
    progressBar.className = 'progress-bar';
    var progressFill = doc.createElement('div');
    progressFill.className = 'progress-bar__fill';
    progressBar.appendChild(progressFill);
    screen.appendChild(progressBar);

    var panels = doc.createElement('div');
    panels.className = 'recording-screen__panels';

    var sidebar = doc.createElement('div');
    sidebar.className = 'sidebar';
    panels.appendChild(sidebar);

    var mainPanel = doc.createElement('div');
    mainPanel.className = 'main-panel';

    var zipControls = doc.createElement('div');
    zipControls.className = 'zip-controls';
    mainPanel.appendChild(zipControls);

    var mainArea = doc.createElement('div');
    mainArea.className = 'main-area';
    mainPanel.appendChild(mainArea);

    panels.appendChild(mainPanel);
    screen.appendChild(panels);
    container.appendChild(screen);

    return {
      root: screen,
      progressBar: progressBar,
      progressFill: progressFill,
      sidebar: sidebar,
      zipControls: zipControls,
      mainArea: mainArea
    };
  }

  function renderSidebar(sidebar, options) {
    options = options || {};
    var doc = getDocument(sidebar);
    var state = options.state || {};
    clearChildren(sidebar);

    var entries = state.entries || [];
    entries.forEach(function (entry, idx) {
      var item = doc.createElement('div');
      item.className = 'sidebar-item';
      if (state.needsRerecord && state.needsRerecord.has(idx)) {
        item.classList.add('needs-rerecord');
      } else if (state.completedLines && state.completedLines.has(idx)) {
        item.classList.add('completed');
      }
      if (idx === state.currentIndex) {
        item.classList.add('active');
      }
      item.textContent = entry.filename;
      item.addEventListener('click', function () {
        if (typeof options.onSelectLine === 'function') {
          options.onSelectLine(idx);
        }
      });
      sidebar.appendChild(item);
    });

    if (options.progressFill) {
      var total = entries.length || 0;
      var completed = state.completedLines ? state.completedLines.size : 0;
      options.progressFill.style.width = total === 0 ? '0%' : (completed / total * 100) + '%';
    }

    var activeItem = sidebar.querySelector('.sidebar-item.active');
    if (activeItem && typeof activeItem.scrollIntoView === 'function') {
      activeItem.scrollIntoView({ block: 'nearest' });
    }

    return sidebar;
  }

  function renderMainArea(mainArea, options) {
    options = options || {};
    var doc = getDocument(mainArea);
    var state = options.state || {};
    clearChildren(mainArea);

    var entry = state.entries ? state.entries[state.currentIndex] : null;
    var total = state.entries ? state.entries.length : 0;

    if (state.recordingState === 'recording') {
      mainArea.style.backgroundColor = 'rgba(196, 92, 92, 0.07)';
      mainArea.style.transition = 'background-color 0.2s ease';
    } else {
      mainArea.style.backgroundColor = '';
      mainArea.style.transition = 'background-color 0.2s ease';
    }

    var progress = doc.createElement('p');
    progress.className = 'progress';
    progress.textContent = (state.currentIndex + 1) + ' / ' + total;
    mainArea.appendChild(progress);

    var lineText = doc.createElement('p');
    lineText.className = 'line-text';
    lineText.textContent = entry ? entry.text : '';
    mainArea.appendChild(lineText);

    var fileLabel = doc.createElement('p');
    fileLabel.className = 'file-label';
    fileLabel.textContent = entry ? entry.filename : '';
    mainArea.appendChild(fileLabel);

    var displayName = doc.createElement('p');
    displayName.className = 'display-name';
    displayName.textContent = entry ? entry.displayName : '';
    mainArea.appendChild(displayName);

    var recordPrompt = doc.createElement('p');
    recordPrompt.className = 'record-prompt';
    if (state.recordingState === 'recording') {
      var dot = doc.createElement('span');
      dot.className = 'recording-dot';
      recordPrompt.appendChild(dot);
      recordPrompt.appendChild(doc.createTextNode('Recording…'));
      var timer = doc.createElement('span');
      timer.className = 'recording-timer';
      timer.textContent = '0:00';
      recordPrompt.appendChild(timer);
    } else if (state.recordingState === 'saving') {
      recordPrompt.textContent = 'Saving recording…';
    } else if (state.recordingState === 'review') {
      recordPrompt.textContent = 'Recording complete — listen, keep, or retry:';
    } else {
      recordPrompt.textContent = 'Hold SPACE to record';
    }
    mainArea.appendChild(recordPrompt);

    if (state.recordingState === 'recording') {
      var levelMeter = doc.createElement('div');
      levelMeter.className = 'level-meter';
      var levelFill = doc.createElement('div');
      levelFill.className = 'level-meter__fill';
      levelMeter.appendChild(levelFill);
      mainArea.appendChild(levelMeter);
    }

    if (state.uiMessage) {
      var statusMessage = doc.createElement('p');
      statusMessage.className = 'status-message';
      statusMessage.textContent = state.uiMessage;
      mainArea.appendChild(statusMessage);
    }

    if (state.recordingState === 'review') {
      var reviewActions = doc.createElement('div');
      reviewActions.className = 'review-actions';

      var playBtn = doc.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'btn-play';
      playBtn.textContent = 'Play (P)';
      playBtn.addEventListener('click', function () {
        if (typeof options.onPlay === 'function') options.onPlay();
      });
      reviewActions.appendChild(playBtn);

      var keepBtn = doc.createElement('button');
      keepBtn.type = 'button';
      keepBtn.className = 'btn-keep';
      keepBtn.textContent = 'Keep (Enter)';
      keepBtn.addEventListener('click', function () {
        if (typeof options.onKeep === 'function') options.onKeep();
      });
      reviewActions.appendChild(keepBtn);

      var retryBtn = doc.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn-retry';
      retryBtn.textContent = 'Retry (R)';
      retryBtn.addEventListener('click', function () {
        if (typeof options.onRetry === 'function') options.onRetry();
      });
      reviewActions.appendChild(retryBtn);

      mainArea.appendChild(reviewActions);
    }

    var footer = doc.createElement('p');
    footer.className = 'shortcuts-footer';
    footer.textContent = 'SPACE record | P play | ENTER keep | R retry';
    mainArea.appendChild(footer);

    return mainArea;
  }

  function renderZipDownloadButton(zipControls, options) {
    options = options || {};
    var doc = getDocument(zipControls);
    var existing = zipControls.querySelector('#zip-download-btn');
    if (!options.count) {
      if (existing) existing.remove();
      return null;
    }
    if (!existing) {
      existing = doc.createElement('button');
      existing.id = 'zip-download-btn';
      existing.className = 'btn-zip-download';
      existing.addEventListener('click', function () {
        if (typeof options.onDownloadZip === 'function') {
          options.onDownloadZip();
        }
      });
      zipControls.appendChild(existing);
    }
    existing.textContent = 'Download All (' + options.count + ' files)';
    return existing;
  }

  function renderZipReloadNotice(doc, options) {
    doc = getDocument(doc);
    options = options || {};
    var noticeBar = doc.createElement('div');
    noticeBar.id = 'zip-reload-notice';
    noticeBar.style.cssText = 'position:fixed;top:0;left:0;right:0;background:var(--warning);color:var(--warning-text);font-size:0.85rem;padding:0.55rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;z-index:50;font-family:var(--font-ui);';

    var noticeText = doc.createElement('span');
    noticeText.textContent = 'Your browser uses zip download mode. If you reload the page, you\u2019ll need to re-record any lines from this session. Use \u2018Download All\u2019 frequently to save your progress.';
    noticeBar.appendChild(noticeText);

    var dismissBtn = doc.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.style.cssText = 'background:none;border:none;color:var(--warning-text);cursor:pointer;font-size:1rem;padding:0 0.25rem;flex-shrink:0;';
    dismissBtn.textContent = '\u00D7';
    dismissBtn.setAttribute('aria-label', 'Dismiss notice');
    dismissBtn.addEventListener('click', function () {
      if (noticeBar.parentNode) noticeBar.parentNode.removeChild(noticeBar);
      if (typeof options.onDismiss === 'function') {
        options.onDismiss();
      }
    });
    noticeBar.appendChild(dismissBtn);
    doc.body.appendChild(noticeBar);
    return noticeBar;
  }

  function renderCompletionScreen(container, options) {
    options = options || {};
    var doc = getDocument(container);
    clearChildren(container);

    var completion = doc.createElement('div');
    completion.className = 'completion';

    var heading = doc.createElement('h1');
    heading.textContent = 'All Done!';
    completion.appendChild(heading);

    var msg = doc.createElement('p');
    msg.textContent = 'All ' + options.total + ' lines have been recorded.';
    completion.appendChild(msg);

    if (!options.canDirectSave) {
      var zipBtn = doc.createElement('button');
      zipBtn.type = 'button';
      zipBtn.className = 'btn-begin';
      zipBtn.style.marginBottom = '1rem';
      zipBtn.textContent = 'Download All Recordings (ZIP)';
      zipBtn.addEventListener('click', function () {
        if (typeof options.onDownloadZip === 'function') {
          options.onDownloadZip();
        }
      });
      completion.appendChild(zipBtn);
    }

    var restartBtn = doc.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'btn-choose-folder';
    restartBtn.textContent = 'Start New Session';
    restartBtn.addEventListener('click', function () {
      if (typeof options.onStartNewSession === 'function') {
        options.onStartNewSession();
      }
    });
    completion.appendChild(restartBtn);

    container.appendChild(completion);
    return { root: completion };
  }

  var api = {
    buildFolderIcon: buildFolderIcon,
    buildMicIcon: buildMicIcon,
    clearChildren: clearChildren,
    createSvgEl: createSvgEl,
    renderCompletionScreen: renderCompletionScreen,
    renderLanding: renderLanding,
    renderMainArea: renderMainArea,
    renderRecordingShell: renderRecordingShell,
    renderResumeModal: renderResumeModal,
    renderSetupScreen: renderSetupScreen,
    renderSidebar: renderSidebar,
    renderZipDownloadButton: renderZipDownloadButton,
    renderZipReloadNotice: renderZipReloadNotice,
    showLandingError: showLandingError,
    showMicError: showMicError
  };

  global.VoiceLineRecorderUI = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
}(typeof window !== 'undefined' ? window : globalThis));
