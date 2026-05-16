# drum-overlay

A transparent macOS desktop overlay for drum practice. Load a music file, hit **F** and **J** to play along, and the app stays on top of everything.

## Requirements

- macOS
- Node.js + npm

## Install

```bash
npm install
```

## Start the overlay

```bash
npm start
```

The overlay appears as a full-screen transparent window on top of all your apps. A dark panel sits at the bottom-center — that's your drum pad, music player, and scrolling note lane. To quit, press **⌘ Shift Q** from anywhere.

## Controls

| Key / Action | What it does |
|---|---|
| `F` | Kick drum |
| `J` | Snare drum |
| `Space` | Play / pause |
| `📂` button | Load a music file |
| Drag panel | Reposition the panel |
| `⌘ Shift Q` | Quit (works from anywhere) |

> Click the panel first to give it keyboard focus before using F/J.

## Supported audio formats

MP3, WAV, OGG, M4A, AAC, FLAC

## Features

### Music player
- Progress bar with seek support, elapsed/total time, and track name display
- Space to play/pause; click the progress bar to seek

### Scrolling note lane
- Automatically detects kick and snare hits from the loaded audio using onset detection
- Estimates BPM from the song and displays two separate lanes (kick top, snare bottom)
- Notes scroll from right to left; hit the target circle at the right time
- **3, 2, 1 count-in** with drum stick clicks before the song starts so you can prepare

### Scoring
- **Perfect** (±65 ms): +300 pts — **Good** (±130 ms): +100 pts — **Miss**: streak reset
- Consecutive perfect hits build a streak; every 4 in a row triggers a particle explosion
- End-of-song results screen: rating (S/A/B/C/D), score, accuracy %, perfect/good counts, max streak

### Difficulty
- **NORMAL** (default): play through the full song with no fail condition
- **HARD**: miss 3 notes and the song stops with a FAILED screen — toggle the `NORMAL/HARD` button in the BPM row

### Themes
Five switchable colour themes via the dropdown in the BPM row:

| Theme | Kick | Snare |
|---|---|---|
| Lime (default) | Lime green | Blue |
| Classic | Orange | Blue |
| Forest | Green | Blue |
| Neon | Magenta | Cyan |
| Dusk | Purple | Teal |

## Stack

- Electron 31
- Vanilla JS, CSS, Web Audio API
- No framework, no bundler
