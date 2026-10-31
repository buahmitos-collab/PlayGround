# Voxelcraft

An infinite, procedural 3D voxel sandbox that runs entirely in the browser. Explore forests, plains, deserts, snowy taiga and oceans; mine caves and ore veins; build with dozens of blocks; and survive the night while zombies hunt you.

**Play:** open the project preview and press **Play World**. Everything is generated in the browser — no asset downloads, no backend, no account.

## Features

- **Infinite deterministic terrain** — chunk streaming, biome blending, caves, ore veins, beaches, lakes, rivers and varied trees.
- **Creative building** — 47 block types, a searchable-style catalogue, nine-slot hotbar, instant mining and placing.
- **Survival elements** — hearts, air meter, fall damage, swimming, sprinting, sneaking, spawning animals and night-time zombies.
- **Living world** — drifting clouds, a sun and moon, stars, fireflies, dynamic fog, day/night lighting and weather-light skies.
- **Desktop and mobile** — pointer-lock mouse and keyboard on desktop; joystick, drag-to-look and action buttons on touch devices.
- **Saving** — worlds, edits, player state and time are stored in `localStorage` and restored automatically.
- **Procedural audiovisual style** — pixel-art texture atlas, isometric block icons, block particles and Web Audio sounds/music generated at runtime.

## Controls

| Desktop | Action |
| --- | --- |
| `W A S D` | Move |
| `Space` | Jump / swim up |
| Double-tap `Space` or `F` | Toggle flight |
| `Shift` | Sprint / descend while flying |
| `Ctrl` | Sneak |
| Left mouse | Mine / attack |
| Right mouse | Place block |
| Middle mouse | Pick block |
| `1`–`9` / mouse wheel | Select hotbar slot |
| `E` | Block catalogue |
| `F3` | Debug overlay |
| `Esc` | Pause / resume |

On touch devices use the left joystick to move, drag anywhere on the world to look, and the on-screen buttons to jump, fly, mine, place and open the catalogue.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite. To build the static site:

```bash
npm run build
```

The output is written to `dist/` and can be served by any static file server.

## Tech

- [Three.js](https://threejs.org/) for WebGL rendering.
- [Vite](https://vite.dev/) for development and production builds.
- Vanilla ES modules, no UI framework.
- Chunked merged geometry with face culling, baked ambient occlusion and time-sliced meshing.
- Deterministic value-noise terrain and hash-based features.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/buahmitos-collab/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/buahmitos-collab/PlayGround)

- 🎮 [Open the project](https://omgithub.com/buahmitos-collab/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=buahmitos-collab%2FPlayGround).
- 💻 [Explore the source](https://github.com/buahmitos-collab/PlayGround).
- 🛠️ [Check build runs](https://github.com/buahmitos-collab/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/buahmitos-collab/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/buahmitos-collab).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
