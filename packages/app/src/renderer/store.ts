import { create } from 'zustand';
import type { Device, DeviceState, RGB, Scene } from '@lumalite/core';
import type {
  Config,
  DeckConfig,
  Diagnostics,
  PreferenceName,
  MyScene,
  DeviceScenesCache
} from '../shared/ipc';
import { defaultScenes } from './views/scenesData';

const getApi = () => {
  if (!window.govee) {
    throw new Error('Govee bridge unavailable. Please run inside the Electron app.');
  }
  return window.govee;
};

export type ViewKey = 'favorites' | 'rooms' | 'devices' | 'scenes' | 'settings' | 'deck' | 'help';

type AppState = {
  devices: Device[];
  devicePower: Record<string, boolean>;
  scenes: Scene[];
  config: Config;
  favorites: string[];
  rooms: Record<string, string>;
  roomNames: string[];
  myScenes: MyScene[];
  deviceScenesCache: DeviceScenesCache;
  deck: DeckConfig;
  deviceStates: Record<string, DeviceState>;
  lastStateUpdateAt?: number;
  diagnostics?: Diagnostics;
  activeView: ViewKey;
  activeRoom: string | null;
  deckFocus: boolean;
  loading: boolean;
  error?: string;
  clearError: () => void;
  init: () => Promise<void>;
  setActiveView: (view: ViewKey) => void;
  setApiKey: (key: string) => Promise<void>;
  setPreference: (name: PreferenceName, value: unknown) => Promise<void>;
  setFavorite: (deviceId: string, isFavorite: boolean) => Promise<void>;
  setDeviceRoom: (deviceId: string, roomName: string) => Promise<void>;
  setRoomList: (rooms: string[]) => Promise<void>;
  renameRoom: (from: string, to: string) => Promise<void>;
  deleteRoom: (roomName: string) => Promise<void>;
  setActiveRoom: (room: string | null) => void;
  setDeckFocus: (value: boolean) => void;
  setRoomPower: (roomName: string, on: boolean) => Promise<void>;
  setRoomBrightness: (roomName: string, level: number) => Promise<void>;
  setRoomColor: (roomName: string, color: RGB) => Promise<void>;
  loadScenes: () => Promise<void>;
  saveScene: (scene: MyScene) => Promise<void>;
  deleteScene: (sceneId: string) => Promise<void>;
  duplicateScene: (sceneId: string) => Promise<void>;
  applyMyScene: (sceneId: string) => Promise<{ appliedDevices: number; skippedActions: number }>;
  getDeviceScenes: (deviceId: string) => Promise<DeviceScenesCache[string] | undefined>;
  fetchDeviceScenes: (deviceId: string) => Promise<DeviceScenesCache[string] | undefined>;
  applyDynamicScene: (deviceId: string, scene: DeviceScenesCache[string]['dynamic'][number]) => Promise<void>;
  applyDiyScene: (deviceId: string, scene: DeviceScenesCache[string]['diy'][number]) => Promise<void>;
  fetchDeviceState: (deviceId: string) => Promise<DeviceState | undefined>;
  refreshDeviceStates: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  togglePower: (deviceId: string) => Promise<void>;
  setAllPower: (on: boolean) => Promise<void>;
  setPowerForDevices: (deviceIds: string[], on: boolean) => Promise<void>;
  setBrightness: (deviceId: string, level: number) => Promise<void>;
  setColor: (deviceId: string, color: RGB) => Promise<void>;
  applyScene: (scene: Scene) => Promise<void>;
  saveDeck: (deck: DeckConfig) => Promise<void>;
};

