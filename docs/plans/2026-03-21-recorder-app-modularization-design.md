# Recorder App Modularization Design

**Problem**

`src/recorder-app.js` has grown into a single orchestration file that mixes persistence, DOM rendering, audio capture, session flow, and screen transitions. That makes focused testing harder, increases hidden coupling, and raises the cost of future changes.

**Goals**

- Improve testability by separating pure logic and side-effecting services behind explicit APIs.
- Improve readability by giving each file one clear responsibility.
- Improve future maintainability without breaking the current `file://` "open `recorder.html` directly" workflow.

**Non-Goals**

- Do not convert the app to ES modules.
- Do not add a build step, dependency manager, or local server requirement.
- Do not change user-visible behavior except where the refactor exposes existing regressions that need tightening.

**Constraints**

- `recorder.html` must remain directly openable from disk.
- Browser runtime code must continue to work as ordered script tags.
- Tests should be able to load individual modules directly from Node where practical.

## Recommended Approach

Split the current app into browser-safe plain-script modules that expose small factory-style APIs. In the browser, each module attaches itself to a single `window.VoiceLineRecorder*` namespace. In Node tests, the same module also exposes `module.exports`.

This keeps the no-server local-file workflow intact while still making dependencies explicit enough to test in isolation.

## Module Boundaries

### `src/recorder-core.js`

Keep this file focused on pure utilities:

- browser detection
- script parsing
- WAV encoding
- ZIP building
- session key generation
- storage availability checks

This file already mostly fits the target shape and should remain dependency-free.

### `src/recorder-state.js`

Own creation and reset of the mutable app state:

- create initial state object
- reset landing/setup/recording state slices
- clear transient recording state

This avoids scattering state reset rules across multiple screens and flows.

### `src/recorder-persistence.js`

Own both persistence mechanisms:

- `localStorage` session save/load/clear
- `IndexedDB` directory-handle save/load/clear
- permission checks for reusing directory handles

This module should receive dependencies explicitly, such as `window`, `localStorage`, and session key accessors, instead of reading broad global state when avoidable.

### `src/recorder-audio.js`

Own audio-device and recording operations:

- microphone initialization
- recording start/stop
- level meter updates
- playback of current recording

The module should be designed around small injected callbacks for UI refresh and message updates so that audio behavior can be tested without rendering the full app.

### `src/recorder-ui.js`

Own DOM construction and rendering:

- landing screen
- setup screen
- resume modal
- recording shell
- sidebar rendering
- main panel rendering
- completion screen
- shared SVG builders

This module should be mostly a renderer layer that accepts state and callbacks rather than mutating unrelated concerns directly.

### `src/recorder-app.js`

Reduce this file to composition and flow control:

- initialize dependencies
- wire state, persistence, audio, and UI together
- handle screen transitions
- coordinate save/retry/advance flows
- register keyboard listeners

The desired end state is that `recorder-app.js` reads like an application controller rather than an implementation dump.

## Data Flow

1. `recorder-app.js` creates state and service modules.
2. UI callbacks dispatch to the app controller.
3. The app controller invokes persistence/audio/core helpers as needed.
4. UI renderers re-render from current state instead of owning business rules.

This keeps business decisions in one place while allowing low-level modules to stay narrow.

## Testing Strategy

- Keep end-to-end harness coverage for the bootstrapped browser experience.
- Add focused unit coverage for persistence helpers, especially the directory-handle and session lifecycle paths.
- Add focused unit coverage for state reset helpers so screen transitions do not rely on incidental behavior.
- Where audio code cannot be deeply unit tested, keep it behind small APIs and exercise it with lightweight fakes.

## Migration Strategy

Do the refactor in small steps:

1. Extract persistence logic first because it already has clear boundaries and tests.
2. Extract state helpers next to remove reset logic duplication.
3. Extract UI builders/renderers once state and persistence boundaries are stable.
4. Extract audio logic last, after the controller seams are clearer.
5. Keep `recorder.html` as ordered script tags and add any new files explicitly.

This sequence reduces the risk of breaking the app during the split.

## Risks

- Over-extracting too early can replace one large file with several tightly coupled ones.
- Browser-global modules can still drift into hidden coupling if their APIs are not kept narrow.
- Test harnesses may need small updates as responsibilities move out of `recorder-app.js`.

## Success Criteria

- `src/recorder-app.js` becomes materially smaller and mostly orchestration.
- Persistence logic is tested without booting the full UI.
- State reset behavior is centralized instead of duplicated across flows.
- The app still opens correctly by double-clicking `recorder.html`.
