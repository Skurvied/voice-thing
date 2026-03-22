# Voice Line Recorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single self-contained HTML file that records voice lines from a parsed script, producing named WAV files.

**Architecture:** One `recorder.html` file containing all HTML, CSS, and JS. No external dependencies. Uses Web Audio API for recording, File System Access API for direct saving (with zip fallback), and localStorage for session persistence.

**Tech Stack:** Vanilla HTML/CSS/JS, Web Audio API, File System Access API, inline WAV encoder, inline store-only ZIP encoder.

**Spec:** `docs/superpowers/specs/2026-03-21-voice-line-recorder-design.md`

**Security note:** All DOM manipulation MUST use safe methods (`textContent`, `createElement`, `appendChild`, etc.). Do NOT use `innerHTML` or `insertAdjacentHTML` with any content derived from the parsed script file to prevent XSS. Use `document.createTextNode()` for any user-provided text.

---

### Task 1: HTML Shell + Landing Screen

**Files:**
- Create: `recorder.html`

- [ ] **Step 1: Create the HTML file with base structure**

Create `recorder.html` with:
- DOCTYPE, html, head (meta charset, viewport, title "Voice Line Recorder")
- A `<style>` block with CSS reset, dark theme (easy on eyes for long recording sessions), and layout for the landing screen
- A `<div id="app">` container
- A `<script>` block with an IIFE wrapping all JS

Landing screen shows:
- App title "Voice Line Recorder"
- A styled "Load Script" button that triggers a hidden `<input type="file" accept=".txt">`
- Minimal footer: "Open a .txt script file to begin"

All UI rendering uses safe DOM APIs: `createElement`, `textContent`, `appendChild`. No `innerHTML`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voice Line Recorder</title>
  <style>
    /* CSS goes here - dark theme, centered landing */
  </style>
</head>
<body>
  <div id="app"></div>
  <input type="file" id="file-input" accept=".txt" hidden>
  <script>
    (function() {
      'use strict';
      // All JS here - use createElement/textContent for DOM
    })();
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify by opening in browser**

Open `recorder.html` by double-clicking. Confirm:
- Dark themed landing screen appears
- "Load Script" button is visible and clickable
- Clicking it opens a file picker filtered to `.txt`

- [ ] **Step 3: Commit**

```bash
git add recorder.html
git commit -m "feat: add HTML shell with landing screen"
```

---

### Task 2: Script Parser

**Files:**
- Modify: `recorder.html` (script block)

- [ ] **Step 1: Implement the parser function**

Add a `parseScript(text)` function that:
- Splits input on newlines, filters empty lines
- Skips the first line (header row)
- Splits each remaining line on `|` (first occurrence only, in case text contains `|`)
- Trims whitespace from filename and text
- Returns array of `{ filename, text, displayName }` objects
- `displayName` = text lowercased, punctuation stripped, spaces to underscores, truncated to 60 chars

```javascript
function parseScript(rawText) {
  const lines = rawText.split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('Script file is empty or has only a header row.');

  const entries = [];
  const seenFilenames = new Set();
  const duplicates = [];

  for (let i = 1; i < lines.length; i++) {
    const pipeIdx = lines[i].indexOf('|');
    if (pipeIdx === -1) continue;
    const filename = lines[i].slice(0, pipeIdx).trim();
    const text = lines[i].slice(pipeIdx + 1).trim();
    if (!filename || !text) continue;

    if (seenFilenames.has(filename)) {
      duplicates.push(filename);
    } else {
      seenFilenames.add(filename);
    }

    const displayName = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);

    entries.push({ filename, text, displayName });
  }

  if (duplicates.length > 0) {
    throw new Error('Duplicate filenames found: ' + duplicates.join(', '));
  }

  return entries;
}
```

- [ ] **Step 2: Wire up the file input to the parser**

Add an event listener on the file input's `change` event:
- Read the file as text via `FileReader`
- Call `parseScript()` on the result
- On success: store the entries array, transition to the next screen
- On error: display the error message on the landing screen using `textContent`

