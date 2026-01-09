# Architecture

LumaLite is split into two workspaces:

- `packages/core` - Govee API client + provider abstraction (no UI).
- `packages/app` - Electron app (main, preload, renderer).

## High-level flow

1) Renderer UI triggers actions using a typed IPC surface (`window.govee`).
2) Preload bridges IPC channels with `contextBridge` (no Node in renderer).
3) Main process owns config, device orchestration, and Govee API calls.
4) Core package performs typed API requests with retry/backoff.

```
Renderer (React) -> Preload (IPC bridge) -> Main (Electron) -> Core (Govee API)
```

## Security model

- `nodeIntegration` is disabled in the renderer.
- `contextIsolation` is enabled.
- All privileged operations (filesystem, network, shell open) live in main.
- External links are opened via a main-process IPC handler.

## Configuration + storage

- Local config is stored in `config.json` in Electron `userData`.
- Logs are written to `lumalite.log` in `userData`.
- API keys are stored locally and never uploaded automatically.

## Main process responsibilities

- App/window lifecycle, tray menu.
- IPC handlers (config, device control, scenes, logs, external links).
- DeviceService: wraps provider calls and caches device list + state freshness.
- LAN + cloud merge:
  - LAN discovery scans multicast (239.255.255.250:4001), listens on 4002.
  - Cloud devices are merged by normalized device ID.
  - LAN is preferred for power/brightness/color/color temperature and devStatus when available.
  - Cloud is the fallback and required for dynamic/DIY scenes.
- Scheduler: runs scene schedules while the app is open.

## Renderer responsibilities

- UI views (Devices, Scenes, Rooms, Favorites, Control Deck, Settings, Help)
- State is managed with a single Zustand store.
- Renderer only calls `window.govee` for privileged actions.

## Core package responsibilities

- Govee Cloud provider implementation.
- Typed request/response parsing + retry/backoff handling.
- Capability-aware control operations.

## Notes for contributors

- Add new privileged operations as IPC handlers in main and expose them in preload.
- Update `packages/app/src/shared/ipc.ts` when extending the IPC contract.
- Keep renderer free of Node APIs and direct filesystem access.
