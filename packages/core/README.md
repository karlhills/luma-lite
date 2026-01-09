# @lumalite/core

Typed Govee API client + provider abstraction.

## Structure

- `src/cloud.ts` - Govee OpenAPI client with retry/backoff and validation.
- `src/providers` - provider interface + cloud provider implementation.
- `src/types` - shared core types (devices, capabilities, scenes).

## Responsibilities

- Normalize Govee API responses.
- Provide capability-aware device control methods.
- Keep network logic isolated from UI concerns.
- Include a basic LAN provider (discovery + power only) for local control where supported.

## Usage (from app)

The Electron main process instantiates the provider and uses it via `DeviceService`.
Renderer access always goes through IPC.