```javascript
document.getElementById('file-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      state.entries = parseScript(ev.target.result);
      state.scriptName = file.name;
      showSetupScreen();
    } catch (err) {
      showError(err.message);
    }
  };
  reader.readAsText(file);
});
```

- [ ] **Step 3: Verify by loading sample.txt**

Open `recorder.html`, click "Load Script", select `sample.txt`. Confirm:
- No errors shown
- Console log shows 600 parsed entries (add a temporary `console.log` for verification)
- Each entry has filename, text, and displayName

- [ ] **Step 4: Commit**

```bash
git add recorder.html
git commit -m "feat: add script parser with duplicate detection"
```

---

### Task 3: Browser Detection + Setup Screen

**Files:**
- Modify: `recorder.html` (script block + style block)

- [ ] **Step 1: Implement browser detection**

Add a `detectBrowser()` function that returns `{ name: string, canDirectSave: boolean }`:

```javascript
function detectBrowser() {
  const ua = navigator.userAgent;
  let name = 'Unknown';

  if (ua.includes('Firefox')) name = 'Firefox';
  else if (ua.includes('Edg/')) name = 'Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) name = 'Opera';
  else if (ua.includes('Brave')) name = 'Brave';
  else if (ua.includes('Arc')) name = 'Arc';
  else if (ua.includes('Chrome')) name = 'Chrome';
  else if (ua.includes('Safari')) name = 'Safari';

  // Feature-detect File System Access API rather than relying solely on UA
  const canDirectSave = typeof window.showDirectoryPicker === 'function';

  return { name, canDirectSave };
}
```

- [ ] **Step 2: Build the setup screen**

Add a `showSetupScreen()` function that:
- Displays detected browser name and saving mode
- Shows total line count from parsed script
- If `canDirectSave`: shows "Choose Output Folder" button that calls `showDirectoryPicker()`
- If not `canDirectSave`: shows the appropriate message per spec (known browser vs unknown)
- If unknown browser: shows warning message
- Stores the directory handle in state for later use
- After setup, transitions to recording screen via "Begin Recording" button (which also requests mic permission)

All text rendered via `textContent` and `createElement`.

- [ ] **Step 3: Verify in Chrome and Firefox**

Open in Chrome: confirm "Direct" mode, folder picker works.
Open in Firefox: confirm "Zip" mode message appears.

- [ ] **Step 4: Commit**

```bash
git add recorder.html
git commit -m "feat: add browser detection and setup screen"
```

---

### Task 4: Recording Screen Layout + Sidebar

**Files:**
- Modify: `recorder.html` (script block + style block)

- [ ] **Step 1: Build the recording screen HTML/CSS**

Add a `showRecordingScreen()` function that renders using DOM APIs:
- **Sidebar** (left, ~250px): scrollable list of all lines showing filename. Completed lines get a checkmark. Current line highlighted. Each line clickable.
- **Main area** (right, flex-grow):
  - Progress indicator "N / total" at top
  - Current line text in large font (1.4em+)
  - Target filename displayed below
  - Human-readable display name shown as a label
  - Recording state area (changes based on idle/recording/review states)
  - Keyboard shortcut hints in footer: "SPACE record | P play | ENTER keep | R retry"

CSS for the layout:

```css
.recording-screen { display: flex; height: 100vh; }
.sidebar { width: 250px; overflow-y: auto; border-right: 1px solid #333; }
.sidebar-item { padding: 8px 12px; cursor: pointer; font-size: 0.85em; }
.sidebar-item.active { background: #2a2a4a; }
.sidebar-item.completed::before { content: '\2713  '; color: #4caf50; }
.sidebar-item.needs-rerecord::before { content: '\26A0  '; color: #ff9800; }
.main-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2em; }
.line-text { font-size: 1.5em; line-height: 1.6; max-width: 700px; text-align: center; }
.progress { font-size: 0.9em; opacity: 0.6; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.recording-dot { width: 16px; height: 16px; background: #e53935; border-radius: 50%; animation: pulse 1s infinite; display: inline-block; }
```

