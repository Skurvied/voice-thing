const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT_DIR = path.join(__dirname, '..');
const HTML_PATH = path.join(ROOT_DIR, 'recorder.html');
const core = require(path.join(ROOT_DIR, 'src', 'recorder-core.js'));
const persistence = require(path.join(ROOT_DIR, 'src', 'recorder-persistence.js'));
const stateModule = require(path.join(ROOT_DIR, 'src', 'recorder-state.js'));
const ui = require(path.join(ROOT_DIR, 'src', 'recorder-ui.js'));
const audioModulePath = path.join(ROOT_DIR, 'src', 'recorder-audio.js');

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.classes = new Set();
  }

  setFromString(value) {
    this.classes = new Set(String(value || '').split(/\s+/).filter(Boolean));
    this.sync();
  }

  add(...tokens) {
    tokens.forEach((token) => this.classes.add(token));
    this.sync();
  }

  remove(...tokens) {
    tokens.forEach((token) => this.classes.delete(token));
    this.sync();
  }

  contains(token) {
    return this.classes.has(token);
  }

  sync() {
    this.element._className = Array.from(this.classes).join(' ');
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this._textContent = '';
    this._id = '';
    this._className = '';
    this.classList = new FakeClassList(this);
    this.value = '';
    this.files = null;
    this.type = '';
  }

  get id() {
    return this._id;
  }

  set id(value) {
    this._id = value || '';
    this.attributes.id = this._id;
  }

  get className() {
    return this._className;
  }

  set className(value) {
    this.classList.setFromString(value);
  }

  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this.children = [];
    this._textContent = String(value);
  }

  get firstChild() {
    return this.children[0] || null;
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index === -1) {
      throw new Error('Child not found');
    }
    this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  insertBefore(child, referenceNode) {
    if (!referenceNode) return this.appendChild(child);
    const index = this.children.indexOf(referenceNode);
    if (index === -1) {
      throw new Error('Reference node not found');
    }
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.children.splice(index, 0, child);
    return child;
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes[name] = stringValue;
    if (name === 'id') this.id = stringValue;
    if (name === 'class') this.className = stringValue;
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  click() {
    const handlers = this.listeners.click || [];
    handlers.forEach((handler) => handler({ target: this, preventDefault() {} }));
  }

  querySelector(selector) {
    return querySelectorFrom(this, selector, true);
  }

  querySelectorAll(selector) {
    return querySelectorFrom(this, selector, false);
  }

  scrollIntoView() {}

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement('body', this);
    this._listeners = {};
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createElementNS(_ns, tagName) {
    return this.createElement(tagName);
  }

  createTextNode(text) {
    const node = new FakeElement('#text', this);
    node.textContent = text;
    return node;
  }

  getElementById(id) {
    return findFirst(this.body, (node) => node.id === id);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  addEventListener(type, handler) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(handler);
  }
}

function findFirst(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children) {
    const found = findFirst(child, predicate);
    if (found) return found;
  }
  return null;
}

function findAll(root, predicate, matches = []) {
  if (predicate(root)) matches.push(root);
  for (const child of root.children) {
    findAll(child, predicate, matches);
  }
  return matches;
}

