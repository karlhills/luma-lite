import type { GoveeApi } from '../shared/ipc';

declare global {
  interface Window {
    govee: GoveeApi;
  }
}

export {};