- [ ] **Step 2: Implement sidebar click navigation**

Clicking a sidebar item sets `state.currentIndex` to that line's index and re-renders the main area. If in review state, discard current recording and switch.

- [ ] **Step 3: Verify layout with sample.txt**

Load `sample.txt`. Confirm:
- Sidebar shows 600 items, scrollable
- First line is highlighted
- Main area shows line 1's text, filename, progress "1 / 600"
- Clicking a sidebar item switches the main area

- [ ] **Step 4: Commit**

```bash
git add recorder.html
git commit -m "feat: add recording screen layout with sidebar"
```

---

### Task 5: Audio Recording (Hold Space)

**Files:**
- Modify: `recorder.html` (script block)

- [ ] **Step 1: Request microphone permission**

On entering the recording screen, call `navigator.mediaDevices.getUserMedia({ audio: true })`.
- On success: store the `MediaStream`, create `AudioContext` and `MediaStreamSource`
- On error: show a blocking error overlay (built with DOM APIs) with instructions per error type:
  - `NotAllowedError`: "Microphone access denied. Please allow microphone access in your browser settings and reload."
  - `NotFoundError`: "No microphone found. Please connect a microphone and reload."
  - `NotReadableError`: "Microphone is in use by another application. Close it and reload."

```javascript
async function initMicrophone() {
  try {
    state.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 44100, channelCount: 1, echoCancellation: false }
    });
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
  } catch (err) {
    let msg = 'Microphone error: ' + err.message;
    if (err.name === 'NotAllowedError') msg = 'Microphone access denied. Please allow microphone access in your browser settings and reload.';
    else if (err.name === 'NotFoundError') msg = 'No microphone found. Please connect a microphone and reload.';
    else if (err.name === 'NotReadableError') msg = 'Microphone is in use by another application. Close it and reload.';
    showMicError(msg);
  }
}
```

- [ ] **Step 2: Implement hold-to-record with ScriptProcessorNode**

Use `ScriptProcessorNode` to capture raw PCM float32 samples into a buffer array while Space is held:

```javascript
let recordingChunks = [];
let isRecording = false;
let processorNode = null;

function startRecording() {
  recordingChunks = [];
  isRecording = true;
  const source = state.audioCtx.createMediaStreamSource(state.micStream);
  processorNode = state.audioCtx.createScriptProcessor(4096, 1, 1);
  processorNode.onaudioprocess = function(e) {
    if (isRecording) {
      const data = e.inputBuffer.getChannelData(0);
      recordingChunks.push(new Float32Array(data));
    }
  };
  source.connect(processorNode);
  processorNode.connect(state.audioCtx.destination);
  updateUI('recording');
}

function stopRecording() {
  isRecording = false;
  if (processorNode) {
    processorNode.disconnect();
    processorNode = null;
  }
  const length = recordingChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;
  for (const chunk of recordingChunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  state.currentRecording = merged;
  updateUI('review');
}
```

- [ ] **Step 3: Wire up Space key events**

Add `keydown` and `keyup` listeners on `document`:
- `keydown` Space (not repeat): call `startRecording()`, `preventDefault()`
- `keyup` Space: call `stopRecording()`, `preventDefault()`
- Only active when `state.screen === 'recording'` and appropriate recording state
- Ignore if focus is on an input/textarea element

```javascript
document.addEventListener('keydown', function(e) {
  if (state.screen !== 'recording' || state.modalOpen) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    if (state.recordingState === 'idle') startRecording();
  }
});

document.addEventListener('keyup', function(e) {
  if (state.screen !== 'recording' || state.modalOpen) return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.recordingState === 'recording') stopRecording();
  }
});
```

- [ ] **Step 4: Verify recording works**

Open the app, load script, grant mic permission. Hold Space — confirm red pulsing dot appears. Release — confirm review state appears. Check console for `state.currentRecording` being a `Float32Array` with data.

- [ ] **Step 5: Commit**

```bash
git add recorder.html
git commit -m "feat: add hold-space-to-record audio capture"
```

---

### Task 6: WAV Encoder