function matchesSelector(node, selector) {
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function querySelectorFrom(root, selector, firstOnly) {
  const selectors = selector.trim().split(/\s+/);
  const matches = [];

  function visit(node, depth) {
    if (matchesSelector(node, selectors[depth])) {
      if (depth === selectors.length - 1) {
        matches.push(node);
        if (firstOnly) return true;
      } else {
        for (const child of node.children) {
          if (visit(child, depth + 1) && firstOnly) return true;
        }
      }
    }
    for (const child of node.children) {
      if (visit(child, depth) && firstOnly) return true;
    }
    return false;
  }

  visit(root, 0);
  return firstOnly ? (matches[0] || null) : matches;
}

test('html shell references external stylesheet and app scripts', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');

  assert.match(html, /<link\s+rel="icon"\s+href="data:,"\s*>/i);
  assert.match(html, /<link\s+rel="stylesheet"\s+href="styles\/recorder\.css"\s*>/i);
  assert.match(html, /<script\s+src="src\/recorder-persistence\.js"><\/script>/i);
  assert.match(html, /<script\s+src="src\/recorder-core\.js"><\/script>/i);
  assert.match(html, /<script\s+src="src\/recorder-state\.js"><\/script>/i);
  assert.match(html, /<script\s+src="src\/recorder-ui\.js"><\/script>/i);
  assert.match(html, /<script\s+src="src\/recorder-audio\.js"><\/script>/i);
  assert.match(html, /<script\s+src="src\/recorder-app\.js"><\/script>/i);

  const persistenceIndex = html.indexOf('src/recorder-persistence.js');
  const coreIndex = html.indexOf('src/recorder-core.js');
  const stateIndex = html.indexOf('src/recorder-state.js');
  const uiIndex = html.indexOf('src/recorder-ui.js');
  const audioIndex = html.indexOf('src/recorder-audio.js');
  const appIndex = html.indexOf('src/recorder-app.js');

  assert.ok(persistenceIndex < coreIndex);
  assert.ok(coreIndex < stateIndex);
  assert.ok(stateIndex < uiIndex);
  assert.ok(uiIndex < audioIndex);
  assert.ok(audioIndex < appIndex);
});

test('modular assets exist on disk', () => {
  assert.equal(fs.existsSync(path.join(ROOT_DIR, 'styles', 'recorder.css')), true);
  assert.equal(fs.existsSync(path.join(ROOT_DIR, 'src', 'recorder-persistence.js')), true);
  assert.equal(fs.existsSync(path.join(ROOT_DIR, 'src', 'recorder-core.js')), true);
  assert.equal(fs.existsSync(path.join(ROOT_DIR, 'src', 'recorder-state.js')), true);
  assert.equal(fs.existsSync(path.join(ROOT_DIR, 'src', 'recorder-ui.js')), true);
  assert.equal(fs.existsSync(path.join(ROOT_DIR, 'src', 'recorder-audio.js')), true);
  assert.equal(fs.existsSync(path.join(ROOT_DIR, 'src', 'recorder-app.js')), true);
});

test('core parser rejects duplicate filenames', () => {
  assert.throws(
    () => core.parseScript('filename|text\na.wav|One\na.wav|Two\n'),
    /Duplicate filenames found: a\.wav/
  );
});

test('core WAV encoder emits a RIFF header', () => {
  const wav = core.encodeWAV(new Float32Array([0, 0.25, -0.25]), 44100);
  const bytes = Buffer.from(wav);

  assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(bytes.subarray(8, 12).toString('ascii'), 'WAVE');
});

test('persistence module loads directly in Node', () => {
  assert.equal(typeof persistence.createPersistence, 'function');
});

test('persistence module stores sessions and directory handles', async () => {
  const storage = new Map();
  const indexedDB = createFakeIndexedDB();
  const module = persistence.createPersistence({
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    indexedDB,
  });

  module.saveSession('session_key', { currentIndex: 2, completedLines: [0, 1] });
  assert.deepEqual(module.loadSession('session_key'), { currentIndex: 2, completedLines: [0, 1] });
  module.clearSession('session_key');
  assert.equal(module.loadSession('session_key'), null);

  const handle = {
    name: 'takes',
    async queryPermission() {
      return 'granted';
    },
  };

  await module.persistDirectoryHandle('session_key', handle);
  const saved = await module.loadPersistedDirectoryHandle('session_key');
  assert.equal(saved.handle, handle);
  assert.equal(saved.name, 'takes');
  await module.clearPersistedDirectoryHandle('session_key');
  assert.equal(await module.loadPersistedDirectoryHandle('session_key'), null);
});

test('state module loads directly in Node', () => {
  assert.equal(typeof stateModule.createInitialState, 'function');
});

