# Valorant Store — Tauri Edition

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-1.77%2B-CE422B?style=flat-square&logo=rust&logoColor=white)](https://rustup.rs)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)](LICENSE)

[![Windows](https://img.shields.io/badge/Windows-✔%20tested-0078D4?style=flat-square&logo=windows&logoColor=white)]()
[![macOS](https://img.shields.io/badge/macOS-✔%20tested-000000?style=flat-square&logo=apple&logoColor=white)]()
[![Linux X11](https://img.shields.io/badge/Linux_X11-✔%20tested%20on%20Nobara-FCC624?style=flat-square&logo=linux&logoColor=black)]()

**English** · [Русский](README.ru.md)

> A desktop Valorant shop viewer built with Tauri 2.  
> Check your daily shop and Night Market without launching the game.  
> The entire Riot API backend is written in **Rust** — no Python, no server, no cold starts.

---

## Features

- **Daily shop** with live countdown timers that survive app restarts
- **Night Market** support (shown automatically when active)
- Three themes — Dark · White · Catppuccin Mocha
- Four UI languages — 🇺🇸 EN · 🇺🇦 UK · 🇷🇺 RU · 🇵🇱 PL
- Deep-link auto-login via the `valorant-store://auth` scheme
- Session persisted to disk — no re-login after restart until the shop resets
- Your token never leaves the device — all requests go directly to Riot's API

---

## How it differs from the original web version

| | Original (Next.js + FastAPI) | This repo (Tauri 2) |
|---|---|---|
| Backend | Python / FastAPI | Rust (reqwest, tokio) |
| Frontend | Next.js | Vite + React 19 |
| Deployment | Vercel + Render | Desktop app, nothing to deploy |
| Session storage | sessionStorage (tab-scoped) | `tauri-plugin-store` (persists to disk) |
| Lockfile login | ✔ (localhost only) | — (not needed for desktop use) |
| Region storage | sessionStorage | Persistent, restored on startup |

---

## Requirements

- [Node.js](https://nodejs.org) ≥ 18
- [Rust](https://rustup.rs) stable toolchain
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS

---

## Getting started

```bash
git clone https://github.com/OutTuna/Valorant-Shop-Tauri
cd Valorant-Shop-Tauri
npm install
```

### Run in development

```bash
npm run tauri dev
```

#### Linux — Nobara / Wayland workaround

On Nobara, Fedora 40+, and other distros running WebKit2GTK under Wayland,
the default renderer may produce a blank window or crash.
Force X11 mode with:

```bash
GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri dev
```

For the release binary you can create a small wrapper script:

```bash
#!/usr/bin/env bash
GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 exec "$(dirname "$0")/valorant-store" "$@"
```

Or add the variables to your `.desktop` launcher's `Exec=` line.

### Build for production

```bash
npm run tauri build
```

Binaries and installers are written to `src-tauri/target/release/bundle/`.

---

## Login

The app uses the **browser token flow** only — no Riot Client lockfile required.

1. Click **"Browser fallback: open Riot login"** — your system browser opens Riot's auth page.
2. Sign in with your Riot account.
3. You'll land on `https://playvalorant.com/opt_in#access_token=...`
4. Copy the full URL from the address bar and paste it back into the app.

### Deep-link auto-login (faster)

Instead of copying the URL, you can let the app capture the token automatically:

1. Click **"Browser fallback: open Riot login"** and sign in.
2. When the browser shows `playvalorant.com/opt_in`, click the address bar,
   replace `https://playvalorant.com/opt_in` with `valorant-store://auth`,
   and press **Enter**.
3. The OS will hand the URL to the app and log you in without any copy-pasting.

> **Tip:** you only need to sign in again when the daily shop has refreshed
> (every ~24 h). The session is saved on disk and restored automatically.

---

## Project structure

```
├── src/                    # React frontend (Vite)
│   ├── context/            # Theme + Language providers
│   ├── lib/
│   │   └── valorant.ts     # Session & region storage (tauri-plugin-store)
│   └── pages/
│       ├── HomePage.tsx    # Daily shop + Night Market
│       ├── LoginPage.tsx   # Auth flow
│       ├── DeepLinkListener.tsx  # Deep-link handler (mounted at root)
│       └── RedirectPage.tsx      # Handles the OAuth redirect URL
└── src-tauri/
    ├── src/
    │   ├── valorant.rs     # All Riot API logic (reqwest, async)
    │   ├── commands.rs     # Tauri commands exposed to the frontend
    │   ├── types.rs        # Shared Serde types
    │   └── error.rs        # Unified error type
    └── capabilities/
        └── default.json    # IPC permission scopes
```

---

## Known limitations

- **Lockfile login** (reading the Riot Client's local port/token) is not
  implemented. The browser token flow works fine for a standalone desktop app.
- **Night Market timer** is not available — Riot doesn't expose a public
  schedule. The section simply shows a placeholder when no Night Market is
  active.
- The Riot API occasionally changes endpoints; if the shop fails to load,
  check [Issues](../../issues) for updates.

---

## Disclaimer

This project is not affiliated with or endorsed by Riot Games.  
Valorant and all related assets are property of Riot Games, Inc.