**Files:**
- Modify: `recorder.html` (script block)

- [ ] **Step 1: Implement the WAV encoder**

Add an `encodeWAV(float32Samples, sampleRate)` function that:
- Takes a `Float32Array` of mono samples and sample rate (44100)
- Converts float32 (-1.0 to 1.0) to int16 (-32768 to 32767)
- Builds a proper WAV file with RIFF header, fmt chunk, data chunk
- Returns an `ArrayBuffer`

```javascript
function encodeWAV(samples, sampleRate) {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, s, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
```

- [ ] **Step 2: Verify WAV output is playable**

After recording, encode the `currentRecording` to WAV, create a `Blob`, create an object URL, play it with `new Audio(url)`. Confirm audio plays back correctly.

- [ ] **Step 3: Commit**

```bash
git add recorder.html
git commit -m "feat: add PCM WAV encoder"
```

---

### Task 7: Playback, Keep, Retry Controls

**Files:**
- Modify: `recorder.html` (script block + style block)

- [ ] **Step 1: Implement review state UI**

When `state.recordingState === 'review'`, show three buttons (created via DOM APIs):
- **Play (P)** — creates a WAV blob from `state.currentRecording`, plays via `Audio` element
- **Keep (Enter)** — triggers save, marks line complete, advances
- **Retry (R)** — clears `state.currentRecording`, returns to idle state

```javascript
function playRecording() {
  const wavBuffer = encodeWAV(state.currentRecording, 44100);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  if (state.playbackAudio) {
    state.playbackAudio.pause();
    URL.revokeObjectURL(state.playbackAudio.src);
  }
  state.playbackAudio = new Audio(url);
  state.playbackAudio.play();
}

function keepRecording() {
  saveRecording(state.currentIndex, state.currentRecording);
  state.completedLines.add(state.currentIndex);
  state.currentRecording = null;
  state.recordingState = 'idle';
  advanceToNext();
  saveSession();
  renderRecordingScreen();
}

function retryRecording() {
  state.currentRecording = null;
  state.recordingState = 'idle';
  renderRecordingScreen();
}
```

- [ ] **Step 2: Wire up keyboard shortcuts**

Add to the existing keydown listener:

```javascript
if (state.recordingState === 'review') {
  if (e.code === 'KeyP') { e.preventDefault(); playRecording(); }
  if (e.code === 'Enter') { e.preventDefault(); keepRecording(); }
  if (e.code === 'KeyR') { e.preventDefault(); retryRecording(); }
}
```

- [ ] **Step 3: Implement advanceToNext()**

```javascript
function advanceToNext() {
  const total = state.entries.length;
  for (let i = 1; i <= total; i++) {
    const idx = (state.currentIndex + i) % total;
    if (!state.completedLines.has(idx)) {
      state.currentIndex = idx;
      return;
    }
  }
  showCompletionScreen();
}
```

- [ ] **Step 4: Verify full record/play/keep/retry cycle**

Load script, record a line, play it back, retry, record again, keep. Confirm:
- Playback works
- Retry clears and returns to idle
- Keep advances to next line
- Sidebar updates with checkmark

- [ ] **Step 5: Commit**

```bash
git add recorder.html
git commit -m "feat: add playback, keep, and retry controls"
```

---

### Task 8: File Saving — Direct Mode + Zip Mode

**Files:**
- Modify: `recorder.html` (script block)

- [ ] **Step 1: Implement direct save mode**

```javascript
async function saveRecordingDirect(index, samples) {
  const entry = state.entries[index];
  const wavBuffer = encodeWAV(samples, 44100);
  const fileHandle = await state.dirHandle.getFileHandle(entry.filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(wavBuffer);
  await writable.close();
}
```

- [ ] **Step 2: Implement zip mode accumulator**

Store WAV buffers in a map keyed by filename. "Download All" triggers zip creation.

```javascript
function saveRecordingZip(index, samples) {
  const entry = state.entries[index];
  const wavBuffer = encodeWAV(samples, 44100);
  state.zipEntries.set(entry.filename, wavBuffer);
}
```