test('state module creates and resets recorder state slices', () => {
  const state = stateModule.createInitialState();

  assert.equal(state.screen, 'landing');
  assert.deepEqual(state.entries, []);
  assert.equal(state.completedLines instanceof Set, true);
  assert.equal(state.zipEntries instanceof Map, true);

  state.entries = [{ filename: 'one.wav', text: 'One', displayName: 'one' }];
  state.scriptName = 'script.txt';
  state.sessionKey = 'session_key';
  state.completedLines.add(0);
  state.needsRerecord.add(1);
  state.currentIndex = 2;
  state.zipEntries.set('one.wav', new ArrayBuffer(8));
  state.currentRecording = new Float32Array([0.25]);
  state.recordingState = 'review';
  state.recordingStartTime = 123;
  state.recordingTimer = { id: 1 };
  state.analyser = { id: 'analyser' };
  state.levelAnimFrame = 42;
  state.dirHandle = { name: 'takes' };
  state.browser = { canDirectSave: true };
  state.modalOpen = true;
  state.playbackAudio = { id: 'audio' };
  state.uiMessage = 'Saved';

  stateModule.resetRecordingState(state);
  assert.equal(state.currentRecording, null);
  assert.equal(state.recordingState, 'idle');
  assert.equal(state.recordingStartTime, null);
  assert.equal(state.recordingTimer, null);
  assert.equal(state.analyser, null);
  assert.equal(state.levelAnimFrame, null);

  state.currentRecording = new Float32Array([0.5]);
  state.recordingState = 'review';
  state.zipEntries.set('two.wav', new ArrayBuffer(4));
  stateModule.resetSessionProgress(state);
  assert.equal(state.currentIndex, 0);
  assert.deepEqual(Array.from(state.completedLines), []);
  assert.deepEqual(Array.from(state.needsRerecord), []);
  assert.equal(state.zipEntries.size, 0);
  assert.equal(state.currentRecording, null);
  assert.equal(state.recordingState, 'idle');

  stateModule.resetForLanding(state);
  assert.deepEqual(state.entries, []);
  assert.equal(state.scriptName, '');
  assert.equal(state.sessionKey, '');
  assert.equal(state.dirHandle, null);
  assert.equal(state.browser, null);
  assert.equal(state.modalOpen, false);
  assert.equal(state.playbackAudio, null);
  assert.equal(state.uiMessage, '');
});

test('audio module loads directly in Node', () => {
  const audio = require(audioModulePath);

  assert.equal(typeof audio.createAudioController, 'function');
});

