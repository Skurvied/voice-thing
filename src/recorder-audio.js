(function (global) {
  'use strict';

  function getWindow(options) {
    return (options && options.window) || global;
  }

  function getDocument(options) {
    if (options && options.document) return options.document;
    var win = getWindow(options);
    return win.document || null;
  }

  function mergeFloat32Chunks(chunks) {
    var length = 0;
    for (var i = 0; i < chunks.length; i++) {
      length += chunks[i].length;
    }

    var merged = new Float32Array(length);
    var offset = 0;
    for (var j = 0; j < chunks.length; j++) {
      merged.set(chunks[j], offset);
      offset += chunks[j].length;
    }

    return merged;
  }

  function createAudioController(options) {
    options = options || {};

    var win = getWindow(options);
    var doc = getDocument(options);
    var state = options.state;
    var encodeWAV = options.encodeWAV;

    if (!state) {
      throw new Error('state is required');
    }
    if (typeof encodeWAV !== 'function') {
      throw new Error('encodeWAV is required');
    }

    var onSetUiMessage = typeof options.onSetUiMessage === 'function' ? options.onSetUiMessage : function () {};
    var onRenderMainArea = typeof options.onRenderMainArea === 'function' ? options.onRenderMainArea : function () {};
    var onShowMicError = typeof options.onShowMicError === 'function' ? options.onShowMicError : function () {};
    var sampleRate = options.sampleRate || 44100;
    var BlobCtor = win.Blob || global.Blob;
    var AudioCtor = win.Audio || global.Audio;
    var requestAnimationFrame = typeof win.requestAnimationFrame === 'function'
      ? win.requestAnimationFrame.bind(win)
      : function (callback) {
        return setTimeout(callback, 16);
      };
    var cancelAnimationFrame = typeof win.cancelAnimationFrame === 'function'
      ? win.cancelAnimationFrame.bind(win)
      : function (id) {
        clearTimeout(id);
      };
    var setIntervalFn = typeof win.setInterval === 'function' ? win.setInterval.bind(win) : setInterval;
    var clearIntervalFn = typeof win.clearInterval === 'function' ? win.clearInterval.bind(win) : clearInterval;
    var createObjectURL = win.URL && typeof win.URL.createObjectURL === 'function'
      ? win.URL.createObjectURL.bind(win.URL)
      : (global.URL && typeof global.URL.createObjectURL === 'function' ? global.URL.createObjectURL.bind(global.URL) : null);
    var revokeObjectURL = win.URL && typeof win.URL.revokeObjectURL === 'function'
      ? win.URL.revokeObjectURL.bind(win.URL)
      : (global.URL && typeof global.URL.revokeObjectURL === 'function' ? global.URL.revokeObjectURL.bind(global.URL) : function () {});

    var recordingChunks = [];
    var isRecording = false;
    var processorNode = null;
    var sourceNode = null;

    function updateLevelMeter() {
      if (!isRecording || !state.analyser) return;

      var data = new Uint8Array(state.analyser.fftSize);
      state.analyser.getByteTimeDomainData(data);
      var sum = 0;
      for (var i = 0; i < data.length; i++) {
        var v = (data[i] - 128) / 128;
        sum += v * v;
      }

      var rms = Math.sqrt(sum / data.length);
      var level = Math.min(1, rms * 3);
      if (doc && typeof doc.querySelector === 'function') {
        var meter = doc.querySelector('.level-meter__fill');
        if (meter) meter.style.width = (level * 100) + '%';
      }

      state.levelAnimFrame = requestAnimationFrame(updateLevelMeter);
    }

    async function initMicrophone() {
      try {
        state.micStream = await win.navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: sampleRate, channelCount: 1, echoCancellation: false }
        });
        state.audioCtx = new (win.AudioContext || win.webkitAudioContext)({ sampleRate: sampleRate });
        onSetUiMessage('');
      } catch (err) {
        var msg = 'Microphone error: ' + err.message;
        if (err.name === 'NotAllowedError') msg = 'Microphone access denied. Please allow microphone access in your browser settings and reload.';
        else if (err.name === 'NotFoundError') msg = 'No microphone found. Please connect a microphone and reload.';
        else if (err.name === 'NotReadableError') msg = 'Microphone is in use by another application. Close it and reload.';
        onShowMicError(msg);
      }
    }

    function startRecording() {
      if (!state.audioCtx || !state.micStream) {
        onSetUiMessage('Microphone not ready yet. Allow access and wait a moment before recording.');
        onRenderMainArea();
        return;
      }

      recordingChunks = [];
      isRecording = true;
      state.recordingState = 'recording';
      onSetUiMessage('');

      sourceNode = state.audioCtx.createMediaStreamSource(state.micStream);
      processorNode = state.audioCtx.createScriptProcessor(4096, 1, 1);
      processorNode.onaudioprocess = function (event) {
        if (!isRecording) return;
        var data = event.inputBuffer.getChannelData(0);
        recordingChunks.push(new Float32Array(data));
      };
      sourceNode.connect(processorNode);
      processorNode.connect(state.audioCtx.destination);

      state.analyser = state.audioCtx.createAnalyser();
      state.analyser.fftSize = 256;
      sourceNode.connect(state.analyser);
      state.levelAnimFrame = requestAnimationFrame(updateLevelMeter);

      state.recordingStartTime = Date.now();
      state.recordingTimer = setIntervalFn(function () {
        var elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
        var mins = Math.floor(elapsed / 60);
        var secs = elapsed % 60;
        if (doc && typeof doc.querySelector === 'function') {
          var timerEl = doc.querySelector('.recording-timer');
          if (timerEl) timerEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
        }
      }, 250);

      onRenderMainArea();
    }

    function stopRecording() {
      isRecording = false;

      if (state.recordingTimer) {
        clearIntervalFn(state.recordingTimer);
        state.recordingTimer = null;
      }
      if (state.levelAnimFrame) {
        cancelAnimationFrame(state.levelAnimFrame);
        state.levelAnimFrame = null;
      }
      if (state.analyser) {
        state.analyser.disconnect();
        state.analyser = null;
      }
      if (processorNode) {
        processorNode.disconnect();
        processorNode = null;
      }
      if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
      }

      state.currentRecording = mergeFloat32Chunks(recordingChunks);
      state.recordingState = 'review';
      onRenderMainArea();
    }

    function playRecording() {
      if (!state.currentRecording) return;

      var wavBuffer = encodeWAV(state.currentRecording, sampleRate);
      var blob = new BlobCtor([wavBuffer], { type: 'audio/wav' });
      var url = createObjectURL(blob);
      if (state.playbackAudio) {
        state.playbackAudio.pause();
        revokeObjectURL(state.playbackAudio.src);
      }
      state.playbackAudio = new AudioCtor(url);
      state.playbackAudio.play();
    }

    return {
      initMicrophone: initMicrophone,
      playRecording: playRecording,
      startRecording: startRecording,
      stopRecording: stopRecording
    };
  }

  var api = {
    createAudioController: createAudioController,
    mergeFloat32Chunks: mergeFloat32Chunks
  };

  global.VoiceLineRecorderAudio = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
}(typeof window !== 'undefined' ? window : globalThis));
