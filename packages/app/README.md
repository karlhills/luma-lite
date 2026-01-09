# @lumalite/app

Electron shell + React renderer for LumaLite.

## Structure

- `src/main` - Electron main process (windows, tray, IPC handlers, config/logs).
- `src/preload` - IPC bridge exposed as `window.govee`.
- `src/renderer` - React UI (views, components, Zustand store).
- `assets` - icons and tray assets.

## Key patterns

- Renderer never touches Node APIs.
- IPC contract is defined in `src/shared/ipc.ts`.
- Local config is saved to `userData/config.json`.
- Logs are written to `userData/lumalite.log`.

## Development

From the repo root:

```
npm run dev
```

Renderer + main are bundled with Electron + Vite.

## Testing IPC changes

1) Update the type definitions in `src/shared/ipc.ts`.
2) Add a handler in `src/main/index.ts`.
3) Expose it in `src/preload/index.ts`.
4) Call from the renderer via `window.govee`.