test('audio controller manages microphone and recording lifecycle', async () => {
  const audio = require(audioModulePath);
  const state = stateModule.createInitialState();
  const events = {
    messages: [],
    renders: 0,
    micErrors: [],
  };
  let processorNode = null;
  const rafCallbacks = new Map();
  const document = new FakeDocument();
  const meter = document.createElement('div');
  meter.className = 'level-meter__fill';
  document.body.appendChild(meter);
  const window = {
    navigator: {
      mediaDevices: {
        getUserMedia: async () => ({ id: 'stream' }),
      },
    },
    AudioContext: class {
      constructor() {
        this.destination = { id: 'destination' };
      }

      createMediaStreamSource(stream) {
        return {
          stream,
          connect() {},
          disconnect() {},
        };
      }

      createScriptProcessor() {
        processorNode = {
          onaudioprocess: null,
          connect() {},
          disconnect() {},
        };
        return processorNode;
      }

      createAnalyser() {
        return {
          fftSize: 0,
          disconnect() {},
          getByteTimeDomainData(array) {
            array.fill(128);
          },
        };
      }
    },
    requestAnimationFrame(callback) {
      const id = rafCallbacks.size + 1;
      rafCallbacks.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      rafCallbacks.delete(id);
    },
    URL: {
      createObjectURL() {
        return 'blob:test';
      },
      revokeObjectURL() {},
    },
    Audio: class {
      constructor(src) {
        this.src = src;
        this.played = false;
        this.paused = false;
      }

      play() {
        this.played = true;
      }

      pause() {
        this.paused = true;
      }
    },
  };

  const controller = audio.createAudioController({
    window,
    document,
    state,
    encodeWAV: core.encodeWAV,
    onRenderMainArea() {
      events.renders += 1;
    },
    onSetUiMessage(message) {
      events.messages.push(message);
    },
    onShowMicError(message) {
      events.micErrors.push(message);
    },
  });

  await controller.initMicrophone();
  assert.ok(state.audioCtx instanceof window.AudioContext);
  assert.equal(state.micStream.id, 'stream');

  controller.startRecording();
  assert.equal(state.recordingState, 'recording');
  assert.equal(events.messages.at(-1), '');
  assert.equal(typeof processorNode.onaudioprocess, 'function');
  processorNode.onaudioprocess({
    inputBuffer: {
      getChannelData() {
        return new Float32Array([0.25, -0.25]);
      },
    },
  });
  processorNode.onaudioprocess({
    inputBuffer: {
      getChannelData() {
        return new Float32Array([0.5, -0.5]);
      },
    },
  });

  const scheduled = rafCallbacks.values().next().value;
  assert.equal(typeof scheduled, 'function');
  scheduled();

  controller.stopRecording();
  assert.equal(state.recordingState, 'review');
  assert.ok(state.currentRecording instanceof Float32Array);
  assert.deepEqual(Array.from(state.currentRecording), [0.25, -0.25, 0.5, -0.5]);
  assert.equal(document.querySelector('.level-meter__fill').style.width !== '', true);

  controller.playRecording();
  assert.equal(state.playbackAudio.played, true);
  assert.equal(events.renders > 0, true);
  assert.deepEqual(events.micErrors, []);
});

test('split scripts boot in order and expose main flow hooks', () => {
  const { hooks, document } = createHarness({ canDirectSave: true });

  assert.equal(typeof hooks.renderLanding, 'function');
  assert.equal(typeof hooks.showSetupScreen, 'function');
  assert.equal(typeof hooks.showRecordingScreen, 'function');
  assert.equal(typeof hooks.clearSessionAndRestart, 'function');

  hooks.renderLanding();
  assert.ok(findButtonByText(document.body, 'Load Script'));
});

test('ui module renders landing and setup screens', () => {
  const document = new FakeDocument();
  const app = document.createElement('div');
  app.id = 'app';
  document.body.appendChild(app);

  ui.renderLanding(app, {
    onLoadScript() {},
  });

  assert.ok(findButtonByText(app, 'Load Script'));
  assert.ok(document.getElementById('script-file-input'));

  ui.renderSetupScreen(app, {
    browser: { name: 'Chrome', canDirectSave: true },
    state: {
      entries: [{ filename: 'one.wav', text: 'One', displayName: 'one' }],
      scriptName: 'script.txt',
      storageAvailable: true,
    },
    restoredHandle: { name: 'takes' },
    onChooseFolder() {},
    onBeginRecording() {},
  });

  assert.ok(findButtonByText(app, 'Folder: takes'));
  assert.ok(findButtonByText(app, 'Begin Recording'));
});

test('progress bar styling is more prominent than the legacy 3px bar', () => {
  const css = fs.readFileSync(path.join(ROOT_DIR, 'styles', 'recorder.css'), 'utf8');

  assert.match(css, /\.progress-bar\s*\{[^}]*height:\s*(?:6|7|8|9|10)px;[^}]*border-radius:/s);
  assert.match(css, /\.progress-bar__fill\s*\{[^}]*box-shadow:/s);
});

