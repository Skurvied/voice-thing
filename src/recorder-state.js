(function (global) {
  'use strict';

  function createInitialState() {
    return {
      entries: [],
      scriptName: '',
      currentIndex: 0,
      completedLines: new Set(),
      needsRerecord: new Set(),
      screen: 'landing',
      browser: null,
      dirHandle: null,
      recordingState: 'idle',
      micStream: null,
      audioCtx: null,
      currentRecording: null,
      modalOpen: false,
      playbackAudio: null,
      zipEntries: new Map(),
      storageAvailable: false,
      sessionKey: '',
      uiMessage: '',
      recordingStartTime: null,
      recordingTimer: null,
      analyser: null,
      levelAnimFrame: null
    };
  }

  function resetRecordingState(state) {
    state.currentRecording = null;
    state.recordingState = 'idle';
    state.recordingStartTime = null;
    state.recordingTimer = null;
    state.analyser = null;
    state.levelAnimFrame = null;
  }

  function resetSessionProgress(state) {
    state.completedLines.clear();
    state.needsRerecord.clear();
    state.currentIndex = 0;
    state.zipEntries.clear();
    resetRecordingState(state);
  }

  function resetForLanding(state) {
    resetSessionProgress(state);
    state.entries = [];
    state.scriptName = '';
    state.sessionKey = '';
    state.dirHandle = null;
    state.micStream = null;
    state.audioCtx = null;
    state.modalOpen = false;
    state.playbackAudio = null;
    state.browser = null;
    state.uiMessage = '';
  }

  var api = {
    createInitialState: createInitialState,
    resetForLanding: resetForLanding,
    resetRecordingState: resetRecordingState,
    resetSessionProgress: resetSessionProgress
  };

  global.VoiceLineRecorderState = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
}(typeof window !== 'undefined' ? window : globalThis));