- [ ] **Step 3: Implement inline store-only ZIP encoder**

Build a zip file with no compression (store method). Each entry needs:
- Local file header (30 bytes + filename)
- File data (raw WAV bytes)
- Central directory entry (46 bytes + filename)
- End of central directory record (22 bytes)
- CRC-32 for each entry

```javascript
function crc32(data) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  const bytes = new Uint8Array(data);
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(entries) {
  // entries: Map of filename to ArrayBuffer
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const encoder = new TextEncoder();

  for (const [filename, data] of entries) {
    const nameBytes = encoder.encode(filename);
    const crc = crc32(data);
    const size = data.byteLength;

    // Local file header
    const local = new ArrayBuffer(30 + nameBytes.length);
    const lv = new DataView(local);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    new Uint8Array(local, 30).set(nameBytes);

    localParts.push(local);
    localParts.push(data);

    // Central directory entry
    const central = new ArrayBuffer(46 + nameBytes.length);
    const cv = new DataView(central);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    new Uint8Array(central, 46).set(nameBytes);

    centralParts.push(central);
    offset += 30 + nameBytes.length + size;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const ch of centralParts) centralDirSize += ch.byteLength;

  const eocd = new ArrayBuffer(22);
  const ev = new DataView(eocd);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.size, true);
  ev.setUint16(10, entries.size, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirOffset, true);
  ev.setUint16(20, 0, true);

  const parts = [...localParts, ...centralParts, eocd];
  return new Blob(parts, { type: 'application/zip' });
}

function downloadZip() {
  if (state.zipEntries.size === 0) return;
  const blob = buildZip(state.zipEntries);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'recordings.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Wire saveRecording() to correct mode**

```javascript
function saveRecording(index, samples) {
  if (state.browser.canDirectSave) {
    saveRecordingDirect(index, samples);
  } else {
    saveRecordingZip(index, samples);
  }
}
```

- [ ] **Step 5: Add "Download All" button for zip mode**

In zip mode, show a persistent "Download All (N files)" button in the header area that calls `downloadZip()`. Button created via `createElement`.

- [ ] **Step 6: Verify both modes**

Chrome: record a line, keep it, check the output folder for the `.wav` file. Verify it plays in a media player.
Firefox: record a few lines, click "Download All", verify the zip contains valid `.wav` files.

- [ ] **Step 7: Commit**

```bash
git add recorder.html
git commit -m "feat: add direct save and zip download modes"
```

---

### Task 9: Session Persistence

**Files:**
- Modify: `recorder.html` (script block)

- [ ] **Step 1: Implement session key generation**

```javascript
function getSessionKey(scriptName, entries) {
  const firstLine = entries.length > 0 ? entries[0].text : '';
  const raw = scriptName + '|' + firstLine + '|' + entries.length;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return 'vlr_' + Math.abs(hash).toString(36);
}
```

- [ ] **Step 2: Implement save/load session**

```javascript
function saveSession() {
  if (!state.storageAvailable) return;
  const data = {
    currentIndex: state.currentIndex,
    completedLines: Array.from(state.completedLines),
  };
  try {
    localStorage.setItem(state.sessionKey, JSON.stringify(data));
  } catch (e) { /* silently fail */ }
}