function createFakeIndexedDB(initialDirectoryHandles = {}, options = {}) {
  const stores = {
    directoryHandles: new Map(Object.entries(initialDirectoryHandles)),
  };
  const deleteDelayMs = options.deleteDelayMs || 0;
  const requestDelayMs = options.requestDelayMs || 0;

  function makeRequest(result, { beforeSuccess, delayMs = requestDelayMs, upgrade = false } = {}) {
    const request = {
      result,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    setTimeout(() => {
      if (upgrade && typeof request.onupgradeneeded === 'function') {
        request.onupgradeneeded({ target: request });
      }
      if (typeof beforeSuccess === 'function') {
        beforeSuccess();
      }
      if (typeof request.onsuccess === 'function') {
        request.onsuccess({ target: request });
      }
    }, delayMs);

    return request;
  }

  function makeStore(name) {
    const store = stores[name];
    return {
      put(value, key) {
        store.set(key, value);
        return makeRequest(undefined);
      },
      get(key) {
        return makeRequest(store.get(key));
      },
      delete(key) {
        return makeRequest(undefined, {
          delayMs: deleteDelayMs,
          beforeSuccess() {
            store.delete(key);
          },
        });
      },
    };
  }

  return {
    open() {
      const db = {
        objectStoreNames: {
          contains(name) {
            return Object.prototype.hasOwnProperty.call(stores, name);
          },
        },
        createObjectStore(name) {
          if (!stores[name]) {
            stores[name] = new Map();
          }
          return makeStore(name);
        },
        transaction(name) {
          return {
            objectStore() {
              return makeStore(name);
            },
          };
        },
      };

      return makeRequest(db, { upgrade: true });
    },
    __stores: stores,
  };
}

function createHarness({
  userAgent = 'Mozilla/5.0 Firefox/124.0',
  canDirectSave = false,
  persistedDirectoryHandles = {},
  indexedDbOptions = {},
} = {}) {
  const appScript = fs.readFileSync(path.join(ROOT_DIR, 'src', 'recorder-app.js'), 'utf8');
  const coreScript = fs.readFileSync(path.join(ROOT_DIR, 'src', 'recorder-core.js'), 'utf8');
  const persistenceScript = fs.readFileSync(path.join(ROOT_DIR, 'src', 'recorder-persistence.js'), 'utf8');
  const stateScript = fs.readFileSync(path.join(ROOT_DIR, 'src', 'recorder-state.js'), 'utf8');
  const uiScript = fs.readFileSync(path.join(ROOT_DIR, 'src', 'recorder-ui.js'), 'utf8');
  const audioScript = fs.readFileSync(path.join(ROOT_DIR, 'src', 'recorder-audio.js'), 'utf8');

  const instrumentedScript = appScript.replace(
    /renderLanding\(\);\s*\n\s*\}\(\)\);\s*$/,
    `window.__recorderTestHooks = {
      state: state,
      detectBrowser: detectBrowser,
      renderLanding: renderLanding,
      showResumeModal: showResumeModal,
      showSetupScreen: showSetupScreen,
      renderSidebar: renderSidebar,
      renderMainArea: renderMainArea,
      showRecordingScreen: showRecordingScreen,
      startRecording: startRecording,
      stopRecording: stopRecording,
      updateZipButton: updateZipButton,
      keepRecording: keepRecording,
      initMicrophone: initMicrophone,
      clearSessionAndRestart: clearSessionAndRestart
    };
    renderLanding();

    }());`
  );

  const document = new FakeDocument();
  const app = document.createElement('div');
  app.id = 'app';
  document.body.appendChild(app);

  const storage = new Map();
  const urlTokens = [];
  const indexedDB = createFakeIndexedDB(persistedDirectoryHandles, indexedDbOptions);
  const testConsole = {
    log() {},
    info() {},
    warn() {},
    error() {},
  };
  const context = {
    console: testConsole,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    TextEncoder,
    Blob,
    ArrayBuffer,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Int16Array,
    Float32Array,
    DataView,
    Map,
    Set,
    Math,
    JSON,
    Promise,
    window: null,
    document,
    indexedDB,
    navigator: {
      userAgent,
      mediaDevices: {
        getUserMedia: async () => ({ id: 'stream' }),
      },
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    Audio: class {
      constructor(src) {
        this.src = src;
      }
      play() {}
      pause() {}
    },
    URL: {
      createObjectURL() {
        const token = `blob:${urlTokens.length + 1}`;
        urlTokens.push(token);
        return token;
      },
      revokeObjectURL() {},
    },
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    },
  };

  context.window = context;
  context.globalThis = context;
  context.window.document = document;
  context.window.navigator = context.navigator;
  context.window.localStorage = context.localStorage;
  context.window.Audio = context.Audio;
  context.window.URL = context.URL;
  context.window.showDirectoryPicker = canDirectSave ? async () => ({ name: 'out' }) : undefined;

  context.window.AudioContext = class {
    createMediaStreamSource(stream) {
      return {
        stream,
        connect() {},
        disconnect() {},
      };
    }

    createScriptProcessor() {
      return {
        onaudioprocess: null,
        connect() {},
        disconnect() {},
      };
    }

    createAnalyser() {
      return {
        fftSize: 0,
        connect() {},
        disconnect() {},
        getByteTimeDomainData(array) {
          array.fill(128);
        },
      };
    }
  };

  vm.createContext(context);
  vm.runInContext(coreScript, context);
  vm.runInContext(persistenceScript, context);
  vm.runInContext(stateScript, context);
  vm.runInContext(uiScript, context);
  vm.runInContext(audioScript, context);
  vm.runInContext(instrumentedScript, context);

  return {
    hooks: context.window.__recorderTestHooks,
    context,
    document,
    indexedDB,
  };
}

