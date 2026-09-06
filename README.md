<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/renderer/src/assets/owl-logo-white.png">
    <source media="(prefers-color-scheme: light)" srcset="src/renderer/src/assets/owl-logo-black.png">
    <img src="src/renderer/src/assets/owl-logo-black.png" alt="OwlPAD logo" width="160">
  </picture>
</p>

# OwlPAD

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-isjordi%2Fowlpad-blue?logo=github)](https://github.com/isjordi/owlpad)

Made vibe-coded, testing Claude, hope it can be useful!

A free, local-first Markdown notepad for students — with an offline AI study
assistant, Owly, built in.

- **Notes stay on your machine.** Every note is a plain `.md` file (with
  frontmatter) on disk, organized as `Subject > Title > Section`, fully
  portable and readable outside the app.
- **Owly, the built-in AI, runs 100% locally** via [Ollama](https://ollama.com) —
  nothing about your notes is ever sent anywhere. Owly can chat about your
  notes, paraphrase pasted text into structured study notes, generate
  quizzes and flashcards from a note (or a whole Title's worth of notes),
  and surface ambient "insight" facts while you write.
- **No account, no server, no limits.** This is a fully offline, unlimited
  build — there's no sign-in, no usage caps, and no network dependency
  beyond talking to Ollama on `127.0.0.1`.

## Features

- PIN-locked app with a vault folder you choose
- Subject → Title → Section note hierarchy with full-text search
- 3 themes, 2 fonts, resizable panes, a distraction-free focus mode
- A study timer (presets or custom minutes, with a completion sound + desktop
  notification)
- Owly AI (via Ollama): chat, paraphrase, quizzes, active recall flashcards,
  ambient insights
- One-click Ollama install + model pull from Settings (with native OS
  elevation on Linux)

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 18+ and npm
- (Optional, for AI features) [Ollama](https://ollama.com) — the app can also
  install this for you from Settings

### Run in development

```bash
git clone https://github.com/isjordi/owlpad.git
cd owlpad
npm install
npm run dev
```

### Build an installer

```bash
npm run build:mac    # macOS (.zip)
npm run build:win    # Windows (NSIS .exe)
npm run build:linux  # Linux (.AppImage + .deb)
```

Built installers land in `dist/`. Building for a platform other than the one
you're on may require extra tooling (e.g. `wine` to build the Windows
installer from Linux/macOS).

## Tech stack

Electron + React + TypeScript (via `electron-vite`/`electron-builder`),
Zustand for state, Tailwind for layout, CodeMirror 6 for the Markdown editor,
`gray-matter` for note frontmatter, `flexsearch` for full-text search, and
Ollama for local AI inference.

## Project structure

```
src/
  main/       Electron main process — vault/notes, PIN, AI (Ollama), IPC
  preload/    contextBridge API exposed to the renderer
  renderer/   React UI
  shared/     types shared between main and renderer
```

## License

MIT — see [LICENSE](LICENSE).
