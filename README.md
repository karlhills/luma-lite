# LumaLite

LumaLite is a tray-first, cross-platform Electron desktop app for controlling Govee lights. It uses Electron + Vite + React + TypeScript with a clean core package for device control and a sleek soft-glow UI.

## Highlights

- Tray-first UX with quick actions
- Control Deck for fast, grid-based control
- Favorites, Rooms, and Scenes for large device sets
- Local-first configuration (no server required)

## Features

- Devices: power, brightness, and color controls
- LAN discovery + local control (power, brightness, color, color temperature, state)
- Favorites: star devices for quick access
- Rooms: group devices and control them as a unit
- Scenes:
  - My Scenes: custom multi-device scenes
  - Device Scenes: dynamic/DIY scenes per device
- Control Deck: grid of tiles (global, device, room, or scene)
- Schedules: run My Scenes once, daily, or weekly

## Getting Started

1) Get a Govee API key from the Govee developer portal.
2) Install dependencies:

```
npm install
```

## Run (Development)

```
npm run dev
```

## Build

```
npm run build
```

## Package Installers

LumaLite uses `electron-builder` to create installers for macOS, Windows, and Linux.

```
npm run package
```

Outputs are written to the `release/` directory.

Notes:
- Packaging is configured in the root `package.json` under the `build` key.
- Icons are read from `packages/app/assets`:
  - macOS: `lumalite_icon.icns`
  - Windows/Linux: `lumalite_icon_large.png`
- On macOS, you may need to allow the app in System Settings after building locally.

## Configuration

Settings are stored locally in Electron's `userData` path at `config.json` (via `app.getPath('userData')`).

For normal use, enter your API key in Settings inside the app. You do not need a `.env` file.

If your network uses a self-signed proxy, set the CA path in Settings (PEM format). Export the CA from Keychain Access and paste the file path into Settings.

## LAN + Cloud behavior

LumaLite prefers LAN when available and falls back to cloud when needed:

- Discovery: LAN multicast scan (port 4001) + cloud list are merged by device ID.
- Control: Power/brightness/color/color temperature prefer LAN when a LAN IP is known.
- Scenes: Capability-based actions use LAN when possible; dynamic/DIY scenes still use cloud.
- State: `devStatus` over LAN is used when available; cloud state is the fallback.

If LAN is disabled or unavailable, everything falls back to cloud.

## Control Deck

Control Deck is a stream-deck-like grid for fast control. You can add tiles for:

- Global actions (All On, All Off, Refresh)
- Rooms
- Devices
- My Scenes

Toggle Edit Deck to add/remove/reorder tiles. Layout and grid size are saved locally.

## Scenes

### My Scenes
- Custom scenes that target devices, rooms, or favorites
- Actions: power, brightness, color, color temperature
- Optional per-device actions and scene selection
- Schedules: one-time, daily, or weekly (runs while the app is open)

### Device Scenes
- Fetch dynamic/DIY scenes per device
- Apply directly from the UI

## macOS Notes

- Tray-first: the app starts hidden and lives in the menu bar.
- Use Settings -> "Hide Dock icon" to hide/show the Dock icon immediately.

## Logs

LumaLite writes logs to `lumalite.log` in the app `userData` directory. Use the Settings page to download a copy of the logs.

## Help & Diagnostics

The in-app Help page includes a quick mental model, state freshness notes, diagnostics you can copy, and links to the repo/issues.

## Architecture

- `packages/core` - Govee provider interface + cloud API implementation + retry/backoff handling
- `packages/app` - Electron main/preload + React renderer UI
- IPC is exposed via a preload bridge; renderer has no Node integration

## API Reference (Govee OpenAPI)

Base URL: `https://openapi.api.govee.com`

Headers:
- `Govee-API-Key: <API_KEY>`
- `Content-Type: application/json`

Get devices:
- `GET /router/api/v1/user/devices`
- Response shape: `{ code, message, data: [...] }`

Control device:
- `POST /router/api/v1/device/control`
- Body:
```
{
  "requestId": "uuid",
  "payload": {
    "sku": "H605C",
    "device": "64:09:C5:32:37:36:2D:13",
    "capability": {
      "type": "devices.capabilities.on_off",
      "instance": "powerSwitch",
      "value": 0
    }
  }
}
```

Common capability mappings:
- Power: `type: devices.capabilities.on_off`, `instance: powerSwitch`, `value: 0/1`
- Brightness: `type: devices.capabilities.range`, `instance: brightness`, `value: 1-100`
- RGB color: `type: devices.capabilities.color_setting`, `instance: colorRgb`, `value: (r<<16)+(g<<8)+b`

## Security

API keys are stored locally on your machine and only used to call Govee's APIs. No telemetry or hosting is required.

## License

MIT. See `LICENSE`.