function addRecordingDom(document) {
  const screen = document.createElement('div');
  screen.className = 'recording-screen';
  const mainPanel = document.createElement('div');
  mainPanel.className = 'main-panel';
  const zipControls = document.createElement('div');
  zipControls.className = 'zip-controls';
  const mainArea = document.createElement('div');
  mainArea.className = 'main-area';
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  mainPanel.appendChild(zipControls);
  mainPanel.appendChild(mainArea);
  screen.appendChild(sidebar);
  screen.appendChild(mainPanel);
  document.getElementById('app').appendChild(screen);
}

function findButtonByText(root, text) {
  return findFirst(root, (node) => node.tagName === 'BUTTON' && node.textContent === text);
}

test('zip-mode resume keeps lines pending for rerecording', () => {
  const { hooks, document } = createHarness({ canDirectSave: false });
  hooks.state.entries = [
    { filename: 'one.wav', text: 'One', displayName: 'one' },
    { filename: 'two.wav', text: 'Two', displayName: 'two' },
    { filename: 'three.wav', text: 'Three', displayName: 'three' },
  ];
  hooks.state.scriptName = 'script.txt';
  hooks.state.storageAvailable = true;

  hooks.showResumeModal({ currentIndex: 2, completedLines: [0, 1] });
  findButtonByText(document.body, 'Resume').click();

  assert.deepEqual(Array.from(hooks.state.needsRerecord).sort(), [0, 1]);
  assert.deepEqual(Array.from(hooks.state.completedLines), []);
});

test('setup restores a remembered output directory when direct-save support is available', async () => {
  const rememberedHandle = {
    name: 'takes',
    async queryPermission() {
      return 'granted';
    },
  };
  const { hooks, document } = createHarness({
    canDirectSave: true,
    persistedDirectoryHandles: {
      direct_session: {
        handle: rememberedHandle,
        name: 'takes',
      },
    },
  });

  hooks.state.entries = [
    { filename: 'one.wav', text: 'One', displayName: 'one' },
  ];
  hooks.state.scriptName = 'script.txt';
  hooks.state.storageAvailable = true;
  hooks.state.sessionKey = 'direct_session';

  await hooks.showSetupScreen();

  assert.equal(hooks.state.dirHandle, rememberedHandle);
  assert.ok(findButtonByText(document.body, 'Folder: takes'));
  assert.ok(findButtonByText(document.body, 'Begin Recording'));
});