function loadSession() {
  if (!state.storageAvailable) return null;
  try {
    const raw = localStorage.getItem(state.sessionKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function checkStorageAvailable() {
  try {
    localStorage.setItem('__vlr_test', '1');
    localStorage.removeItem('__vlr_test');
    return true;
  } catch (e) {
    return false;
  }
}
```

- [ ] **Step 3: Integrate into script loading flow**

After parsing, check for existing session:
- If found: show modal (built with DOM APIs) "You have a session in progress (N / total complete). Resume or Start Over?"
- Resume: restore `currentIndex` and `completedLines` from session
- Start Over: clear the session key, start fresh
- In zip mode on resume: mark restored completed lines with warning icon (needs re-recording since audio is lost)

- [ ] **Step 4: Show localStorage warning if unavailable**

If `checkStorageAvailable()` returns false, show inline message via `textContent`: "Session saving is not available in this browser when opened as a local file. Your progress will not be saved between page reloads."

- [ ] **Step 5: Show zip mode reload warning**

If in zip mode and `storageAvailable`, show at session start: "Your browser uses zip download mode. If you reload the page, you'll need to re-record any lines from this session. Use 'Download All' frequently to save your progress."

- [ ] **Step 6: Verify session persistence**

Load script, record 3 lines, reload page, load same script. Confirm resume prompt appears with correct count. Resume and verify position + completed marks are correct.

- [ ] **Step 7: Commit**

```bash
git add recorder.html
git commit -m "feat: add session persistence with localStorage"
```

---

### Task 10: Completion Screen + Polish

**Files:**
- Modify: `recorder.html` (script block + style block)

- [ ] **Step 1: Implement completion screen**

Build completion screen using `createElement`/`textContent`:
- Heading: "All Done!"
- Message: "All N lines have been recorded."
- In zip mode: "Download All Recordings (ZIP)" button calling `downloadZip()`
- "Start New Session" button that clears session and returns to landing

```javascript
function showCompletionScreen() {
  state.screen = 'complete';
  const app = document.getElementById('app');
  while (app.firstChild) app.removeChild(app.firstChild);

  const container = document.createElement('div');
  container.className = 'completion';

  const h1 = document.createElement('h1');
  h1.textContent = 'All Done!';
  container.appendChild(h1);

  const p = document.createElement('p');
  p.textContent = 'All ' + state.entries.length + ' lines have been recorded.';
  container.appendChild(p);

  if (!state.browser.canDirectSave) {
    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn primary';
    dlBtn.textContent = 'Download All Recordings (ZIP)';
    dlBtn.addEventListener('click', downloadZip);
    container.appendChild(dlBtn);
  }

  const restartBtn = document.createElement('button');
  restartBtn.className = 'btn';
  restartBtn.textContent = 'Start New Session';
  restartBtn.addEventListener('click', clearSessionAndRestart);
  container.appendChild(restartBtn);

  app.appendChild(container);
}
```

- [ ] **Step 2: Polish the UI**

- Smooth transitions between screens (opacity fade via CSS transitions)
- Button hover states
- Active/focus styles for accessibility
- Responsive: sidebar collapses on narrow screens (< 768px) behind a toggle
- Recording state colors: idle (neutral), recording (red glow), review (green accent)

- [ ] **Step 3: Full end-to-end test**

1. Double-click `recorder.html` — landing screen appears
2. Load `sample.txt` — 600 lines parsed
3. Browser detected, output mode shown
4. Record line 1 (hold Space), play back (P), retry (R), record again, keep (Enter)
5. Verify file saved / zip updated
6. Click sidebar to jump to line 50, record it
7. Reload page, resume session
8. Verify completed lines shown correctly

- [ ] **Step 4: Commit**

```bash
git add recorder.html
git commit -m "feat: add completion screen and UI polish"
```

---

### Task 11: Final Review

- [ ] **Step 1: Check all spec requirements are met**

Walk through every section of `docs/superpowers/specs/2026-03-21-voice-line-recorder-design.md` and verify each requirement is implemented:
- [ ] Pipe-delimited parser with duplicate rejection
- [ ] Browser detection with correct messages
- [ ] Microphone error handling
- [ ] Hold-space-to-record
- [ ] WAV encoding (44100 Hz, 16-bit, mono)
- [ ] Play/Keep/Retry with keyboard shortcuts
- [ ] Direct save mode
- [ ] Zip fallback mode
- [ ] Session persistence with localStorage
- [ ] file:// localStorage warning
- [ ] Zip mode reload warning
- [ ] Sidebar with checkmarks, warning icons, click to jump
- [ ] Completion screen
- [ ] preventDefault on all shortcuts
- [ ] Wrap-around on advance

- [ ] **Step 2: Commit final state**

```bash
git add recorder.html
git commit -m "chore: final review pass"
```