export const useAppStore = create<AppState>((set, get) => ({
  devices: [],
  devicePower: {},
  scenes: defaultScenes,
  config: {},
  favorites: [],
  rooms: {},
  roomNames: [],
  myScenes: [],
  deviceScenesCache: {},
  deck: {
    gridPreset: '4x4',
    tileSize: 'md',
    sceneActiveThreshold: 0.8,
    tiles: []
  },
  deviceStates: {},
  lastStateUpdateAt: undefined,
  diagnostics: undefined,
  activeView: 'scenes',
  activeRoom: null,
  deckFocus: false,
  loading: false,
  error: undefined,
  clearError: () => set({ error: undefined }),
  init: async () => {
    set({ loading: true });
    try {
      const api = getApi();
      const config = await api.getConfig();
      let diagnostics = await api.getDiagnostics();
      let devices: Device[] = [];
      if (config.apiKey) {
        try {
          devices = await api.refreshDevices();
          diagnostics = await api.getDiagnostics();
        } catch {
          devices = await api.listDevices();
        }
      }
      const devicePower = devices.reduce<Record<string, boolean>>((acc, device) => {
        acc[device.id] = true;
        return acc;
      }, {});
      // First-run behavior: focus the deck if no tiles exist yet.
      const nextDeck =
        config.deck ?? {
          gridPreset: '4x4',
          tileSize: 'md',
          sceneActiveThreshold: 0.8,
          tiles: []
        };
      const nextView = nextDeck.tiles.length === 0 ? 'deck' : 'scenes';
      set({
        config,
        favorites: config.favorites ?? [],
        rooms: config.rooms ?? {},
        roomNames: config.roomNames ?? [],
        myScenes: config.myScenes ?? [],
        deviceScenesCache: config.deviceScenesCache ?? {},
        deck: nextDeck,
        diagnostics,
        devices,
        devicePower,
        activeView: nextView
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load app' });
    } finally {
      set({ loading: false });
    }
  },
  setActiveView: (view) => set({ activeView: view }),
  setApiKey: async (key) => {
    const config = await getApi().setApiKey(key);
    set({ config, activeView: config.apiKey ? 'devices' : 'settings' });
    if (config.apiKey) {
      await get().refreshDevices();
    }
  },
  setPreference: async (name, value) => {
    const config = await getApi().setPreference(name, value);
    set({
      config,
      favorites: config.favorites ?? get().favorites,
      rooms: config.rooms ?? get().rooms,
      roomNames: config.roomNames ?? get().roomNames
    });
  },
  setFavorite: async (deviceId, isFavorite) => {
    const config = await getApi().setFavorite(deviceId, isFavorite);
    set({ config, favorites: config.favorites ?? [] });
  },
  setDeviceRoom: async (deviceId, roomName) => {
    const config = await getApi().setDeviceRoom(deviceId, roomName);
    set({ config, rooms: config.rooms ?? {} });
  },
  setRoomList: async (rooms) => {
    const config = await getApi().setRoomList(rooms);
    set({ config, roomNames: config.roomNames ?? [] });
  },
  renameRoom: async (from, to) => {
    const config = await getApi().renameRoom(from, to);
    set({
      config,
      roomNames: config.roomNames ?? [],
      rooms: config.rooms ?? {}
    });
  },
  deleteRoom: async (roomName) => {
    const config = await getApi().deleteRoom(roomName);
    set({
      config,
      roomNames: config.roomNames ?? [],
      rooms: config.rooms ?? {}
    });
  },
  setActiveRoom: (room) => set({ activeRoom: room }),
  setDeckFocus: (value) => set({ deckFocus: value }),
  setRoomPower: async (roomName, on) => {
    const devices = get().devices.filter((device) => get().rooms[device.id] === roomName);
    for (const device of devices) {
      await getApi().setPower(device.id, on);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    const nextPower = { ...get().devicePower };
    devices.forEach((device) => {
      nextPower[device.id] = on;
    });
    set({ devicePower: nextPower });
  },
  setRoomBrightness: async (roomName, level) => {
    const devices = get().devices.filter((device) => get().rooms[device.id] === roomName);
    for (const device of devices) {
      await getApi().setBrightness(device.id, level);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  },
  setRoomColor: async (roomName, color) => {
    const devices = get().devices.filter((device) => get().rooms[device.id] === roomName);
    for (const device of devices) {
      await getApi().setColor(device.id, color);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  },
  loadScenes: async () => {
    const scenes = await getApi().listScenes();
    set({ myScenes: scenes });
  },
  saveScene: async (scene) => {
    const scenes = await getApi().saveScene(scene);
    set({ myScenes: scenes });
  },
  deleteScene: async (sceneId) => {
    const scenes = await getApi().deleteScene(sceneId);
    set({ myScenes: scenes });
  },
  duplicateScene: async (sceneId) => {
    const scenes = await getApi().duplicateScene(sceneId);
    set({ myScenes: scenes });
  },
  applyMyScene: async (sceneId) => getApi().applyScene(sceneId),
  getDeviceScenes: async (deviceId) => {
    try {
      const entry = await getApi().getDeviceScenes(deviceId);
      if (entry) {
        set((current) => ({
          deviceScenesCache: { ...current.deviceScenesCache, [deviceId]: entry }
        }));
      }
      return entry;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load device scenes'
      });
      return undefined;
    }
  },
  fetchDeviceScenes: async (deviceId) => {
    try {
      const entry = await getApi().fetchDeviceScenes(deviceId);
      if (entry) {
        set((current) => ({
          deviceScenesCache: { ...current.deviceScenesCache, [deviceId]: entry }
        }));
      }
      return entry;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch device scenes'
      });
      return undefined;
    }
  },
  applyDynamicScene: async (deviceId, scene) => {
    await getApi().applyDynamicScene(deviceId, scene);
  },
  applyDiyScene: async (deviceId, scene) => {
    await getApi().applyDiyScene(deviceId, scene);
  },
  fetchDeviceState: async (deviceId) => {
    try {
      const state = await getApi().getDeviceState(deviceId);
      const power = state.power;
      set((current) => ({
        deviceStates: { ...current.deviceStates, [deviceId]: state },
        devicePower:
          typeof power === 'boolean'
            ? { ...current.devicePower, [deviceId]: power }
            : current.devicePower
      }));
      return state;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load device state'
      });
      return undefined;
    }
  },
  refreshDeviceStates: async () => {
    if (!get().config.apiKey) return;
    const api = getApi();
    const devices = get().devices;
    const concurrency = 3;
    let index = 0;
    const nextStates: Record<string, DeviceState> = { ...get().deviceStates };
    const nextPower: Record<string, boolean> = { ...get().devicePower };
    const worker = async () => {
      while (index < devices.length) {
        const current = devices[index];
        index += 1;
        try {
          const state = await api.getDeviceState(current.id);
          nextStates[current.id] = state;
          if (typeof state.power === 'boolean') {
            nextPower[current.id] = state.power;
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to refresh device states'
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    };
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    set({ deviceStates: nextStates, devicePower: nextPower, lastStateUpdateAt: Date.now() });
  },
  refreshDevices: async () => {
    set({ loading: true });
    try {
      const api = getApi();
      const devices = await api.refreshDevices();
      const diagnostics = await api.getDiagnostics();
      set({
        devices,
        diagnostics,
        devicePower: devices.reduce<Record<string, boolean>>((acc, device) => {
          acc[device.id] = get().devicePower[device.id] ?? true;
          return acc;
        }, {})
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to refresh devices' });
    } finally {
      set({ loading: false });
    }
  },
  togglePower: async (deviceId) => {
    const current = get().devicePower[deviceId] ?? true;
    await getApi().setPower(deviceId, !current);
    set({ devicePower: { ...get().devicePower, [deviceId]: !current } });
  },
  setAllPower: async (on) => {
    const devices = get().devices;
    for (const device of devices) {
      await getApi().setPower(device.id, on);
    }
    const nextPower = devices.reduce<Record<string, boolean>>((acc, device) => {
      acc[device.id] = on;
      return acc;
    }, {});
    set({ devicePower: nextPower });
  },
  setPowerForDevices: async (deviceIds, on) => {
    const devices = get().devices.filter((device) => deviceIds.includes(device.id));
    for (const device of devices) {
      await getApi().setPower(device.id, on);
    }
    const nextPower = { ...get().devicePower };
    devices.forEach((device) => {
      nextPower[device.id] = on;
    });
    set({ devicePower: nextPower });
  },
  setBrightness: async (deviceId, level) => {
    await getApi().setBrightness(deviceId, level);
  },
  setColor: async (deviceId, color) => {
    await getApi().setColor(deviceId, color);
  },
  applyScene: async (scene) => {
    await getApi().applyScene(scene.id);
  },
  saveDeck: async (deck) => {
    const next = await getApi().saveDeck(deck);
    set({ deck: next });
  }
}));
