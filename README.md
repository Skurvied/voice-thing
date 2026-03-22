# Voice Line Recorder

A small static browser app for recording voice lines from a script. No installation, no dependencies, no build step. Open `recorder.html` with the bundled `src/` and `styles/` folders intact.

Built for batch recording sessions — load a script, read the lines, record them one by one, and save the audio files with the correct filenames.

## Usage

1. Keep `recorder.html`, `src/`, and `styles/` together, then double-click `recorder.html`
2. Click **Load Script** and select your `.txt` script file
3. Choose an output folder (Chrome/Edge) or use zip download mode (Firefox/Safari)
4. Hold **Space** to record, release to stop
5. **P** to play back, **Enter** to keep, **R** to retry
6. Repeat until all lines are recorded

## Script File Format

Pipe-delimited `.txt` file with a header row:

```
filename | text
clip_0001.wav| There was once a merchant who employed many carpenters and masons to build a temple in his garden.
clip_0002.wav| Regularly, they would start work in the morning, and take a break for the mid-day meals.
clip_0003.wav| One day, a group of monkeys arrived at the site of the building.
```

- First column: output filename (used as-is when saving)
- Second column: the line to display and read aloud
- First row is treated as a header and skipped

## Keyboard Shortcuts

| Key | Action |
|-------|--------------------------|
| Space | Hold to record |
| P | Play back recording |
| Enter | Keep recording & next |
| R | Retry (discard & redo) |

## Features

- **Zero install** — static HTML, CSS, and JS files with no server or dependencies
- **Cross-platform** — works on Mac, Windows, Linux in any modern browser
- **Direct folder save** — Chrome/Edge save `.wav` files directly to a folder
- **Remembered output folder** — resumed direct-save sessions reuse the chosen folder when the browser still grants access
- **Zip fallback** — Firefox/Safari bundle recordings as a zip download
- **Session persistence** — progress saved to localStorage, resume after reload
- **WAV output** — 44100 Hz, 16-bit, mono PCM
- **Progress bar** — visual completion tracking across all lines
- **Recording timer** — live duration counter while recording
- **Audio level meter** — visual mic input feedback during recording
- **Sidebar navigation** — click any line to jump to it or re-record

## Browser Support

| Browser | Save Mode | Notes |
|---------|-----------|-------------------------------|
| Chrome | Direct | Full File System Access API |
| Edge | Direct | Full File System Access API |
| Brave | Direct | Chromium-based |
| Arc | Direct | Chromium-based |
| Opera | Direct | Chromium-based |
| Firefox | Zip | No File System Access API |
| Safari | Zip | No File System Access API |

## Audio Output

Files are saved as PCM WAV:
- Sample rate: 44100 Hz
- Bit depth: 16-bit
- Channels: Mono
- Filenames: taken from the script file's first column
