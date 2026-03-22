# Resume Output Directory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore the previously chosen output directory on resume in browsers that support persistent directory handles, while keeping zip-mode behavior unchanged.

**Architecture:** Keep line-progress session data in `localStorage`, add direct-save directory-handle persistence in `IndexedDB`, and restore the handle during setup only when the browser supports it and permission is still available. Update the setup UI to reflect a restored folder and make the top progress bar more visually prominent via CSS only.

**Tech Stack:** Vanilla HTML/CSS/JS, `localStorage`, `IndexedDB`, File System Access API.

---

### Task 1: Add regression tests

**Files:**
- Modify: `tests/recorder.test.js`

**Steps:**
1. Add a failing test that restores a saved directory handle in direct-save mode and confirms setup shows the remembered folder plus the Begin button.
2. Add a failing test that confirms the top progress bar styling is more prominent than the old `3px` muted bar.
3. Run `node --test tests/recorder.test.js` and confirm the new tests fail for the intended reasons.

### Task 2: Persist and restore the directory handle

**Files:**
- Modify: `src/recorder-app.js`

**Steps:**
1. Add small IndexedDB helpers for saving, loading, and deleting a directory handle by session key.
2. Save the chosen directory handle after folder selection in supported browsers.
3. Restore the saved handle during setup, verify permission without degrading unsupported browsers, and surface the remembered folder in the UI.
4. Clear any saved handle when starting over or resetting the session.

### Task 3: Strengthen progress bar styling

**Files:**
- Modify: `styles/recorder.css`

**Steps:**
1. Increase the bar height and visual contrast.
2. Add a subtle track/fill treatment so the bar reads more clearly during long sessions.

### Task 4: Verify

**Files:**
- Modify as needed: `README.md`

**Steps:**
1. Run `node --check src/recorder-app.js`.
2. Run `node --test tests/recorder.test.js`.
3. If behavior changed in a user-visible way, update docs briefly.
