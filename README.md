# PlayGround

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

## 🎮 Aetheria — Jejak Sang Angin

Prototipe game open-world 3D di browser yang terinspirasi Genshin Impact. Dibuat dengan **Vite + Three.js**, tanpa aset eksternal — pulau, karakter, slime, dan efek dibuat secara prosedural.

### Menjalankan

```bash
npm install
npm run dev     # http://localhost:3002
npm run build   # hasil statis di dist/
```

### Kontrol

| Aksi | Keyboard | Sentuh |
| --- | --- | --- |
| Gerak | `WASD` | Joystick kiri |
| Lari | `Shift` | — |
| Lompat / Terbang | `Spasi` | Tombol lompat |
| Serang | `J` / klik kiri | Tombol pedang |
| Skill elemen | `E` | Tombol skill |
| Burst | `Q` | Tombol burst |
| Ganti karakter | `1` / `2` | Kartu karakter |
| Interaksi | `F` | Prompt interaksi |
| Jeda | `Esc` | Tombol jeda |

### Fitur

- Pulau terbuka dengan desa, bukit, pantai, danau, serta pulau melayang.
- Dua karakter dengan elemen berbeda: **Aria (Anemo)** dan **Ember (Pyro)**.
- Reaksi elemental (Uap, Kobar, Pusaran, Kejut, Ledakan) dengan skill dan burst.
- Slime musuh, Raja Slime Purba, bar HP, damage number, dan sistem respawn.
- Alur petualangan: bicara dengan Penjaga Awan → kumpulkan 3 Serpihan Angin → kalahkan 3 slime → buka peti kuno.
- Minimap, marker objek, dialog, toast, layar hadiah, jeda, dan layar tumbang.
- Dukungan desktop dan mobile: joystick, tombol aksi sentuh, serta layout safe-area.
- Deteksi renderer software (SwiftShader) dengan penurunan kualitas otomatis.
- Audio ambient dan efek suara prosedural melalui Web Audio.