test('starting a new session clears the remembered direct-save folder', async () => {
  const rememberedHandle = {
    name: 'takes',
    async queryPermission() {
      return 'granted';
    },
  };
  const { hooks, indexedDB } = createHarness({
    canDirectSave: true,
    persistedDirectoryHandles: {
      direct_session: {
        handle: rememberedHandle,
        name: 'takes',
      },
    },
  });

  hooks.state.entries = [
    { filename: 'one.wav', text: 'One', displayName: 'one' },
  ];
  hooks.state.scriptName = 'script.txt';
  hooks.state.storageAvailable = true;
  hooks.state.sessionKey = 'direct_session';

  hooks.clearSessionAndRestart();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(indexedDB.__stores.directoryHandles.has('direct_session'), false);
});

test('resume modal start over waits for remembered direct-save folder to clear', async () => {
  const rememberedHandle = {
    name: 'takes',
    async queryPermission() {
      return 'granted';
    },
  };
  const { hooks, document, indexedDB } = createHarness({
    canDirectSave: true,
    persistedDirectoryHandles: {
      direct_session: {
        handle: rememberedHandle,
        name: 'takes',
      },
    },
    indexedDbOptions: {
      deleteDelayMs: 25,
    },
  });

  hooks.state.entries = [
    { filename: 'one.wav', text: 'One', displayName: 'one' },
  ];
  hooks.state.scriptName = 'script.txt';
  hooks.state.storageAvailable = true;
  hooks.state.sessionKey = 'direct_session';

  hooks.showResumeModal({ currentIndex: 0, completedLines: [0] });
  findButtonByText(document.body, 'Start Over').click();
  await new Promise((resolve) => setTimeout(resolve, 35));

  assert.equal(findButtonByText(document.body, 'Folder: takes'), null);
  assert.ok(findButtonByText(document.body, 'Choose Output Folder'));
  assert.equal(indexedDB.__stores.directoryHandles.has('direct_session'), false);
});

test('keepRecording does not advance when direct save fails', async () => {
  const { hooks, document } = createHarness({ canDirectSave: true });
  addRecordingDom(document);

  hooks.state.browser = { canDirectSave: true };
  hooks.state.dirHandle = {
    async getFileHandle() {
      return {
        async createWritable() {
          throw new Error('disk full');
        },
      };
    },
  };
  hooks.state.screen = 'recording';
  hooks.state.entries = [
    { filename: 'one.wav', text: 'One', displayName: 'one' },
    { filename: 'two.wav', text: 'Two', displayName: 'two' },
  ];
  hooks.state.currentIndex = 0;
  hooks.state.currentRecording = new Float32Array([0.1, -0.1]);
  hooks.state.recordingState = 'review';

  await hooks.keepRecording();

  assert.equal(hooks.state.currentIndex, 0);
  assert.equal(hooks.state.completedLines.has(0), false);
});

test('zip download button survives main area rerenders', () => {
  const { hooks, document } = createHarness({ canDirectSave: false });
  addRecordingDom(document);

  hooks.state.browser = { canDirectSave: false };
  hooks.state.screen = 'recording';
  hooks.state.entries = [{ filename: 'one.wav', text: 'One', displayName: 'one' }];
  hooks.state.zipEntries.set('one.wav', new ArrayBuffer(8));

  hooks.updateZipButton();
  assert.ok(document.getElementById('zip-download-btn'));

  hooks.renderMainArea();
  assert.ok(document.getElementById('zip-download-btn'));
});

test('startRecording is a no-op until the microphone is ready', () => {
  const { hooks, document } = createHarness({ canDirectSave: true });
  addRecordingDom(document);

  hooks.state.browser = { canDirectSave: true };
  hooks.state.screen = 'recording';
  hooks.state.entries = [{ filename: 'one.wav', text: 'One', displayName: 'one' }];
  hooks.state.currentIndex = 0;
  hooks.state.audioCtx = null;
  hooks.state.micStream = null;
  hooks.state.recordingState = 'idle';

  assert.doesNotThrow(() => hooks.startRecording());
  assert.equal(hooks.state.recordingState, 'idle');
});
