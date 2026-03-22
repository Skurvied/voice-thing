# Recorder App Modularization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split `src/recorder-app.js` into smaller browser-safe modules that improve testability and readability without breaking direct `file://` usage.

**Architecture:** Keep the browser runtime on ordered plain script tags and extract narrow modules with dual exports: attach APIs to `window` for the app runtime and `module.exports` for Node tests. Reduce `src/recorder-app.js` to app composition, flow control, and event wiring while moving persistence, state, UI, and audio concerns into dedicated files.

**Tech Stack:** Vanilla HTML/CSS/JS, Node test runner, `localStorage`, `IndexedDB`, File System Access API.

---

### Task 1: Extract persistence into its own module

**Files:**
- Create: `src/recorder-persistence.js`
- Modify: `src/recorder-app.js`
- Modify: `recorder.html`
- Test: `tests/recorder.test.js`

**Step 1: Write the failing test**

Add a test that loads `src/recorder-persistence.js` directly and verifies it can:

- save a directory handle by session key
- load that handle back
- delete that handle by the same session key

**Step 2: Run test to verify it fails**

Run: `node --test tests/recorder.test.js`
Expected: FAIL because `src/recorder-persistence.js` does not exist or does not expose the expected API.

**Step 3: Write minimal implementation**

Create `src/recorder-persistence.js` with:

- IndexedDB helpers
- session save/load/clear helpers for `localStorage`
- a dual export pattern for browser and Node

Keep the module API narrow and dependency-driven where practical.

**Step 4: Update the app wiring**

Move persistence calls in `src/recorder-app.js` to the new module and add the new script tag to `recorder.html` before `src/recorder-app.js`.

**Step 5: Run test to verify it passes**

Run: `node --test tests/recorder.test.js`
Expected: PASS, including the new direct module coverage.

### Task 2: Extract state creation and reset helpers

**Files:**
- Create: `src/recorder-state.js`
- Modify: `src/recorder-app.js`
- Modify: `recorder.html`
- Test: `tests/recorder.test.js`

**Step 1: Write the failing test**

Add tests for state helpers that verify:

- a new state object has the expected defaults
- landing/session reset clears the expected fields
- recording reset clears transient recording fields without wiping loaded script data

**Step 2: Run test to verify it fails**

Run: `node --test tests/recorder.test.js`
Expected: FAIL because the module or helper functions do not exist yet.

**Step 3: Write minimal implementation**

Create `src/recorder-state.js` with helper functions such as:

- `createInitialState()`
- `resetForLanding(state)`
- `resetRecordingState(state)`

Keep the reset behavior explicit and derived from the current app behavior.

**Step 4: Update the app wiring**

Replace inline state literal/reset logic in `src/recorder-app.js` with the new helpers and add the new script tag to `recorder.html`.

**Step 5: Run test to verify it passes**

Run: `node --test tests/recorder.test.js`
Expected: PASS, with the new state-module assertions green.

### Task 3: Extract UI rendering helpers

**Files:**
- Create: `src/recorder-ui.js`
- Modify: `src/recorder-app.js`
- Modify: `recorder.html`
- Test: `tests/recorder.test.js`

**Step 1: Write the failing test**

Add tests that load the UI module directly and verify a small subset of rendering behavior, such as:

- the setup renderer shows the remembered folder label when passed one
- the recording-shell renderer builds the progress bar and panel containers

Keep the tests narrow and avoid re-testing every DOM detail already covered by the app harness.

**Step 2: Run test to verify it fails**

Run: `node --test tests/recorder.test.js`
Expected: FAIL because `src/recorder-ui.js` does not exist or lacks the expected render functions.

**Step 3: Write minimal implementation**

Create `src/recorder-ui.js` for:

- SVG helpers
- landing/setup/completion builders
- resume modal builder
- recording-shell/sidebar/main-area renderers

Expose render functions that accept state plus callbacks instead of closing over unrelated logic.

**Step 4: Update the app wiring**

Refactor `src/recorder-app.js` to delegate DOM rendering to the UI module and add the script tag to `recorder.html`.

**Step 5: Run test to verify it passes**

Run: `node --test tests/recorder.test.js`
Expected: PASS, with the harness still validating top-level behavior.

### Task 4: Extract audio and playback helpers

**Files:**
- Create: `src/recorder-audio.js`
- Modify: `src/recorder-app.js`
- Modify: `recorder.html`
- Test: `tests/recorder.test.js`

**Step 1: Write the failing test**

Add tests that verify the audio module can:

- no-op cleanly when microphone/audio context are unavailable
- stop a recording and produce a merged `Float32Array`
- invoke a provided callback when UI refresh is needed

Use fakes for media stream, analyser, and audio context methods.

**Step 2: Run test to verify it fails**

Run: `node --test tests/recorder.test.js`
Expected: FAIL because `src/recorder-audio.js` does not exist or the tested API is missing.

**Step 3: Write minimal implementation**

Create `src/recorder-audio.js` with helpers for:

- `initMicrophone`
- `startRecording`
- `stopRecording`
- `playRecording`
- level meter lifecycle

Keep controller decisions in `src/recorder-app.js` and keep raw audio mechanics in the module.

**Step 4: Update the app wiring**

Move audio-specific implementation out of `src/recorder-app.js` and add the script tag to `recorder.html`.

**Step 5: Run test to verify it passes**

Run: `node --test tests/recorder.test.js`
Expected: PASS, with existing recording flow tests still green.

### Task 5: Reduce `recorder-app.js` to orchestration

**Files:**
- Modify: `src/recorder-app.js`
- Test: `tests/recorder.test.js`

**Step 1: Write the failing test**

Add or tighten a regression test that verifies the app still boots correctly with the split scripts loaded in order and that the existing flow hooks remain reachable through the harness.

**Step 2: Run test to verify it fails**

Run: `node --test tests/recorder.test.js`
Expected: FAIL if the refactor removes or mis-wires the public behavior.

**Step 3: Write minimal implementation**

Shrink `src/recorder-app.js` so it:

- creates state
- composes modules
- coordinates save/retry/advance transitions
- owns keyboard listeners and app bootstrap

Remove implementation details that now belong to other modules.

**Step 4: Run test to verify it passes**

Run: `node --test tests/recorder.test.js`
Expected: PASS, with no behavior regressions.

### Task 6: Final verification and cleanup

**Files:**
- Modify as needed: `README.md`

**Step 1: Run syntax verification**

Run: `node --check src/recorder-core.js`
Expected: PASS

Run: `node --check src/recorder-persistence.js`
Expected: PASS

Run: `node --check src/recorder-state.js`
Expected: PASS

Run: `node --check src/recorder-ui.js`
Expected: PASS

Run: `node --check src/recorder-audio.js`
Expected: PASS

Run: `node --check src/recorder-app.js`
Expected: PASS

**Step 2: Run tests**

Run: `node --test tests/recorder.test.js`
Expected: PASS

**Step 3: Update docs if needed**

If the script list in `recorder.html` or the repository structure is user-visible enough to mention, update `README.md` briefly.
