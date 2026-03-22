# Voice Line Recorder — Design Spec

## Overview

A single, self-contained `.html` file that helps a voice actor/contributor record spoken lines from a script. No installation, no dependencies, no build step. Double-click to open in any browser.

The tool is part of a TTS/STT pipeline. Its sole job is to produce correctly-named `.wav` audio files from a text script.

## Input Format

A pipe-delimited `.txt` file with a header row:

```
filename | text
clip_0001.wav| There was once a merchant who employed many carpenters and masons to build a temple in his garden.
clip_0002.wav| Regularly, they would start work in the morning, and take a break for the mid-day meals, and return to resume work till evening.
```

- First column: the output filename (used as-is for saving)
- Second column: the line to display and read aloud
- First row is treated as a header and skipped

## Architecture

Everything lives in one `.html` file — HTML, CSS, and JavaScript. No external dependencies, no CDN imports, no build tools.

### Core Components

1. **Script Parser** — reads the `.txt` file via `<input type="file">`, splits on newlines, splits each line on `|`, extracts filename and text. Skips the header row. Rejects duplicate filenames at parse time with an error message listing the duplicates.

2. **Browser Detector** — identifies the user's browser (Chrome, Edge, Firefox, Safari, Arc, Brave, etc.) and checks for File System Access API support. Displays browser name and saving mode to the user before recording begins.

3. **Audio Recorder** — uses `navigator.mediaDevices.getUserMedia()` to capture microphone input. Records while Space is held, stops on release. Encodes output as PCM `.wav` (16-bit, mono, 44100 Hz) using client-side WAV encoding from raw `AudioBuffer` samples. If microphone access is denied or unavailable, displays a clear error message explaining how to grant permission and blocks the recording screen until resolved.

4. **File Saver** — two modes, auto-detected:
   - **Direct mode** (File System Access API available): user picks an output folder once. Each "Keep" writes the `.wav` directly to that folder using the filename from the txt file.
   - **Zip mode** (fallback): recordings accumulate in memory. A "Download All" button bundles everything into a `.zip` using an inline store-only zip encoder (no compression, just stored entries with correct local file headers, central directory, and CRC-32). No external libraries.

5. **Session Manager** — persists progress to `localStorage`:
   - Current line index
   - Set of completed line indices
   - On page reload, detects existing session and prompts: "You have a session in progress (42 / 600 complete). Resume or Start Over?"

## User Flow

### 1. Startup

- User double-clicks the `.html` file, it opens in their default browser.
- Landing screen shows a "Load Script" button.

### 2. Script Loading

- User picks their `.txt` file.
- App parses all lines, displays total count.
- If a previous session exists for this file, offers Resume or Start Over.

### 3. Browser & Output Setup

- App detects browser and checks File System Access API support.
- **If supported:** prompts user to pick an output folder.
- **If not supported:** displays message: "Your browser ([name]) doesn't support direct folder saving. Recordings will be bundled as a zip download."
- **If unknown browser:** displays: "Could not detect your browser. Some features may not work as expected. For the best experience, use Chrome or Edge."

### 4. Recording Screen

Main UI layout:

```
┌─────────────────────────────────────────────────┐
│  [Sidebar: Line List]  │  [Main Area]           │
│                        │                        │
│  ✓ clip_0001.wav       │  3 / 600               │
│  ✓ clip_0002.wav       │                        │
│  ► clip_0003.wav       │  "One day, a group of  │
│    clip_0004.wav       │   monkeys arrived at   │
│    clip_0005.wav       │   the site of the      │
│    ...                 │   building..."         │
│                        │                        │
│                        │  clip_0003.wav          │
│                        │                        │
│                        │  [Hold SPACE to record] │
│                        │                        │
│                        │  ● Recording...         │
│                        │  ─── or ───             │
│                        │  [Play] [Keep] [Retry]  │
└─────────────────────────────────────────────────┘
```

- **Main area:** displays the current line text in large, readable font. Shows the target filename below for reference. Shows a human-readable description derived from the text (lowercase, underscored, truncated) as a display label.
- **Progress:** "3 / 600" at the top.
- **Sidebar:** scrollable list of all lines. Completed lines show a checkmark. Current line is highlighted. Click any line to jump to it (allows re-recording).

### 5. Recording Interaction

1. **Idle state:** "Hold SPACE to record" prompt visible.
2. **Recording:** user holds Space. A pulsing red indicator appears. Audio captures.
3. **Review:** user releases Space. Three options appear:
   - **Play (P)** — replays the recording
   - **Keep (Enter)** — saves the `.wav`, marks line complete, advances to next incomplete line (wraps around to earlier incomplete lines if the end is reached; if this was the last incomplete line, triggers completion screen)
   - **Retry (R)** — discards recording, returns to idle state

### 6. Completion

- When all lines are recorded, show a completion message.
- In zip mode, prompt to download the zip.
- Session data can be cleared.

## Keyboard Shortcuts

| Key     | Action                    |
|---------|---------------------------|
| Space   | Hold to record            |
| P       | Play back recording       |
| Enter   | Keep recording & next     |
| R       | Retry (discard & re-record)|

All keyboard shortcuts call `preventDefault()` to suppress default browser behavior (Space scrolling, Enter activating focused buttons). Shortcuts are only active on the recording screen — disabled when modals or file pickers are open.

## Audio Encoding

- Format: PCM WAV
- Sample rate: 44100 Hz
- Bit depth: 16-bit
- Channels: mono
- Encoding done client-side from raw `AudioBuffer` float32 samples → int16 PCM → WAV header + data

## File Naming

- **Saved filename:** taken directly from the txt file's first column (e.g., `clip_0001.wav`)
- **Display name in UI:** human-readable, derived from the text content (e.g., `there_was_once_a_merchant_who_employed`)

## Session Persistence

Stored in `localStorage`, keyed by a hash of the script filename + first line content + line count (to avoid collisions between different files with same name/count):

- `currentLineIndex: number`
- `completedLines: number[]` (indices of completed lines)
- On reload: detect and offer resume

Note: actual audio data is NOT stored in localStorage (too large). Only progress state is persisted.

**Zip mode session behavior:** In zip mode, audio data is lost on page reload. On resume, previously completed lines are marked but have no audio backing. The app warns the user at session start: "Your browser uses zip download mode. If you reload the page, you'll need to re-record any lines from this session. Use 'Download All' frequently to save your progress." Completed lines from a prior session show a warning icon instead of a checkmark, indicating they need re-recording.

**`file://` protocol limitation:** Some browsers (Firefox, Safari) restrict `localStorage` on `file://` origins. If `localStorage` is unavailable, session persistence is disabled and the user is informed: "Session saving is not available in this browser when opened as a local file. Your progress will not be saved between page reloads."

## Browser Compatibility

| Browser        | Saving Mode | Notes                          |
|----------------|-------------|--------------------------------|
| Chrome 86+     | Direct      | Full File System Access API    |
| Edge 86+       | Direct      | Full File System Access API    |
| Brave          | Direct      | Chromium-based                 |
| Arc            | Direct      | Chromium-based                 |
| Opera          | Direct      | Chromium-based                 |
| Firefox        | Zip         | No File System Access API      |
| Safari         | Zip         | No File System Access API      |
| Unknown        | Zip + warning | Advised to use Chrome/Edge   |

## Out of Scope

- Audio editing (trim, normalize, effects)
- Waveform visualization
- Multiple takes per line (only latest recording kept)
- Server-side anything
- Auto-advancing without explicit Keep
- Audio input device selection (uses system default microphone)
- Recording duration guardrails (sub-second recordings are allowed; memory is not a concern for single-line recordings)
