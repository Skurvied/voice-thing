    (function () {
      'use strict';

      var core = window.VoiceLineRecorderCore;
      if (!core) {
        throw new Error('VoiceLineRecorderCore is required before loading recorder-app.js');
      }

      var detectBrowser = core.detectBrowser;
      var parseScript = core.parseScript;
      var encodeWAV = core.encodeWAV;
      var buildZip = core.buildZip;
      var getSessionKey = core.getSessionKey;
      var checkStorageAvailable = core.checkStorageAvailable;
      var uiModule = window.VoiceLineRecorderUI;
      if (!uiModule) {
        throw new Error('VoiceLineRecorderUI is required before loading recorder-app.js');
      }
      var audioModule = window.VoiceLineRecorderAudio;
      if (!audioModule) {
        throw new Error('VoiceLineRecorderAudio is required before loading recorder-app.js');
      }
      var persistenceModule = window.VoiceLineRecorderPersistence;
      if (!persistenceModule) {
        throw new Error('VoiceLineRecorderPersistence is required before loading recorder-app.js');
      }
      var persistence = persistenceModule.createPersistence(window);
      var stateModule = window.VoiceLineRecorderState;
      if (!stateModule) {
        throw new Error('VoiceLineRecorderState is required before loading recorder-app.js');
      }

      // ── App state ─────────────────────────────────────────────────────────────

      var state = stateModule.createInitialState();
      var audioController = audioModule.createAudioController({
        window: window,
        document: document,
        state: state,
        encodeWAV: encodeWAV,
        onSetUiMessage: setUiMessage,
        onRenderMainArea: function () {
          renderMainArea();
        },
        onShowMicError: function (msg) {
          uiModule.showMicError(document, msg);
        }
      });

      // ── UI helpers ────────────────────────────────────────────────────────────

      /**
       * Display an error message on the landing screen.
       * Finds or creates a dedicated error paragraph and sets its text safely.
       * @param {string} msg
       */
      function showError(msg) {
        uiModule.showLandingError(document.getElementById('app'), msg);
      }

      function setUiMessage(msg) {
        state.uiMessage = msg || '';
      }

      async function canReuseDirectoryHandle(handle) {
        if (!handle) return false;
        if (typeof handle.queryPermission !== 'function') return true;

        try {
          return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
        } catch (error) {
          return false;
        }
      }

      async function restorePersistedDirectoryHandle() {
        if (!state.browser || !state.browser.canDirectSave) return null;

        var saved = await persistence.loadPersistedDirectoryHandle(state.sessionKey);
        if (!saved || !saved.handle) return null;

        if (!(await canReuseDirectoryHandle(saved.handle))) {
          return null;
        }

        state.dirHandle = saved.handle;
        return saved.handle;
      }

      /**
       * Show a resume modal when a saved session is found.
       * @param {{ currentIndex: number, completedLines: number[] }} session
       */
      function showResumeModal(session) {
        state.modalOpen = true;
        uiModule.renderResumeModal(document, {
          total: state.entries.length,
          doneCount: session.completedLines.length,
          onStartOver: async function () {
            persistence.clearSession(state.sessionKey);
            await persistence.clearPersistedDirectoryHandle(state.sessionKey);
            stateModule.resetSessionProgress(state);
            state.modalOpen = false;
            await showSetupScreen().catch(function () {});
          },
          onResume: function () {
            state.currentIndex = session.currentIndex;
            state.completedLines = new Set(session.completedLines);
            state.needsRerecord = new Set();
            setUiMessage('');
            var browser = detectBrowser();
            state.browser = browser;
            if (!browser.canDirectSave) {
              state.completedLines = new Set();
              session.completedLines.forEach(function (idx) {
                state.needsRerecord.add(idx);
              });
            }
            state.modalOpen = false;
            showSetupScreen().catch(function () {});
          }
        });
      }

      /**
       * Render the setup screen into the #app container.
       * Detects browser capabilities and lets the user choose an output folder
       * (direct save) or acknowledges zip-download mode before proceeding.
       */
      async function showSetupScreen() {
        var browser = detectBrowser();
        state.browser = browser;
        state.screen = 'setup';
        setUiMessage('');
        if (!browser.canDirectSave) {
          state.dirHandle = null;
        }

        var app = document.getElementById('app');
        var restoredHandle = await restorePersistedDirectoryHandle();

        uiModule.renderSetupScreen(app, {
          browser: browser,
          state: state,
          restoredHandle: restoredHandle,
          onChooseFolder: function () {
            return window.showDirectoryPicker({ mode: 'readwrite' })
              .then(function (handle) {
                state.dirHandle = handle;
                persistence.persistDirectoryHandle(state.sessionKey, handle);
                return handle;
              })
              .catch(function (err) {
                if (err.name !== 'AbortError') {
                  console.error('showDirectoryPicker error:', err);
                  showError('Could not select the output folder. Please try again.');
                }
                return null;
              });
          },
          onBeginRecording: function () {
            showRecordingScreen();
          }
        });
      }

      function renderLanding() {
        var app = document.getElementById('app');
        uiModule.renderLanding(app, {
          onLoadScript: function (file) {
            var reader = new FileReader();
            reader.onload = function (e) {
              try {
                var entries = parseScript(e.target.result);
                state.entries = entries;
                state.scriptName = file.name;
                state.storageAvailable = checkStorageAvailable();
                state.sessionKey = getSessionKey(state.scriptName, state.entries);
                var session = loadSession();
                if (session) {
                  showResumeModal(session);
                } else {
                  showSetupScreen().catch(function (err) {
                    console.error('Failed to render setup screen:', err);
                    showError('Failed to prepare the setup screen. Please try again.');
                  });
                }
              } catch (err) {
                showError(err.message);
              }
            };
            reader.onerror = function () {
              showError('Failed to read file. Please try again.');
            };
            reader.readAsText(file);
          }
        });
      }

      // ── Microphone ───────────────────────────────────────────────────────────

      var initMicrophone = audioController.initMicrophone;
      var startRecording = audioController.startRecording;
      var stopRecording = audioController.stopRecording;

      function renderSidebar() {
        var sidebar = document.querySelector('.sidebar');
        if (!sidebar) return;
        uiModule.renderSidebar(sidebar, {
          state: state,
          progressFill: document.querySelector('.progress-bar__fill'),
          onSelectLine: function (idx) {
            state.currentIndex = idx;
            renderSidebar();
            renderMainArea();
          }
        });
      }

      function renderMainArea() {
        var mainArea = document.querySelector('.main-area');
        if (!mainArea) return;
        uiModule.renderMainArea(mainArea, {
          state: state,
          onPlay: playRecording,
          onKeep: keepRecording,
          onRetry: retryRecording
        });
      }

      function updateZipButton() {
        var controls = document.querySelector('.zip-controls');
        if (!controls) return;
        uiModule.renderZipDownloadButton(controls, {
          count: state.zipEntries.size,
          onDownloadZip: downloadZip
        });
      }

      function showRecordingScreen() {
        state.screen = 'recording';
        state.recordingState = 'idle';

        var app = document.getElementById('app');
        app.style.display = 'block';
        app.style.padding = '0';
        app.style.minHeight = '';

        uiModule.renderRecordingShell(app);
        renderSidebar();
        renderMainArea();
        updateZipButton();

        if (!state.browser.canDirectSave && state.storageAvailable) {
          uiModule.renderZipReloadNotice(document, {
            onDismiss: function () {}
          });
        }

        initMicrophone();
      }

      // ── WAV Encoder ──────────────────────────────────────────────────────────

      // ── File Saving ───────────────────────────────────────────────────────────

      async function saveRecording(index, samples) {
        if (state.browser.canDirectSave && state.dirHandle) {
          return saveRecordingDirect(index, samples);
        }
        saveRecordingZip(index, samples);
        return true;
      }

      async function saveRecordingDirect(index, samples) {
        var entry = state.entries[index];
        var wavBuffer = encodeWAV(samples, 44100);
        try {
          var fileHandle = await state.dirHandle.getFileHandle(entry.filename, { create: true });
          var writable = await fileHandle.createWritable();
          await writable.write(wavBuffer);
          await writable.close();
          return true;
        } catch (err) {
          console.error('Failed to save file:', err);
          return false;
        }
      }

      function saveRecordingZip(index, samples) {
        var entry = state.entries[index];
        var wavBuffer = encodeWAV(samples, 44100);
        state.zipEntries.set(entry.filename, wavBuffer);
        updateZipButton();
      }

      function downloadZip() {
        if (state.zipEntries.size === 0) return;
        var blob = buildZip(state.zipEntries);
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'recordings.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      function saveSession() {
        if (!state.storageAvailable) return;
        var data = {
          currentIndex: state.currentIndex,
          completedLines: Array.from(state.completedLines),
        };
        persistence.saveSession(state.sessionKey, data);
      }

      function loadSession() {
        if (!state.storageAvailable) return null;
        return persistence.loadSession(state.sessionKey);
      }

      function showCompletionScreen() {
        state.screen = 'complete';
        var app = document.getElementById('app');
        app.style.display = '';
        app.style.padding = '';
        app.style.minHeight = '';
        uiModule.renderCompletionScreen(app, {
          total: state.entries.length,
          canDirectSave: state.browser.canDirectSave,
          onDownloadZip: downloadZip,
          onStartNewSession: clearSessionAndRestart
        });
      }

      function clearSessionAndRestart() {
        if (state.storageAvailable) {
          persistence.clearSession(state.sessionKey);
        }
        persistence.clearPersistedDirectoryHandle(state.sessionKey);
        stateModule.resetSessionProgress(state);
        state.screen = 'landing';
        // Remove any zip notice bars
        var notice = document.getElementById('zip-notice');
        if (notice) notice.remove();
        var reloadNotice = document.getElementById('zip-reload-notice');
        if (reloadNotice) reloadNotice.remove();
        showLandingScreen();
      }

      function showLandingScreen() {
        // Reset state for a fresh landing
        stateModule.resetForLanding(state);

        // Clear #app safely
        var app = document.getElementById('app');
        while (app.firstChild) {
          app.removeChild(app.firstChild);
        }

        // Restore default #app centering styles
        app.style.display = '';
        app.style.padding = '';
        app.style.minHeight = '';

        renderLanding();
      }

      // ── Review state controls ─────────────────────────────────────────────────

      var playRecording = audioController.playRecording;

      async function keepRecording() {
        if (state.recordingState !== 'review' || !state.currentRecording) return;
        state.recordingState = 'saving';
        setUiMessage('');
        renderMainArea();
        var saveSucceeded = await saveRecording(state.currentIndex, state.currentRecording);
        if (!saveSucceeded) {
          state.recordingState = 'review';
          setUiMessage('Saving failed. Check the destination folder and try again.');
          renderMainArea();
          return;
        }
        state.completedLines.add(state.currentIndex);
        state.needsRerecord.delete(state.currentIndex);
        state.currentRecording = null;
        state.recordingState = 'idle';
        setUiMessage('');
        advanceToNext();
        saveSession();
        renderMainArea();
        renderSidebar();
      }

      function retryRecording() {
        stateModule.resetRecordingState(state);
        setUiMessage('');
        renderMainArea();
      }

      function advanceToNext() {
        var total = state.entries.length;
        for (var i = 1; i <= total; i++) {
          var idx = (state.currentIndex + i) % total;
          if (!state.completedLines.has(idx)) {
            state.currentIndex = idx;
            return;
          }
        }
        // All lines complete
        showCompletionScreen();
      }

      // ── Keyboard listeners ───────────────────────────────────────────────────

      document.addEventListener('keydown', function(e) {
        if (state.screen !== 'recording' || state.modalOpen) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (state.recordingState === 'review') {
          if (e.code === 'KeyP') { e.preventDefault(); playRecording(); }
          if (e.code === 'Enter') { e.preventDefault(); keepRecording(); }
          if (e.code === 'KeyR') { e.preventDefault(); retryRecording(); }
        }
        if (e.code === 'Space') {
          e.preventDefault();
          if (!e.repeat && state.recordingState === 'idle') startRecording();
        }
      });

      document.addEventListener('keyup', function(e) {
        if (state.screen !== 'recording' || state.modalOpen) return;
        if (e.code === 'Space') {
          e.preventDefault();
          if (state.recordingState === 'recording') stopRecording();
        }
      });

      // ── Init ─────────────────────────────────────────────────────────────────

      renderLanding();

    }());
